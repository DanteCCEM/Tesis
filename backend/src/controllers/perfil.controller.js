const asyncHandler = require("../utils/asyncHandler");
const ApiError = require("../utils/ApiError");
const perfilService = require("../services/perfil.service");

const parseId = (valor, nombre) => {
  const num = Number(valor);
  if (!Number.isInteger(num) || num <= 0) {
    throw ApiError.badRequest(`${nombre} inválido`);
  }
  return num;
};

const perfilController = {
  // GET /api/perfil
  obtener: asyncHandler(async (req, res) => {
    const perfil = await perfilService.obtenerMiPerfil(req.usuario.id);
    res.status(200).json({ ok: true, perfil });
  }),

  // PUT /api/perfil
  actualizar: asyncHandler(async (req, res) => {
    const perfil = await perfilService.actualizarMiPerfil(req.usuario.id, req.body);
    res.status(200).json({ ok: true, perfil });
  }),

  // GET /api/usuarios/:id/perfil
  obtenerPorId: asyncHandler(async (req, res) => {
    const usuarioId = parseId(req.params.id, "id del usuario");
    const resultado = await perfilService.obtenerPerfilUsuario(req.usuario, usuarioId);
    res.status(200).json({ ok: true, ...resultado });
  }),
};

module.exports = perfilController;
