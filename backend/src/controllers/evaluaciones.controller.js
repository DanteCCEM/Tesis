const asyncHandler = require("../utils/asyncHandler");
const ApiError = require("../utils/ApiError");
const evaluacionesService = require("../services/evaluaciones.service");
const intentosService = require("../services/intentos.service");

// Convierte un parámetro de ruta en un entero positivo o lanza 400.
const parseId = (valor, nombre) => {
  const num = Number(valor);
  if (!Number.isInteger(num) || num <= 0) {
    throw ApiError.badRequest(`${nombre} inválido`);
  }
  return num;
};

const evaluacionesController = {
  // POST /api/evaluaciones (solo DOCENTE)
  crear: asyncHandler(async (req, res) => {
    const evaluacion = await evaluacionesService.crear(req.body, req.usuario.id);
    res.status(201).json({ ok: true, evaluacion });
  }),

  // POST /api/evaluaciones/:id/preguntas (solo DOCENTE propietario)
  agregarPregunta: asyncHandler(async (req, res) => {
    const evaluacionId = parseId(req.params.id, "id de la evaluación");
    const pregunta = await evaluacionesService.agregarPregunta(
      evaluacionId,
      req.usuario.id,
      req.body,
    );
    res.status(201).json({ ok: true, pregunta });
  }),

  // GET /api/evaluaciones/curso/:cursoId
  listarPorCurso: asyncHandler(async (req, res) => {
    const cursoId = parseId(req.params.cursoId, "id del curso");
    const evaluaciones = await evaluacionesService.listarPorCurso(
      cursoId,
      req.usuario,
    );
    res.status(200).json({ ok: true, evaluaciones });
  }),

  // POST /api/evaluaciones/:id/iniciar (solo ESTUDIANTE matriculado)
  iniciar: asyncHandler(async (req, res) => {
    const evaluacionId = parseId(req.params.id, "id de la evaluación");
    const data = await intentosService.iniciar(evaluacionId, req.usuario);
    res.status(200).json({ ok: true, ...data });
  }),

  // GET /api/evaluaciones/:id/analitica (solo DOCENTE propietario)
  analitica: asyncHandler(async (req, res) => {
    const evaluacionId = parseId(req.params.id, "id de la evaluación");
    const analitica = await evaluacionesService.obtenerAnalitica(
      evaluacionId,
      req.usuario.id,
    );
    res.status(200).json({ ok: true, analitica });
  }),

  // GET /api/evaluaciones/:id
  detalle: asyncHandler(async (req, res) => {
    const evaluacionId = parseId(req.params.id, "id de la evaluación");
    const evaluacion = await evaluacionesService.obtenerDetalle(
      evaluacionId,
      req.usuario,
    );
    res.status(200).json({ ok: true, evaluacion });
  }),

  // PUT /api/evaluaciones/:id/publicar (solo DOCENTE propietario)
  publicar: asyncHandler(async (req, res) => {
    const evaluacionId = parseId(req.params.id, "id de la evaluación");
    const evaluacion = await evaluacionesService.publicar(
      evaluacionId,
      req.usuario.id,
    );
    res.status(200).json({ ok: true, evaluacion });
  }),

  // PUT /api/evaluaciones/:id (solo DOCENTE propietario)
  actualizar: asyncHandler(async (req, res) => {
    const evaluacionId = parseId(req.params.id, "id de la evaluación");
    const evaluacion = await evaluacionesService.actualizar(
      evaluacionId,
      req.usuario.id,
      req.body,
    );
    res.status(200).json({ ok: true, evaluacion });
  }),

  // DELETE /api/evaluaciones/:id (solo DOCENTE propietario)
  eliminar: asyncHandler(async (req, res) => {
    const evaluacionId = parseId(req.params.id, "id de la evaluación");
    await evaluacionesService.eliminar(evaluacionId, req.usuario.id);
    res.status(200).json({ ok: true, mensaje: "Evaluación eliminada" });
  }),
};

module.exports = evaluacionesController;
