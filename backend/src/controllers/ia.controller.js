const asyncHandler = require("../utils/asyncHandler");
const iaService = require("../services/ia.service");

const iaController = {
  // POST /api/ia/generar-preguntas (solo DOCENTE)
  generarPreguntas: asyncHandler(async (req, res) => {
    const resultado = await iaService.generarPreguntas(req.body, req.usuario);
    res.status(200).json(resultado);
  }),

  // POST /api/ia/generar-retroalimentacion (estudiante dueño o docente del curso)
  generarRetroalimentacion: asyncHandler(async (req, res) => {
    const resultado = await iaService.generarRetroalimentacion(req.body, req.usuario);
    res.status(200).json(resultado);
  }),
};

module.exports = iaController;
