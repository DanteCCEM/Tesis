const asyncHandler = require("../utils/asyncHandler");
const ApiError = require("../utils/ApiError");
const cursosService = require("../services/cursos.service");

const parseId = (valor) => {
  const id = Number(valor);
  if (!Number.isInteger(id) || id <= 0) throw ApiError.badRequest("id del curso inválido");
  return id;
};

const cursosController = {
  misCursos: asyncHandler(async (req, res) => {
    const cursos = await cursosService.listarMisCursos(req.usuario);
    res.json({ ok: true, cursos });
  }),
  detalle: asyncHandler(async (req, res) => {
    const cursoId = parseId(req.params.id);
    const curso = req.usuario.rol === "DOCENTE"
      ? await cursosService.obtenerDetalleDocente(cursoId, req.usuario.id)
      : await cursosService.obtenerDetalleEstudiante(cursoId, req.usuario.id);
    res.json({ ok: true, curso });
  }),
  resumenEstudiantes: asyncHandler(async (req, res) => {
    const estudiantes = await cursosService.resumenEstudiantes(parseId(req.params.id), req.usuario.id);
    res.json({ ok: true, estudiantes });
  }),
};

module.exports = cursosController;
