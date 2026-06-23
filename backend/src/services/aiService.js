const OpenAI = require("openai");
const ApiError = require("../utils/ApiError");

const NIVELES = ["BASICO", "INTERMEDIO", "AVANZADO"];
const TIPOS_PREGUNTA = ["OPCION_MULTIPLE", "VERDADERO_FALSO", "RESPUESTA_CORTA"];

let openaiClient = null;

const obtenerCliente = () => {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey || !String(apiKey).trim()) {
    throw ApiError.serviceUnavailable(
      "El servicio de inteligencia artificial no está configurado",
    );
  }
  if (!openaiClient) {
    openaiClient = new OpenAI({ apiKey });
  }
  return openaiClient;
};

const obtenerModelo = () => process.env.OPENAI_MODEL || "gpt-4o-mini";

const esTexto = (valor) => typeof valor === "string" && valor.trim().length > 0;

const esNumeroPositivo = (valor) =>
  typeof valor === "number" && Number.isFinite(valor) && valor > 0;

const mapearErrorOpenAI = (error) => {
  const status = error?.status ?? error?.response?.status;
  const code = error?.code ?? error?.error?.code;

  if (status === 429 || code === "rate_limit_exceeded") {
    return ApiError.tooManyRequests(
      "Se alcanzó el límite de uso del servicio de IA. Intenta de nuevo en unos minutos",
    );
  }
  if (status === 401 || status === 403) {
    return ApiError.serviceUnavailable(
      "El servicio de inteligencia artificial no está disponible temporalmente",
    );
  }
  if (status === 503 || code === "server_overloaded") {
    return ApiError.serviceUnavailable(
      "El servicio de inteligencia artificial está saturado. Intenta más tarde",
    );
  }
  if (code === "context_length_exceeded") {
    return ApiError.badRequest(
      "La solicitud es demasiado extensa para procesarla. Reduce la cantidad de datos enviados",
    );
  }

  return ApiError.serviceUnavailable(
    "No se pudo completar la solicitud de inteligencia artificial",
  );
};

const invocarJson = async ({ system, user, temperature = 0.4 }) => {
  const client = obtenerCliente();

  try {
    const completion = await client.chat.completions.create({
      model: obtenerModelo(),
      temperature,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: system },
        { role: "user", content: user },
      ],
    });

    const content = completion.choices?.[0]?.message?.content;
    if (!content) {
      throw ApiError.serviceUnavailable(
        "La IA no devolvió una respuesta válida. Intenta de nuevo",
      );
    }

    try {
      return JSON.parse(content);
    } catch {
      throw ApiError.serviceUnavailable(
        "La respuesta de la IA no tiene un formato JSON válido",
      );
    }
  } catch (error) {
    if (error instanceof ApiError) {
      throw error;
    }
    throw mapearErrorOpenAI(error);
  }
};

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

  if (!esNumeroPositivo(pregunta.puntaje)) {
    throw ApiError.serviceUnavailable(
      `Respuesta IA inválida: ${prefijo}.puntaje debe ser un número positivo`,
    );
  }

  const alternativas = Array.isArray(pregunta.alternativas) ? pregunta.alternativas : [];
  if (!validarAlternativas(alternativas, pregunta.tipo)) {
    throw ApiError.serviceUnavailable(
      `Respuesta IA inválida: ${prefijo}.alternativas no cumple el formato para ${pregunta.tipo}`,
    );
  }

  return {
    enunciado: pregunta.enunciado.trim(),
    tipo: pregunta.tipo,
    alternativas:
      pregunta.tipo === "RESPUESTA_CORTA"
        ? []
        : alternativas.map((alt) => ({
            texto: String(alt.texto).trim(),
            esCorrecta: alt.esCorrecta === true,
          })),
    respuestaCorrecta: pregunta.respuestaCorrecta.trim(),
    explicacion: pregunta.explicacion.trim(),
    dificultad: pregunta.dificultad,
    tema: pregunta.tema.trim(),
    subtema: pregunta.subtema.trim(),
    puntaje: Math.round(pregunta.puntaje),
  };
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

const aiService = {
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
};

module.exports = aiService;
