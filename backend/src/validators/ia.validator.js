const ApiError = require("../utils/ApiError");

const NIVELES = ["BASICO", "INTERMEDIO", "AVANZADO"];
const TIPOS_PREGUNTA = ["OPCION_MULTIPLE", "VERDADERO_FALSO", "RESPUESTA_CORTA"];

const esEnteroPositivo = (valor) =>
  Number.isInteger(Number(valor)) && Number(valor) > 0;

const esArregloTextos = (valor) =>
  Array.isArray(valor) && valor.length > 0 && valor.every((item) => String(item).trim());

const validarGenerarPreguntas = (req, res, next) => {
  const {
    curso,
    grado,
    tema,
    subtema,
    dificultad,
    cantidadPreguntas,
    tiposPregunta,
  } = req.body ?? {};
  const errores = [];

  if (!curso || !String(curso).trim()) {
    errores.push("curso es obligatorio");
  }
  if (!grado || !String(grado).trim()) {
    errores.push("grado es obligatorio");
  }
  if (!tema || !String(tema).trim()) {
    errores.push("tema es obligatorio");
  }
  if (!subtema || !String(subtema).trim()) {
    errores.push("subtema es obligatorio");
  }
  if (!dificultad || !NIVELES.includes(dificultad)) {
    errores.push(`dificultad es obligatoria y debe ser una de: ${NIVELES.join(", ")}`);
  }
  if (!esEnteroPositivo(cantidadPreguntas) || Number(cantidadPreguntas) > 20) {
    errores.push("cantidadPreguntas debe ser un entero entre 1 y 20");
  }
  if (!Array.isArray(tiposPregunta) || tiposPregunta.length === 0) {
    errores.push("tiposPregunta debe ser un arreglo no vacío");
  } else {
    const tiposInvalidos = tiposPregunta.filter((tipo) => !TIPOS_PREGUNTA.includes(tipo));
    if (tiposInvalidos.length > 0) {
      errores.push(
        `tiposPregunta contiene valores inválidos: ${tiposInvalidos.join(", ")}`,
      );
    }
  }

  if (errores.length > 0) {
    return next(ApiError.badRequest(errores.join("; ")));
  }

  req.body = {
    curso: String(curso).trim(),
    grado: String(grado).trim(),
    tema: String(tema).trim(),
    subtema: String(subtema).trim(),
    dificultad,
    cantidadPreguntas: Number(cantidadPreguntas),
    tiposPregunta: [...new Set(tiposPregunta)],
  };

  next();
};

const validarGenerarRetroalimentacion = (req, res, next) => {
  const {
    intentoId,
    resultadoEvaluacion,
    preguntasFalladas,
    temas,
    subtemas,
    porcentajeObtenido,
    nivelAdaptativo,
  } = req.body ?? {};
  const errores = [];

  if (!esEnteroPositivo(intentoId)) {
    errores.push("intentoId es obligatorio y debe ser un entero válido");
  }
  if (!resultadoEvaluacion || !String(resultadoEvaluacion).trim()) {
    errores.push("resultadoEvaluacion es obligatorio");
  }
  if (!Array.isArray(preguntasFalladas)) {
    errores.push("preguntasFalladas debe ser un arreglo");
  }
  if (!esArregloTextos(temas)) {
    errores.push("temas debe ser un arreglo de textos no vacío");
  }
  if (!Array.isArray(subtemas) || !subtemas.every((item) => typeof item === "string")) {
    errores.push("subtemas debe ser un arreglo de textos");
  }
  if (
    typeof porcentajeObtenido !== "number" ||
    Number.isNaN(porcentajeObtenido) ||
    porcentajeObtenido < 0 ||
    porcentajeObtenido > 100
  ) {
    errores.push("porcentajeObtenido debe ser un número entre 0 y 100");
  }
  if (!nivelAdaptativo || !NIVELES.includes(nivelAdaptativo)) {
    errores.push(`nivelAdaptativo es obligatorio y debe ser uno de: ${NIVELES.join(", ")}`);
  }

  if (errores.length > 0) {
    return next(ApiError.badRequest(errores.join("; ")));
  }

  req.body = {
    intentoId: Number(intentoId),
    resultadoEvaluacion: String(resultadoEvaluacion).trim(),
    preguntasFalladas,
    temas: temas.map((item) => String(item).trim()),
    subtemas: subtemas.map((item) => String(item).trim()),
    porcentajeObtenido,
    nivelAdaptativo,
  };

  next();
};

module.exports = {
  validarGenerarPreguntas,
  validarGenerarRetroalimentacion,
};
