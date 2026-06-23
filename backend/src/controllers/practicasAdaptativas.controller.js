const asyncHandler = require("../utils/asyncHandler");
const practicasAdaptativasService = require("../services/practicasAdaptativas.service");

const practicasAdaptativasController = {
  // POST /api/practicas-adaptativas/generar (solo ESTUDIANTE)
  generar: asyncHandler(async (req, res) => {
    const resultado = await practicasAdaptativasService.generar(
      req.usuario.id,
      req.body,
    );
    res.status(201).json({ ok: true, ...resultado });
  }),
};

module.exports = practicasAdaptativasController;
