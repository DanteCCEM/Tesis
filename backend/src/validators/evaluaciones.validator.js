const ApiError = require("../utils/ApiError");

const NIVELES = ["BASICO", "INTERMEDIO", "AVANZADO"];
const ESTADOS = ["BORRADOR", "PUBLICADA", "CERRADA", "ARCHIVADA"];
const TIPOS_EVALUACION = [
  "REGULAR",
  "DIAGNOSTICA",
  "FORMATIVA_ADAPTATIVA",
  "FINAL",
];
const TIPOS = ["OPCION_MULTIPLE", "VERDADERO_FALSO", "RESPUESTA_CORTA"];
const VF_VALIDOS = ["true", "false", "verdadero", "falso", "v", "f"];

const esEnteroPositivo = (valor) =>
  Number.isInteger(Number(valor)) && Number(valor) > 0;

const esFechaValida = (valor) => !Number.isNaN(new Date(valor).getTime());

const validarConfiguracionAdaptativa = (configuracion, errores, requerida = false) => {
  if (configuracion === undefined || configuracion === null) {
    if (requerida) errores.push("configuracionAdaptativa es obligatoria");
    return;
  }
  if (typeof configuracion !== "object" || Array.isArray(configuracion)) {
    errores.push("configuracionAdaptativa debe ser un objeto JSON");
    return;
  }

  if (
    configuracion.criterios !== undefined &&
    typeof configuracion.criterios !== "string"
  ) {
    errores.push("configuracionAdaptativa.criterios debe ser texto");
  } else if (requerida && !String(configuracion.criterios ?? "").trim()) {
    errores.push("configuracionAdaptativa.criterios es obligatorio");
  }

  if (
    requerida &&
    configuracion.cantidadPorNivel === undefined &&
    configuracion.porNivel === undefined
  ) {
    errores.push("configuracionAdaptativa debe definir porNivel o cantidadPorNivel");
  } else if (configuracion.cantidadPorNivel !== undefined) {
    const cantidades = configuracion.cantidadPorNivel;
    if (!cantidades || typeof cantidades !== "object" || Array.isArray(cantidades)) {
      errores.push("configuracionAdaptativa.cantidadPorNivel debe ser un objeto");
    } else {
      for (const nivel of NIVELES) {
        const cantidad = cantidades[nivel];
        if (requerida && cantidad === undefined) {
          errores.push(`cantidadPorNivel.${nivel} es obligatoria`);
          continue;
        }
        if (
          cantidad !== undefined &&
          (!Number.isInteger(Number(cantidad)) || Number(cantidad) < 1 || Number(cantidad) > 20)
        ) {
          errores.push(`cantidadPorNivel.${nivel} debe ser un entero entre 1 y 20`);
        }
      }
    }
  }

  if (configuracion.porNivel !== undefined) {
    if (!configuracion.porNivel || typeof configuracion.porNivel !== "object") {
      errores.push("configuracionAdaptativa.porNivel debe ser un objeto");
    } else {
      for (const nivel of NIVELES) {
        const regla = configuracion.porNivel[nivel];
        if (!regla || typeof regla !== "object") {
          errores.push(`porNivel.${nivel} es obligatorio`);
          continue;
        }
        const cantidad = Number(regla.cantidadPreguntas);
        if (!Number.isInteger(cantidad) || cantidad < 1 || cantidad > 20) {
          errores.push(`porNivel.${nivel}.cantidadPreguntas debe estar entre 1 y 20`);
        }
        if (!regla.distribucion || typeof regla.distribucion !== "object") {
          errores.push(`porNivel.${nivel}.distribucion es obligatoria`);
          continue;
        }
        const total = NIVELES.reduce((suma, dificultad) => {
          const valor = Number(regla.distribucion[dificultad] ?? 0);
          if (!Number.isInteger(valor) || valor < 0) {
            errores.push(`distribucion.${dificultad} debe ser un entero no negativo`);
            return suma;
          }
          return suma + valor;
        }, 0);
        if (Number.isInteger(cantidad) && total !== cantidad) {
          errores.push(`la distribución de ${nivel} debe sumar ${cantidad}`);
        }
      }
    }
  }
};

// POST /api/evaluaciones
const validarCrearEvaluacion = (req, res, next) => {
  const {
    titulo,
    tema,
    cursoId,
    dificultad,
    nivelDificultad,
    estado,
    fechaLimite,
    temaCurricularId,
    subtemaCurricularId,
    tipoEvaluacion,
    esAdaptativa,
    configuracionAdaptativa,
  } = req.body ?? {};
  const nivel = dificultad ?? nivelDificultad;
  const errores = [];

  if (!titulo || !String(titulo).trim()) {
    errores.push("título es obligatorio");
  }
  if (!tema || !String(tema).trim()) {
    errores.push("tema es obligatorio");
  }
  if (!esEnteroPositivo(cursoId)) {
    errores.push("cursoId es obligatorio y debe ser un entero válido");
  }
  if (!nivel || !NIVELES.includes(nivel)) {
    errores.push(`dificultad es obligatoria y debe ser una de: ${NIVELES.join(", ")}`);
  }
  if (estado !== undefined && !ESTADOS.includes(estado)) {
    errores.push(`estado debe ser uno de: ${ESTADOS.join(", ")}`);
  }
  if (
    fechaLimite !== undefined &&
    fechaLimite !== null &&
    !esFechaValida(fechaLimite)
  ) {
    errores.push("fechaLimite no es una fecha válida");
  }
  if (temaCurricularId !== undefined && temaCurricularId !== null && !esEnteroPositivo(temaCurricularId)) {
    errores.push("temaCurricularId debe ser un entero válido");
  }
  if (subtemaCurricularId !== undefined && subtemaCurricularId !== null && !esEnteroPositivo(subtemaCurricularId)) {
    errores.push("subtemaCurricularId debe ser un entero válido");
  }
  if (tipoEvaluacion !== undefined && !TIPOS_EVALUACION.includes(tipoEvaluacion)) {
    errores.push(`tipoEvaluacion debe ser uno de: ${TIPOS_EVALUACION.join(", ")}`);
  }
  if (esAdaptativa !== undefined && typeof esAdaptativa !== "boolean") {
    errores.push("esAdaptativa debe ser booleano");
  }
  if (["REGULAR", "DIAGNOSTICA", "FINAL"].includes(tipoEvaluacion) && esAdaptativa === true) {
    errores.push(`${tipoEvaluacion} debe ser una evaluación común, no adaptativa`);
  }
  if (tipoEvaluacion === "FORMATIVA_ADAPTATIVA" && esAdaptativa === false) {
    errores.push("FORMATIVA_ADAPTATIVA debe marcarse como adaptativa");
  }
  if (configuracionAdaptativa != null && tipoEvaluacion !== "FORMATIVA_ADAPTATIVA") {
    errores.push("configuracionAdaptativa solo corresponde a FORMATIVA_ADAPTATIVA");
  }
  validarConfiguracionAdaptativa(
    configuracionAdaptativa,
    errores,
    tipoEvaluacion === "FORMATIVA_ADAPTATIVA",
  );

  if (errores.length > 0) {
    return next(ApiError.badRequest(errores.join("; ")));
  }
  next();
};

// PUT /api/evaluaciones/:id
const validarActualizarEvaluacion = (req, res, next) => {
  const {
    titulo,
    tema,
    dificultad,
    nivelDificultad,
    estado,
    fechaLimite,
    temaCurricularId,
    subtemaCurricularId,
    tipoEvaluacion,
    esAdaptativa,
    configuracionAdaptativa,
  } = req.body ?? {};
  const nivel = dificultad ?? nivelDificultad;
  const errores = [];

  if (titulo !== undefined && !String(titulo).trim()) {
    errores.push("título no puede estar vacío");
  }
  if (tema !== undefined && !String(tema).trim()) {
    errores.push("tema no puede estar vacío");
  }
  if (nivel !== undefined && !NIVELES.includes(nivel)) {
    errores.push(`dificultad debe ser una de: ${NIVELES.join(", ")}`);
  }
  if (estado !== undefined && !ESTADOS.includes(estado)) {
    errores.push(`estado debe ser uno de: ${ESTADOS.join(", ")}`);
  }
  if (
    fechaLimite !== undefined &&
    fechaLimite !== null &&
    !esFechaValida(fechaLimite)
  ) {
    errores.push("fechaLimite no es una fecha válida");
  }
  if (temaCurricularId !== undefined && temaCurricularId !== null && !esEnteroPositivo(temaCurricularId)) {
    errores.push("temaCurricularId debe ser un entero válido");
  }
  if (subtemaCurricularId !== undefined && subtemaCurricularId !== null && !esEnteroPositivo(subtemaCurricularId)) {
    errores.push("subtemaCurricularId debe ser un entero válido");
  }
  if (tipoEvaluacion !== undefined && !TIPOS_EVALUACION.includes(tipoEvaluacion)) {
    errores.push(`tipoEvaluacion debe ser uno de: ${TIPOS_EVALUACION.join(", ")}`);
  }
  if (esAdaptativa !== undefined && typeof esAdaptativa !== "boolean") {
    errores.push("esAdaptativa debe ser booleano");
  }
  if (["REGULAR", "DIAGNOSTICA", "FINAL"].includes(tipoEvaluacion) && esAdaptativa === true) {
    errores.push(`${tipoEvaluacion} debe ser una evaluación común, no adaptativa`);
  }
  if (tipoEvaluacion === "FORMATIVA_ADAPTATIVA" && esAdaptativa === false) {
    errores.push("FORMATIVA_ADAPTATIVA debe marcarse como adaptativa");
  }
  if (
    configuracionAdaptativa != null &&
    tipoEvaluacion !== undefined &&
    tipoEvaluacion !== "FORMATIVA_ADAPTATIVA"
  ) {
    errores.push("configuracionAdaptativa solo corresponde a FORMATIVA_ADAPTATIVA");
  }
  validarConfiguracionAdaptativa(
    configuracionAdaptativa,
    errores,
    tipoEvaluacion === "FORMATIVA_ADAPTATIVA",
  );

  if (errores.length > 0) {
    return next(ApiError.badRequest(errores.join("; ")));
  }
  next();
};

// POST /api/evaluaciones/:id/preguntas
const validarPregunta = (req, res, next) => {
  const { enunciado, tipo, dificultad, tema, alternativas, respuestaCorrecta } =
    req.body ?? {};
  const errores = [];

  if (!enunciado || !String(enunciado).trim()) {
    errores.push("enunciado es obligatorio");
  }
  if (!tipo || !TIPOS.includes(tipo)) {
    errores.push(`tipo es obligatorio y debe ser uno de: ${TIPOS.join(", ")}`);
  }
  if (!dificultad || !NIVELES.includes(dificultad)) {
    errores.push(`dificultad es obligatoria y debe ser una de: ${NIVELES.join(", ")}`);
  }
  if (!tema || !String(tema).trim()) {
    errores.push("tema es obligatorio");
  }

  if (tipo === "OPCION_MULTIPLE") {
    if (!Array.isArray(alternativas) || alternativas.length < 2) {
      errores.push("opción múltiple requiere al menos 2 alternativas");
    } else {
      const sinTexto = alternativas.some(
        (alt) => !alt || !String(alt.texto ?? "").trim(),
      );
      if (sinTexto) {
        errores.push("todas las alternativas deben tener texto");
      }
      const correctas = alternativas.filter((alt) => alt && alt.esCorrecta === true);
      if (correctas.length < 1) {
        errores.push("debe haber al menos una alternativa correcta");
      }
    }
  } else if (tipo === "VERDADERO_FALSO") {
    const valor = String(respuestaCorrecta ?? "").trim().toLowerCase();
    if (!VF_VALIDOS.includes(valor)) {
      errores.push("verdadero/falso requiere respuestaCorrecta (verdadero o falso)");
    }
  } else if (tipo === "RESPUESTA_CORTA") {
    if (!respuestaCorrecta || !String(respuestaCorrecta).trim()) {
      errores.push("respuesta corta requiere respuestaCorrecta");
    }
  }

  if (errores.length > 0) {
    return next(ApiError.badRequest(errores.join("; ")));
  }
  next();
};

module.exports = {
  validarCrearEvaluacion,
  validarActualizarEvaluacion,
  validarPregunta,
};
