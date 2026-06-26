const asyncHandler = require("../utils/asyncHandler");
const progresoService = require("../services/progreso.service");

const progresoController = {
  // GET /api/progreso/mi-progreso?cursoId=:cursoId (solo ESTUDIANTE)
  miProgreso: asyncHandler(async (req, res) => {
    const progreso = await progresoService.obtenerMiProgreso(
      req.usuario.id,
      req.query.cursoId,
    );
    res.status(200).json({ ok: true, progreso });
  }),
};

module.exports = progresoController;
