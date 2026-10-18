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

  // GET /api/progreso/evolucion (solo ESTUDIANTE)
  miEvolucion: asyncHandler(async (req, res) => {
    const evolucion = await progresoService.obtenerMiEvolucion(
      req.usuario.id,
      req.query,
    );
    res.status(200).json({ ok: true, evolucion });
  }),

  // GET /api/progreso/docente/asignaciones/:asignacionCursoId/estudiantes/:estudianteId/evolucion
  evolucionDocente: asyncHandler(async (req, res) => {
    const evolucion = await progresoService.obtenerEvolucionDocente(
      req.usuario.id,
      req.params.asignacionCursoId,
      req.params.estudianteId,
      req.query,
    );
    res.status(200).json({ ok: true, evolucion });
  }),

  // GET /api/progreso/admin/estudiantes/:estudianteId/evolucion (solo lectura)
  evolucionAdmin: asyncHandler(async (req, res) => {
    const evolucion = await progresoService.obtenerEvolucionAdmin(
      req.params.estudianteId,
      req.query,
    );
    res.status(200).json({ ok: true, evolucion });
  }),
};

module.exports = progresoController;
