const asyncHandler = require("../utils/asyncHandler");
const usuariosService = require("../services/usuarios.service");

const usuariosController = {
  listar: asyncHandler(async (req, res) => {
    res.status(200).json({
      ok: true,
      recurso: "usuarios",
      mensaje: "Endpoint de prueba (pendiente de implementación)",
      data: [],
    });
  }),
};

module.exports = usuariosController;
