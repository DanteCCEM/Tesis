const asyncHandler = require("../utils/asyncHandler");
const matriculasService = require("../services/matriculas.service");

const matriculasController = {
  listar: asyncHandler(async (req, res) => {
    res.status(200).json({
      ok: true,
      recurso: "matriculas",
      mensaje: "Endpoint de prueba (pendiente de implementación)",
      data: [],
    });
  }),
};

module.exports = matriculasController;
