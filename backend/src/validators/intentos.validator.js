const ApiError = require("../utils/ApiError");

const esEnteroPositivo = (valor) =>
  Number.isInteger(Number(valor)) && Number(valor) > 0;

// POST /api/intentos/:intentoId/respuestas
const validarRespuesta = (req, res, next) => {
  const { preguntaId, respuestaTexto, alternativaId } = req.body ?? {};
  const errores = [];

  if (!esEnteroPositivo(preguntaId)) {
    errores.push("preguntaId es obligatorio y debe ser un entero válido");
  }

  const tieneTexto =
    respuestaTexto !== undefined &&
    respuestaTexto !== null &&
    String(respuestaTexto).trim() !== "";
  const tieneAlternativa =
    alternativaId !== undefined && alternativaId !== null && alternativaId !== "";

  if (!tieneTexto && !tieneAlternativa) {
    errores.push("Debes enviar respuestaTexto o alternativaId");
  }
  if (tieneAlternativa && !esEnteroPositivo(alternativaId)) {
    errores.push("alternativaId debe ser un entero válido");
  }

  if (errores.length > 0) {
    return next(ApiError.badRequest(errores.join("; ")));
  }
  next();
};

module.exports = { validarRespuesta };
