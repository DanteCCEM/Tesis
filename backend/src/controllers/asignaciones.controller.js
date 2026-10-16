const asyncHandler = require("../utils/asyncHandler");
const service = require("../services/asignaciones.service");

module.exports = {
  listar: asyncHandler(async (_req, res) => res.json({ ok: true, asignaciones: await service.listar() })),
  crear: asyncHandler(async (req, res) => res.status(201).json({ ok: true, asignacion: await service.crear(req.body, req.usuario.id) })),
  actualizar: asyncHandler(async (req, res) => res.json({ ok: true, asignacion: await service.actualizar(req.params.id, req.body, req.usuario.id) })),
};
