const asyncHandler = require("../utils/asyncHandler");
const adminService = require("../services/admin.service");

const adminController = {
  crearUsuario: asyncHandler(async (req, res) => {
    const usuario = await adminService.crearUsuario(req.body);
    res.status(201).json({ ok: true, usuario });
  }),
  restablecerPassword: asyncHandler(async (req, res) => {
    const resultado = await adminService.restablecerPassword(
      req.params.id,
      req.usuario.id,
    );
    res.set("Cache-Control", "no-store");
    res.set("Pragma", "no-cache");
    res.status(200).json({
      ok: true,
      ...resultado,
      mensaje: "Copia la contraseña temporal ahora; no podrá volver a consultarse",
    });
  }),
  cambiarEstado: asyncHandler(async (req, res) => {
    const usuario = await adminService.cambiarEstado(
      req.params.id,
      req.body.estado,
      req.usuario.id,
    );
    res.status(200).json({ ok: true, usuario });
  }),
};

module.exports = adminController;
