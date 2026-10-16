const asyncHandler = require("../utils/asyncHandler");
const service = require("../services/adminUsuarios.service");

const controladorRol = (rol) => ({
  listar: asyncHandler(async (req, res) => {
    const resultado = await service.listar(rol, req.query);
    res.json({ ok: true, ...resultado });
  }),
  crear: asyncHandler(async (req, res) => {
    const resultado = await service.crear(rol, req.body, req.usuario.id);
    res.set("Cache-Control", "no-store");
    res.set("Pragma", "no-cache");
    res.status(201).json({
      ok: true,
      ...resultado,
      mensaje: "Copia la contraseña temporal ahora; no podrá volver a consultarse",
    });
  }),
  actualizar: asyncHandler(async (req, res) => {
    const usuario = await service.actualizar(rol, req.params.id, req.body, req.usuario.id);
    res.json({ ok: true, usuario });
  }),
});

const docentes = controladorRol("DOCENTE");
const estudiantes = controladorRol("ESTUDIANTE");

docentes.asignaciones = asyncHandler(async (req, res) => {
  const asignaciones = await service.asignacionesDocente(req.params.id);
  res.json({ ok: true, asignaciones });
});

estudiantes.matricula = asyncHandler(async (req, res) => {
  const matricula = await service.cambiarMatricula(req.params.id, req.body, req.usuario.id);
  res.json({ ok: true, matricula });
});

estudiantes.rendimiento = asyncHandler(async (req, res) => {
  const rendimiento = await service.rendimientoEstudiante(req.params.id);
  res.json({ ok: true, rendimiento });
});

module.exports = { docentes, estudiantes };
