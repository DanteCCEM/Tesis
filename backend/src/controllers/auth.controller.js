const asyncHandler = require("../utils/asyncHandler");
const authService = require("../services/auth.service");

const authController = {
  login: asyncHandler(async (req, res) => {
    const { token, usuario } = await authService.login(req.body);
    res.status(200).json({ ok: true, token, usuario });
  }),
  perfil: asyncHandler(async (req, res) => {
    const usuario = await authService.obtenerPerfil(req.usuario.id);
    res.status(200).json({ ok: true, usuario });
  }),
  cambiarPassword: asyncHandler(async (req, res) => {
    const { token, usuario } = await authService.cambiarPasswordPropio(
      req.usuario.id,
      req.body,
    );
    res.status(200).json({ ok: true, token, usuario });
  }),
};

module.exports = authController;
