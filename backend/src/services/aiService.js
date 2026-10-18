const { GoogleGenAI } = require("@google/genai");
const ApiError = require("../utils/ApiError");
const {
  NIVELES: NIVELES_ADAPTATIVOS,
  normalizarConfiguracionAdaptativa,
} = require("../config/adaptiveEvaluationRules");

const NIVELES = ["BASICO", "INTERMEDIO", "AVANZADO"];
const TIPOS_PREGUNTA = ["OPCION_MULTIPLE", "VERDADERO_FALSO", "RESPUESTA_CORTA"];

// Flash-Lite es suficiente para borradores estructurados y reduce coste/latencia.
// Se deja un único modelo por defecto para no duplicar llamadas ante un fallo.
const MODELO_DEFECTO = "gemini-3.5-flash-lite";
const MODELOS_FALLBACK_DEFECTO = "";

let geminiClient = null;
let geminiClientKey = null;

const esperar = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const obtenerCliente = () => {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey || !String(apiKey).trim()) {
    throw ApiError.serviceUnavailable(
      "El servicio de inteligencia artificial no está configurado",
    );
  }

  const keyNormalizada = String(apiKey).trim();
  if (!geminiClient || geminiClientKey !== keyNormalizada) {
    geminiClient = new GoogleGenAI({ apiKey: keyNormalizada });
    geminiClientKey = keyNormalizada;
  }

  return geminiClient;
};

const obtenerModelos = () => {
  const principal = (process.env.GEMINI_MODEL || MODELO_DEFECTO).trim();
  const fallbacks = (process.env.GEMINI_FALLBACK_MODELS || MODELOS_FALLBACK_DEFECTO)
    .split(",")
    .map((modelo) => modelo.trim())
    .filter(Boolean);

  return [...new Set([principal, ...fallbacks])];
};

const maxReintentos = () => {
  const valor = Number(process.env.GEMINI_RETRY_MAX ?? 0);
  return Number.isInteger(valor) && valor >= 0 ? valor : 0;
};

const baseReintentoMs = () => {
  const valor = Number(process.env.GEMINI_RETRY_BASE_MS ?? 1500);
  return Number.isFinite(valor) && valor > 0 ? valor : 1500;
};

const parseErrorBody = (error) => {
  const mensaje = String(error?.message ?? "").trim();
  if (!mensaje.startsWith("{")) return null;

  try {
    const parsed = JSON.parse(mensaje);
    return parsed?.error ?? parsed;
  } catch {
    return null;
  }
};

const extraerStatusError = (error) => {
  const body = parseErrorBody(error);
  return (
    error?.status ??
    error?.response?.status ??
    error?.statusCode ??
    (typeof body?.code === "number" ? body.code : null) ??
    (body?.status === "RESOURCE_EXHAUSTED" ? 429 : null) ??
    (body?.status === "UNAVAILABLE" ? 503 : null)
  );
};

const extraerRetryDelayMs = (error) => {
  const body = parseErrorBody(error);
  const detalles = body?.details ?? error?.errorDetails ?? [];
  const retryInfo = detalles.find(
    (detalle) =>
      detalle?.["@type"]?.includes("RetryInfo") ||
      detalle?.retryDelay != null,
  );

  if (retryInfo?.retryDelay) {
    const segundos = Number(
      String(retryInfo.retryDelay).replace(/s$/i, ""),
    );
    if (Number.isFinite(segundos) && segundos > 0) {
      return Math.ceil(segundos * 1000);
    }
  }

  const match = String(error?.message ?? "").match(/retry in ([0-9.]+)s/i);
  if (match) {
    return Math.ceil(Number(match[1]) * 1000);
  }

  return null;
};

const esErrorCuota = (error) => {
  const status = extraerStatusError(error);
  const mensaje = String(error?.message ?? "").toLowerCase();
  return (
    status === 429 ||
    mensaje.includes("resource_exhausted") ||
    mensaje.includes("rate limit") ||
    mensaje.includes("quota exceeded") ||
    mensaje.includes("exceeded your current quota")
  );
};

/** Cuota diaria/minuto agotada para ese modelo (limit: 0): no sirve esperar ni reintentar. */
const esCuotaAgotadaModelo = (error) => {
  const mensaje = String(error?.message ?? "");
  if (!esErrorCuota(error)) return false;

  const body = parseErrorBody(error);
  const violaciones = body?.details?.find((d) =>
    d?.["@type"]?.includes("QuotaFailure"),
  )?.violations;

  if (Array.isArray(violaciones)) {
    const sinCuota = violaciones.some(
      (v) => v?.quotaValue === "0" || v?.quotaValue === 0,
    );
    if (sinCuota) return true;
  }

  return /"limit"\s*:\s*0\b/.test(mensaje) || /\blimit:\s*0\b/.test(mensaje);
};

const esErrorModeloNoDisponible = (error) => {
  const status = extraerStatusError(error);
  const mensaje = String(error?.message ?? "").toLowerCase();
  return (
    status === 404 ||
    mensaje.includes("not found") ||
    mensaje.includes("not_found") ||
    mensaje.includes("is not found") ||
    mensaje.includes("no longer available")
  );
};

const esErrorTemporal = (error) => {
  const status = extraerStatusError(error);
  const mensaje = String(error?.message ?? "").toLowerCase();
  return (
    esErrorCuota(error) ||
    status === 503 ||
    mensaje.includes("unavailable") ||
    mensaje.includes("overloaded")
  );
};

const registrarFalloGemini = (error, model) => {
  const mensaje = String(error?.message ?? "error desconocido").slice(0, 500);
  console.error(
    `[IA] Fallo Gemini modelo=${model} status=${extraerStatusError(error) ?? "n/d"}: ${mensaje}`,
  );
};

const extraerTextoRespuesta = (response) => {
  const crudo =
    typeof response?.text === "function" ? response.text() : response?.text;
  if (crudo && String(crudo).trim()) {
    return String(crudo).trim();
  }

  const partes = response?.candidates?.[0]?.content?.parts ?? [];
  const concatenado = partes
    .map((parte) => parte?.text ?? "")
    .join("")
    .trim();
  if (concatenado) return concatenado;

  const bloqueo =
    response?.promptFeedback?.blockReason ||
    response?.candidates?.[0]?.finishReason;
  if (bloqueo && String(bloqueo).toUpperCase().includes("SAFETY")) {
    throw ApiError.badRequest(
      "La solicitud fue bloqueada por las políticas de contenido de la IA",
    );
  }

  return "";
};

const parsearJsonDeTexto = (content) => {
  const texto = String(content ?? "").trim();
  if (!texto) {
    throw new Error("La IA devolvió una respuesta vacía");
  }

  const cerca = texto.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const candidato = cerca ? cerca[1].trim() : texto;
  const inicio = candidato.indexOf("{");
  const fin = candidato.lastIndexOf("}");
  const jsonTexto =
    inicio >= 0 && fin > inicio ? candidato.slice(inicio, fin + 1) : candidato;

  return JSON.parse(jsonTexto);
};

const debeProbarOtroModelo = (error) => {
  if (!(error instanceof ApiError)) {
    return (
      esErrorCuota(error) ||
      esCuotaAgotadaModelo(error) ||
      esErrorModeloNoDisponible(error) ||
      esErrorTemporal(error)
    );
  }

  const mensaje = String(error.message ?? "").toLowerCase();
  if (mensaje.includes("no está configurado")) return false;

  return (
    error.statusCode === 429 ||
    mensaje.includes("límite de uso") ||
    mensaje.includes("json válido") ||
    mensaje.includes("no devolvió") ||
    mensaje.includes("respuesta ia inválida") ||
    mensaje.includes("formato esperado") ||
    mensaje.includes("no está disponible") ||
    mensaje.includes("saturado")
  );
};

const mapearErrorGemini = (error) => {
  const status = extraerStatusError(error);
  const message = String(error?.message ?? "").toLowerCase();

  if (esErrorCuota(error)) {
    return ApiError.tooManyRequests(
      "Se alcanzó el límite de uso del servicio de IA. Espera un momento e intenta de nuevo",
    );
  }
  if (status === 401 || status === 403 || message.includes("api key")) {
    return ApiError.serviceUnavailable(
      "El servicio de inteligencia artificial no está disponible temporalmente",
    );
  }
  if (status === 503 || message.includes("unavailable") || message.includes("overloaded")) {
    return ApiError.serviceUnavailable(
      "El servicio de inteligencia artificial está saturado. Intenta más tarde",
    );
  }
  if (message.includes("token") && message.includes("limit")) {
    return ApiError.badRequest(
      "La solicitud es demasiado extensa para procesarla. Reduce la cantidad de datos enviados",
    );
  }

  return ApiError.serviceUnavailable(
    "No se pudo completar la solicitud de inteligencia artificial",
  );
};

const generarContenido = async ({ model, system, user, temperature }) => {
  const client = obtenerCliente();

  const response = await client.models.generateContent({
    model,
    contents: user,
    config: {
      systemInstruction: system,
      temperature,
      responseMimeType: "application/json",
    },
  });

  return extraerTextoRespuesta(response);
};

const invocarGeneracionConReintentos = async (opciones) => {
  const intentosMaximos = maxReintentos();
  let ultimoError = null;

  for (let intento = 0; intento <= intentosMaximos; intento += 1) {
    try {
      return await generarContenido(opciones);
    } catch (error) {
      if (error instanceof ApiError) {
        throw error;
      }

      ultimoError = error;
      registrarFalloGemini(error, opciones.model);

      // Sin cuota en este modelo o modelo inexistente: pasar al siguiente.
      if (esCuotaAgotadaModelo(error) || esErrorModeloNoDisponible(error)) {
        break;
      }

      if (!esErrorTemporal(error) || intento >= intentosMaximos) {
        break;
      }

      const retryDelay = extraerRetryDelayMs(error);
      const esperaMs = Math.min(
        retryDelay ?? baseReintentoMs() * 2 ** intento,
        8000,
      );

      await esperar(esperaMs);
    }
  }

  throw ultimoError;
};

const invocarJson = async ({ system, user, temperature = 0.4 }) => {
  const modelos = obtenerModelos();
  let ultimoError = null;

  for (let index = 0; index < modelos.length; index += 1) {
    const model = modelos[index];
    const hayOtroModelo = index < modelos.length - 1;

    try {
      const content = await invocarGeneracionConReintentos({
        model,
        system,
        user,
        temperature,
      });

      if (!content) {
        throw ApiError.serviceUnavailable(
          "La IA no devolvió una respuesta válida. Intenta de nuevo",
        );
      }

      try {
        return parsearJsonDeTexto(content);
      } catch {
        throw ApiError.serviceUnavailable(
          "La respuesta de la IA no tiene un formato JSON válido",
        );
      }
    } catch (error) {
      ultimoError = error instanceof ApiError ? error : mapearErrorGemini(error);

      if (hayOtroModelo && debeProbarOtroModelo(error)) {
        console.warn(`[IA] Reintentando con el siguiente modelo tras fallar ${model}`);
        continue;
      }

      throw ultimoError;
    }
  }

  if (ultimoError instanceof ApiError) {
    throw ultimoError;
  }

  throw mapearErrorGemini(ultimoError);
};

const esTexto = (valor) => typeof valor === "string" && valor.trim().length > 0;

const esNumeroPositivo = (valor) =>
  typeof valor === "number" && Number.isFinite(valor) && valor > 0;

const validarAlternativas = (alternativas, tipo) => {
  if (tipo === "RESPUESTA_CORTA") {
    return Array.isArray(alternativas) && alternativas.length === 0;
  }

  if (!Array.isArray(alternativas) || alternativas.length < 2) {
    return false;
  }

  const correctas = alternativas.filter((alt) => alt?.esCorrecta === true);
  if (tipo === "VERDADERO_FALSO") {
    return (
      alternativas.length === 2 &&
      correctas.length === 1 &&
      alternativas.every((alt) => esTexto(alt?.texto))
    );
  }

  return (
    alternativas.length >= 3 &&
    correctas.length === 1 &&
    alternativas.every((alt) => esTexto(alt?.texto))
  );
};

const validarPreguntaGenerada = (pregunta, index) => {
  const prefijo = `preguntas[${index}]`;

  if (!pregunta || typeof pregunta !== "object") {
    throw ApiError.serviceUnavailable(`Respuesta IA inválida: ${prefijo} no es un objeto`);
  }

  if (!esTexto(pregunta.enunciado)) {
    throw ApiError.serviceUnavailable(
      `Respuesta IA inválida: ${prefijo}.enunciado es obligatorio`,
    );
  }

  if (!TIPOS_PREGUNTA.includes(pregunta.tipo)) {
    throw ApiError.serviceUnavailable(
      `Respuesta IA inválida: ${prefijo}.tipo debe ser uno de ${TIPOS_PREGUNTA.join(", ")}`,
    );
  }

  if (!NIVELES.includes(pregunta.dificultad)) {
    throw ApiError.serviceUnavailable(
      `Respuesta IA inválida: ${prefijo}.dificultad debe ser uno de ${NIVELES.join(", ")}`,
    );
  }

  if (!esTexto(pregunta.tema) || !esTexto(pregunta.subtema)) {
    throw ApiError.serviceUnavailable(
      `Respuesta IA inválida: ${prefijo} debe incluir tema y subtema`,
    );
  }

  if (!esTexto(pregunta.respuestaCorrecta)) {
    throw ApiError.serviceUnavailable(
      `Respuesta IA inválida: ${prefijo}.respuestaCorrecta es obligatorio`,
    );
  }

  if (!esTexto(pregunta.explicacion)) {
    throw ApiError.serviceUnavailable(
      `Respuesta IA inválida: ${prefijo}.explicacion es obligatorio`,
    );
  }

  const puntaje = Number(pregunta.puntaje);
  if (!esNumeroPositivo(puntaje)) {
    throw ApiError.serviceUnavailable(
      `Respuesta IA inválida: ${prefijo}.puntaje debe ser un número positivo`,
    );
  }

  const respuestaCorrecta = String(pregunta.respuestaCorrecta).trim();
  let alternativas = Array.isArray(pregunta.alternativas)
    ? pregunta.alternativas.map((alt) => ({
        texto: String(alt?.texto ?? "").trim(),
        esCorrecta:
          alt?.esCorrecta === true ||
          alt?.esCorrecta === "true" ||
          alt?.esCorrecta === 1,
      }))
    : [];

  if (pregunta.tipo !== "RESPUESTA_CORTA" && alternativas.length > 0) {
    const correctas = alternativas.filter((alt) => alt.esCorrecta);
    if (correctas.length !== 1) {
      const objetivo = respuestaCorrecta.toLowerCase();
      alternativas = alternativas.map((alt) => ({
        ...alt,
        esCorrecta: alt.texto.toLowerCase() === objetivo,
      }));
    }
  }

  if (!validarAlternativas(alternativas, pregunta.tipo)) {
    throw ApiError.serviceUnavailable(
      `Respuesta IA inválida: ${prefijo}.alternativas no cumple el formato para ${pregunta.tipo}`,
    );
  }

  return {
    enunciado: pregunta.enunciado.trim(),
    tipo: pregunta.tipo,
    alternativas: pregunta.tipo === "RESPUESTA_CORTA" ? [] : alternativas,
    respuestaCorrecta,
    explicacion: pregunta.explicacion.trim(),
    dificultad: pregunta.dificultad,
    tema: pregunta.tema.trim(),
    subtema: pregunta.subtema.trim(),
    puntaje: Math.round(puntaje),
  };
};

const validarDistribucionGenerada = (preguntas, distribucion, nivel) => {
  const real = Object.fromEntries(
    NIVELES_ADAPTATIVOS.map((dificultad) => [
      dificultad,
      preguntas.filter((pregunta) => pregunta.dificultad === dificultad).length,
    ]),
  );
  for (const dificultad of NIVELES_ADAPTATIVOS) {
    if (real[dificultad] !== Number(distribucion[dificultad] ?? 0)) {
      throw ApiError.serviceUnavailable(
        `La variante ${nivel} no pudo validarse: la distribución de dificultad no coincide`,
      );
    }
  }
  return real;
};

const generarPreguntasConEspecificacion = async ({
  areaCurricular,
  curso,
  grado,
  tema,
  subtema,
  nivel,
  cantidadPreguntas,
  distribucion,
  criterios,
  tiposPregunta,
}) => {
  const tipos = tiposPregunta.join(", ");
  const system = [
    "Eres un asistente pedagógico para docentes de secundaria en EvaluaIA.",
    "Genera contenido educativo en español, claro y apropiado para adolescentes.",
    "La IA no decide niveles, notas ni aprobación: solo redacta preguntas según la especificación recibida.",
    "No inventes preguntas genéricas si no puedes cumplir exactamente el formato.",
    "Responde ÚNICAMENTE con JSON válido según el esquema solicitado.",
  ].join(" ");
  const user = JSON.stringify({
    especificacion: {
      areaCurricular,
      curso,
      grado,
      tema,
      subtema,
      nivel,
      cantidadPreguntas,
      distribucion,
      criterios,
      tiposPermitidos: tiposPregunta,
      idioma: "español",
    },
    esquema: {
      preguntas: [{
        enunciado: "string",
        tipo: "OPCION_MULTIPLE | VERDADERO_FALSO | RESPUESTA_CORTA",
        alternativas: "arreglo de { texto, esCorrecta }; vacío solo para RESPUESTA_CORTA",
        respuestaCorrecta: "string",
        explicacion: "string",
        dificultad: "BASICO | INTERMEDIO | AVANZADO",
        tema: "string",
        subtema: "string",
        puntaje: "número positivo",
      }],
    },
    reglas: [
      `Genera exactamente ${cantidadPreguntas} preguntas.`,
      `La distribución exacta debe ser BASICO=${distribucion.BASICO}, INTERMEDIO=${distribucion.INTERMEDIO}, AVANZADO=${distribucion.AVANZADO}.`,
      `Todas las preguntas deben pertenecer a la variante ${nivel}, pero su campo dificultad debe respetar la distribución exacta.`,
      `Usa solamente estos tipos: ${tipos}.`,
      "Cada pregunta debe tener una sola respuesta correcta y puntaje positivo.",
      "No incluyas texto fuera del JSON.",
    ],
  });

  const raw = await invocarJson({ system, user, temperature: 0.35 });
  if (!Array.isArray(raw.preguntas) || raw.preguntas.length !== cantidadPreguntas) {
    throw ApiError.serviceUnavailable(
      `La variante ${nivel} no pudo validarse: cantidad de preguntas incorrecta`,
    );
  }
  const preguntas = raw.preguntas.map((pregunta, index) =>
    validarPreguntaGenerada(pregunta, index),
  );
  const distribucionReal = validarDistribucionGenerada(
    preguntas,
    distribucion,
    nivel,
  );

  return { preguntas, distribucionReal };
};

const validarRetroalimentacionGenerada = (payload) => {
  if (!payload || typeof payload !== "object") {
    throw ApiError.serviceUnavailable("Respuesta IA inválida: formato incorrecto");
  }

  const { fortalezas, temasPorReforzar, explicacionErroresFrecuentes, recomendacionEstudio, siguienteNivelSugerido } =
    payload;

  if (!Array.isArray(fortalezas) || fortalezas.length === 0 || !fortalezas.every(esTexto)) {
    throw ApiError.serviceUnavailable(
      "Respuesta IA inválida: fortalezas debe ser un arreglo de textos no vacío",
    );
  }

  if (
    !Array.isArray(temasPorReforzar) ||
    !temasPorReforzar.every((tema) => typeof tema === "string")
  ) {
    throw ApiError.serviceUnavailable(
      "Respuesta IA inválida: temasPorReforzar debe ser un arreglo de textos",
    );
  }

  if (!esTexto(explicacionErroresFrecuentes)) {
    throw ApiError.serviceUnavailable(
      "Respuesta IA inválida: explicacionErroresFrecuentes es obligatorio",
    );
  }

  if (!esTexto(recomendacionEstudio)) {
    throw ApiError.serviceUnavailable(
      "Respuesta IA inválida: recomendacionEstudio es obligatorio",
    );
  }

  if (!NIVELES.includes(siguienteNivelSugerido)) {
    throw ApiError.serviceUnavailable(
      `Respuesta IA inválida: siguienteNivelSugerido debe ser uno de ${NIVELES.join(", ")}`,
    );
  }

  return {
    fortalezas: fortalezas.map((item) => item.trim()),
    temasPorReforzar: temasPorReforzar.map((item) => item.trim()).filter(Boolean),
    explicacionErroresFrecuentes: explicacionErroresFrecuentes.trim(),
    recomendacionEstudio: recomendacionEstudio.trim(),
    siguienteNivelSugerido,
  };
};

const PERIODOS_CURRICULARES = ["SEMESTRE", "BIMESTRE", "TRIMESTRE"];

const normalizarDescripcion = (valor) => {
  if (valor === undefined || valor === null) return null;
  const texto = String(valor).trim();
  return texto.length > 0 ? texto : null;
};

const validarSubtemaCurricularGenerado = (subtema, prefijo) => {
  if (!subtema || typeof subtema !== "object") {
    throw ApiError.serviceUnavailable(
      `Respuesta IA inválida: ${prefijo} no es un objeto`,
    );
  }
  if (!esTexto(subtema.titulo)) {
    throw ApiError.serviceUnavailable(
      `Respuesta IA inválida: ${prefijo}.titulo es obligatorio`,
    );
  }
  return {
    titulo: subtema.titulo.trim(),
    descripcion: normalizarDescripcion(subtema.descripcion),
  };
};

const validarTemaCurricularGenerado = (tema, prefijo) => {
  if (!tema || typeof tema !== "object") {
    throw ApiError.serviceUnavailable(
      `Respuesta IA inválida: ${prefijo} no es un objeto`,
    );
  }
  if (!esTexto(tema.titulo)) {
    throw ApiError.serviceUnavailable(
      `Respuesta IA inválida: ${prefijo}.titulo es obligatorio`,
    );
  }

  const subtemasRaw = Array.isArray(tema.subtemas) ? tema.subtemas : [];
  const subtemas = subtemasRaw.map((subtema, index) =>
    validarSubtemaCurricularGenerado(subtema, `${prefijo}.subtemas[${index}]`),
  );

  return {
    titulo: tema.titulo.trim(),
    descripcion: normalizarDescripcion(tema.descripcion),
    subtemas,
  };
};

const validarUnidadCurricularGenerada = (unidad, index) => {
  const prefijo = `unidades[${index}]`;

  if (!unidad || typeof unidad !== "object") {
    throw ApiError.serviceUnavailable(
      `Respuesta IA inválida: ${prefijo} no es un objeto`,
    );
  }
  if (!esTexto(unidad.titulo)) {
    throw ApiError.serviceUnavailable(
      `Respuesta IA inválida: ${prefijo}.titulo es obligatorio`,
    );
  }

  const temasRaw = Array.isArray(unidad.temas) ? unidad.temas : [];
  const temas = temasRaw.map((tema, tIndex) =>
    validarTemaCurricularGenerado(tema, `${prefijo}.temas[${tIndex}]`),
  );

  return {
    titulo: unidad.titulo.trim(),
    descripcion: normalizarDescripcion(unidad.descripcion),
    temas,
  };
};

const validarEstructuraCurricularGenerada = (payload) => {
  if (!payload || typeof payload !== "object") {
    throw ApiError.serviceUnavailable("Respuesta IA inválida: formato incorrecto");
  }

  const { periodoSugerido, unidades } = payload;

  if (!PERIODOS_CURRICULARES.includes(periodoSugerido)) {
    throw ApiError.serviceUnavailable(
      `Respuesta IA inválida: periodoSugerido debe ser uno de ${PERIODOS_CURRICULARES.join(", ")}`,
    );
  }

  if (!Array.isArray(unidades) || unidades.length === 0) {
    throw ApiError.serviceUnavailable(
      "Respuesta IA inválida: unidades debe ser un arreglo no vacío",
    );
  }

  const unidadesValidadas = unidades.map((unidad, index) =>
    validarUnidadCurricularGenerada(unidad, index),
  );

  return {
    periodoSugerido,
    unidades: unidadesValidadas,
  };
};

const aiService = {
  async generarVariantesPreguntasBorrador({
    areaCurricular,
    curso,
    grado,
    tema,
    subtema,
    criterios,
    tiposPregunta,
    configuracionAdaptativa,
  }) {
    const configuracion = normalizarConfiguracionAdaptativa(
      configuracionAdaptativa,
    );
    const modelo = obtenerModelos()[0] ?? null;
    const variantes = [];
    let falloGlobal = null;

    // Se procesan secuencialmente para evitar tres ráfagas simultáneas contra
    // la cuota del proyecto y para poder reportar cada variante por separado.
    for (const nivel of NIVELES_ADAPTATIVOS) {
      const regla = configuracion.porNivel[nivel];
      if (falloGlobal) {
        variantes.push({
          nivel,
          estado: "NO_GENERADA",
          cantidadPreguntas: regla.cantidadPreguntas,
          distribucionObjetivo: regla.distribucion,
          generadaPorIA: true,
          fechaGeneracion: new Date().toISOString(),
          modelo,
          error: falloGlobal,
        });
        continue;
      }
      try {
        const resultado = await generarPreguntasConEspecificacion({
          areaCurricular,
          curso,
          grado,
          tema,
          subtema,
          nivel,
          cantidadPreguntas: regla.cantidadPreguntas,
          distribucion: regla.distribucion,
          criterios,
          tiposPregunta,
        });
        variantes.push({
          nivel,
          estado: "GENERADA",
          cantidadPreguntas: regla.cantidadPreguntas,
          distribucionObjetivo: regla.distribucion,
          distribucionReal: resultado.distribucionReal,
          preguntas: resultado.preguntas,
          generadaPorIA: true,
          fechaGeneracion: new Date().toISOString(),
          modelo,
        });
      } catch (error) {
        if ([401, 403, 429, 503].includes(error?.statusCode)) {
          falloGlobal = error.message;
        }
        variantes.push({
          nivel,
          estado: "NO_GENERADA",
          cantidadPreguntas: regla.cantidadPreguntas,
          distribucionObjetivo: regla.distribucion,
          generadaPorIA: true,
          fechaGeneracion: new Date().toISOString(),
          modelo,
          error: error instanceof ApiError
            ? error.message
            : "La variante no pudo generarse ni validarse",
        });
      }
    }

    return { variantes, modelo };
  },

  async generarPreguntasBorrador({
    curso,
    grado,
    tema,
    subtema,
    dificultad,
    cantidadPreguntas,
    tiposPregunta,
  }) {
    const tipos = tiposPregunta.join(", ");
    const system = [
      "Eres un asistente pedagógico para docentes de secundaria en EvaluaIA.",
      "Genera preguntas educativas en español, claras y apropiadas para adolescentes.",
      "Prohibido contenido violento, sexual, discriminatorio o inapropiado.",
      "Responde ÚNICAMENTE con JSON válido según el esquema solicitado.",
      "No publiques ni califiques evaluaciones: solo entrega un borrador de preguntas.",
    ].join(" ");

    const user = JSON.stringify({
      instrucciones: {
        curso,
        grado,
        tema,
        subtema,
        dificultad,
        cantidadPreguntas,
        tiposPermitidos: tiposPregunta,
        idioma: "español",
        audiencia: "estudiantes de secundaria",
      },
      esquema: {
        borrador: true,
        preguntas: [
          {
            enunciado: "string",
            tipo: "OPCION_MULTIPLE | VERDADERO_FALSO | RESPUESTA_CORTA",
            alternativas:
              "arreglo de { texto, esCorrecta } (vacío si es RESPUESTA_CORTA; 2 opciones si es VERDADERO_FALSO; mínimo 3 si es OPCION_MULTIPLE)",
            respuestaCorrecta: "string",
            explicacion: "explicación corta del concepto",
            dificultad: "BASICO | INTERMEDIO | AVANZADO",
            tema: "string",
            subtema: "string",
            puntaje: "número entero positivo (sugerido 1-5)",
          },
        ],
      },
      reglas: [
        `Genera exactamente ${cantidadPreguntas} preguntas.`,
        `Usa solo estos tipos: ${tipos}.`,
        `La dificultad general solicitada es ${dificultad}.`,
        "Distribuye los tipos de forma equilibrada cuando sea posible.",
        "Cada pregunta debe tener exactamente una respuesta correcta.",
      ],
    });

    const raw = await invocarJson({ system, user, temperature: 0.5 });

    if (!Array.isArray(raw.preguntas) || raw.preguntas.length === 0) {
      throw ApiError.serviceUnavailable(
        "La IA no generó preguntas en el formato esperado",
      );
    }

    const preguntas = raw.preguntas
      .slice(0, cantidadPreguntas)
      .map((pregunta, index) => validarPreguntaGenerada(pregunta, index));

    return {
      borrador: true,
      modelo: obtenerModelos()[0] ?? null,
      meta: {
        curso,
        grado,
        tema,
        subtema,
        dificultad,
        cantidadPreguntas: preguntas.length,
        tiposPregunta,
      },
      preguntas,
    };
  },

  async generarRetroalimentacionPedagogica({
    resultadoEvaluacion,
    preguntasFalladas,
    temas,
    subtemas,
    porcentajeObtenido,
    nivelAdaptativo,
  }) {
    const system = [
      "Eres un tutor pedagógico de EvaluaIA para estudiantes de secundaria.",
      "Analiza el desempeño y entrega retroalimentación constructiva en español.",
      "No recalifiques ni modifiques puntajes: solo orienta el estudio.",
      "Responde ÚNICAMENTE con JSON válido según el esquema solicitado.",
    ].join(" ");

    const user = JSON.stringify({
      contexto: {
        resultadoEvaluacion,
        preguntasFalladas,
        temas,
        subtemas,
        porcentajeObtenido,
        nivelAdaptativo,
      },
      esquema: {
        fortalezas: ["string"],
        temasPorReforzar: ["string"],
        explicacionErroresFrecuentes: "string breve",
        recomendacionEstudio: "string breve y accionable",
        siguienteNivelSugerido: "BASICO | INTERMEDIO | AVANZADO",
      },
      reglas: [
        "Menciona fortalezas reales aunque el desempeño sea bajo.",
        "Explica errores frecuentes sin culpar al estudiante.",
        "La recomendación debe ser concreta (qué repasar y cómo).",
        "El siguienteNivelSugerido debe ser coherente con el porcentaje y el nivel adaptativo.",
      ],
    });

    const raw = await invocarJson({ system, user, temperature: 0.3 });
    const retroalimentacion = validarRetroalimentacionGenerada(raw);

    return {
      ...retroalimentacion,
      meta: {
        porcentajeObtenido,
        nivelAdaptativo,
        generadoPorIA: true,
      },
    };
  },

  async extraerEstructuraCurricularDeTexto({
    textoPdf,
    periodoActual,
    nombreArchivo,
    textoTruncado = false,
  }) {
    const system = [
      "Eres un asistente pedagógico de EvaluaIA especializado en organizar planes de estudio.",
      "Analiza únicamente el texto del PDF proporcionado.",
      "No inventes temas, unidades ni subtemas que no aparezcan en el documento.",
      "Organiza el contenido en unidades, temas y subtemas con títulos claros y breves para estudiantes de secundaria.",
      "Conserva el orden lógico o cronológico del documento original.",
      "Responde en español.",
      "Si un contenido es ambiguo, clasifícalo con el título 'Sin clasificar' en lugar de inventar una categoría.",
      "Responde ÚNICAMENTE con JSON válido según el esquema solicitado.",
    ].join(" ");

    const user = JSON.stringify({
      contexto: {
        nombreArchivo,
        periodoActual,
        textoTruncado,
        textoPdf,
      },
      esquema: {
        periodoSugerido: "SEMESTRE | BIMESTRE | TRIMESTRE",
        unidades: [
          {
            titulo: "string",
            descripcion: "string breve opcional",
            temas: [
              {
                titulo: "string",
                descripcion: "string breve opcional",
                subtemas: [
                  {
                    titulo: "string",
                    descripcion: "string breve opcional",
                  },
                ],
              },
            ],
          },
        ],
      },
      reglas: [
        "Usa solamente contenidos presentes en el PDF.",
        "No inventes temas ni rellenes huecos con suposiciones.",
        "periodoSugerido debe reflejar la organización temporal sugerida por el documento.",
        "Cada unidad debe agrupar contenidos relacionados del PDF.",
        "Los subtemas pueden ser un arreglo vacío si el PDF no los detalla.",
        "Prefiere títulos breves y comprensibles para adolescentes.",
      ],
    });

    const raw = await invocarJson({ system, user, temperature: 0.2 });
    return validarEstructuraCurricularGenerada(raw);
  },
};

module.exports = aiService;
