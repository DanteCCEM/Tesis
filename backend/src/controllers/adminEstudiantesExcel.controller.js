const asyncHandler = require("../utils/asyncHandler");
const service = require("../services/adminEstudiantesExcel.service");

module.exports = {
  plantilla: asyncHandler(async (_req, res) => {
    const buffer = await service.crearPlantilla();
    res.set("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
    res.set("Content-Disposition", 'attachment; filename="plantilla-estudiantes-institucionales.xlsx"');
    res.send(Buffer.from(buffer));
  }),
  importar: asyncHandler(async (req, res) => {
    const resultado = await service.importar(req.file, req.body, req.usuario.id);
    res.set("Cache-Control", "no-store");
    res.set("Pragma", "no-cache");
    res.status(201).json({ ok: true, ...resultado, mensaje: "Copia las credenciales ahora; no podrán volver a consultarse" });
  }),
};
