const asyncHandler = require("../utils/asyncHandler");
const service = require("../services/estructuraAcademica.service");

const crud = (metodoPlural, metodoSingular, clavePlural, claveSingular) => ({
  listar: asyncHandler(async (req, res) => {
    const registros = await service[`listar${metodoPlural}`](req.query.gradoId);
    res.json({ ok: true, [clavePlural]: registros });
  }),
  obtener: asyncHandler(async (req, res) => {
    const registro = await service[`obtener${metodoSingular}`](req.params.id);
    res.json({ ok: true, [claveSingular]: registro });
  }),
  crear: asyncHandler(async (req, res) => {
    const registro = await service[`crear${metodoSingular}`](req.body);
    res.status(201).json({ ok: true, [claveSingular]: registro });
  }),
  actualizar: asyncHandler(async (req, res) => {
    const registro = await service[`actualizar${metodoSingular}`](req.params.id, req.body);
    res.json({ ok: true, [claveSingular]: registro });
  }),
  eliminar: asyncHandler(async (req, res) => {
    await service[`eliminar${metodoSingular}`](req.params.id);
    res.status(204).send();
  }),
});

module.exports = {
  anios: crud("Anios", "Anio", "anios", "anio"),
  grados: crud("Grados", "Grado", "grados", "grado"),
  secciones: crud("Secciones", "Seccion", "secciones", "seccion"),
  areas: crud("Areas", "Area", "areas", "area"),
};
