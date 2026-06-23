const asyncHandler = require("../utils/asyncHandler");
const ApiError = require("../utils/ApiError");
const intentosService = require("../services/intentos.service");

const parseId = (valor, nombre) => {
  const num = Number(valor);
  if (!Number.isInteger(num) || num <= 0) {
    throw ApiError.badRequest(`${nombre} inválido`);
  }
  return num;
};

const intentosController = {
  // POST /api/intentos/:intentoId/respuestas (solo ESTUDIANTE dueño)
  guardarRespuesta: asyncHandler(async (req, res) => {
    const intentoId = parseId(req.params.intentoId, "id del intento");
    const respuesta = await intentosService.guardarRespuesta(
      intentoId,
      req.usuario,
      req.body,
    );
    res.status(200).json({ ok: true, respuesta });
  }),

  // POST /api/intentos/:intentoId/finalizar (solo ESTUDIANTE dueño)
  finalizar: asyncHandler(async (req, res) => {
    const intentoId = parseId(req.params.intentoId, "id del intento");
    const resultado = await intentosService.finalizar(intentoId, req.usuario);
    res.status(200).json({ ok: true, resultado });
  }),

  // GET /api/intentos/:intentoId/resultados (estudiante dueño o docente del curso)
  resultados: asyncHandler(async (req, res) => {
    const intentoId = parseId(req.params.intentoId, "id del intento");
    const resultado = await intentosService.obtenerResultados(
      intentoId,
      req.usuario,
    );
    res.status(200).json({ ok: true, resultado });
  }),
};

module.exports = intentosController;
