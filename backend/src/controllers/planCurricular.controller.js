const asyncHandler = require("../utils/asyncHandler");
const ApiError = require("../utils/ApiError");
const planCurricularService = require("../services/planCurricular.service");

const parseId = (valor, nombre) => {
  const num = Number(valor);
  if (!Number.isInteger(num) || num <= 0) {
    throw ApiError.badRequest(`${nombre} inválido`);
  }
  return num;
};

const planCurricularController = {
  // POST /api/cursos/:cursoId/plan-curricular
  crearPorCurso: asyncHandler(async (req, res) => {
    const cursoId = parseId(req.params.cursoId ?? req.params.id, "cursoId");
    const plan = await planCurricularService.crearPlan(
      cursoId,
      req.usuario.id,
      req.body,
      req.file,
    );
    res.status(201).json({ ok: true, plan });
  }),

  // GET /api/cursos/:cursoId/plan-curricular
  listarPorCurso: asyncHandler(async (req, res) => {
    const cursoId = parseId(req.params.cursoId ?? req.params.id, "cursoId");
    const planes = await planCurricularService.listarPorCurso(
      cursoId,
      req.usuario,
    );
    res.status(200).json({ ok: true, planes });
  }),

  // GET /api/plan-curricular/:planId
  detalle: asyncHandler(async (req, res) => {
    const planId = parseId(req.params.planId, "planId");
    const plan = await planCurricularService.obtenerPlanDetalle(
      planId,
      req.usuario,
    );
    res.status(200).json({ ok: true, plan });
  }),

  // PUT /api/plan-curricular/:planId
  actualizar: asyncHandler(async (req, res) => {
    const planId = parseId(req.params.planId, "planId");
    const plan = await planCurricularService.actualizarPlan(
      planId,
      req.usuario.id,
      req.body,
    );
    res.status(200).json({ ok: true, plan });
  }),

  // PUT /api/plan-curricular/:planId/publicar
  publicar: asyncHandler(async (req, res) => {
    const planId = parseId(req.params.planId, "planId");
    const plan = await planCurricularService.publicarPlan(
      planId,
      req.usuario.id,
    );
    res.status(200).json({ ok: true, plan });
  }),

  // POST /api/plan-curricular/:planId/unidades
  crearUnidad: asyncHandler(async (req, res) => {
    const planId = parseId(req.params.planId, "planId");
    const unidad = await planCurricularService.crearUnidad(
      planId,
      req.usuario.id,
      req.body,
    );
    res.status(201).json({ ok: true, unidad });
  }),

  // PUT /api/unidades-curriculares/:unidadId
  actualizarUnidad: asyncHandler(async (req, res) => {
    const unidadId = parseId(req.params.unidadId, "unidadId");
    const unidad = await planCurricularService.actualizarUnidad(
      unidadId,
      req.usuario.id,
      req.body,
    );
    res.status(200).json({ ok: true, unidad });
  }),

  // DELETE /api/unidades-curriculares/:unidadId
  eliminarUnidad: asyncHandler(async (req, res) => {
    const unidadId = parseId(req.params.unidadId, "unidadId");
    const resultado = await planCurricularService.eliminarUnidad(
      unidadId,
      req.usuario.id,
    );
    res.status(200).json(resultado);
  }),

  // POST /api/unidades-curriculares/:unidadId/temas
  crearTema: asyncHandler(async (req, res) => {
    const unidadId = parseId(req.params.unidadId, "unidadId");
    const tema = await planCurricularService.crearTema(
      unidadId,
      req.usuario.id,
      req.body,
    );
    res.status(201).json({ ok: true, tema });
  }),

  // PUT /api/temas-curriculares/:temaId
  actualizarTema: asyncHandler(async (req, res) => {
    const temaId = parseId(req.params.temaId, "temaId");
    const tema = await planCurricularService.actualizarTema(
      temaId,
      req.usuario.id,
      req.body,
    );
    res.status(200).json({ ok: true, tema });
  }),

  // DELETE /api/temas-curriculares/:temaId
  eliminarTema: asyncHandler(async (req, res) => {
    const temaId = parseId(req.params.temaId, "temaId");
    const resultado = await planCurricularService.eliminarTema(
      temaId,
      req.usuario.id,
    );
    res.status(200).json(resultado);
  }),

  // POST /api/temas-curriculares/:temaId/subtemas
  crearSubtema: asyncHandler(async (req, res) => {
    const temaId = parseId(req.params.temaId, "temaId");
    const subtema = await planCurricularService.crearSubtema(
      temaId,
      req.usuario.id,
      req.body,
    );
    res.status(201).json({ ok: true, subtema });
  }),

  // PUT /api/subtemas-curriculares/:subtemaId
  actualizarSubtema: asyncHandler(async (req, res) => {
    const subtemaId = parseId(req.params.subtemaId, "subtemaId");
    const subtema = await planCurricularService.actualizarSubtema(
      subtemaId,
      req.usuario.id,
      req.body,
    );
    res.status(200).json({ ok: true, subtema });
  }),

  // DELETE /api/subtemas-curriculares/:subtemaId
  eliminarSubtema: asyncHandler(async (req, res) => {
    const subtemaId = parseId(req.params.subtemaId, "subtemaId");
    const resultado = await planCurricularService.eliminarSubtema(
      subtemaId,
      req.usuario.id,
    );
    res.status(200).json(resultado);
  }),

  // POST /api/plan-curricular/:planId/procesar-pdf
  procesarPdf: asyncHandler(async (req, res) => {
    const planId = parseId(req.params.planId, "planId");
    const resultado = await planCurricularService.procesarPdf(
      planId,
      req.usuario.id,
      req.body,
    );
    res.status(200).json({ ok: true, ...resultado });
  }),
};

module.exports = planCurricularController;
