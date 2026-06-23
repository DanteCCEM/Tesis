const ApiError = require("../utils/ApiError");

const NIVELES = ["BASICO", "INTERMEDIO", "AVANZADO"];
const ESTADOS = ["BORRADOR", "PUBLICADA", "CERRADA"];
const TIPOS = ["OPCION_MULTIPLE", "VERDADERO_FALSO", "RESPUESTA_CORTA"];
const VF_VALIDOS = ["true", "false", "verdadero", "falso", "v", "f"];

const esEnteroPositivo = (valor) =>
  Number.isInteger(Number(valor)) && Number(valor) > 0;

const esFechaValida = (valor) => !Number.isNaN(new Date(valor).getTime());

// POST /api/evaluaciones
const validarCrearEvaluacion = (req, res, next) => {
  const { titulo, tema, cursoId, dificultad, nivelDificultad, estado, fechaLimite } =
    req.body ?? {};
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

  if (errores.length > 0) {
    return next(ApiError.badRequest(errores.join("; ")));
  }
  next();
};

// PUT /api/evaluaciones/:id
const validarActualizarEvaluacion = (req, res, next) => {
  const { titulo, tema, dificultad, nivelDificultad, estado, fechaLimite } =
    req.body ?? {};
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
