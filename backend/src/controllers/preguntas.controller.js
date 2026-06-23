const asyncHandler = require("../utils/asyncHandler");
const preguntasService = require("../services/preguntas.service");

const preguntasController = {
  listar: asyncHandler(async (req, res) => {
    res.status(200).json({
      ok: true,
      recurso: "preguntas",
      mensaje: "Endpoint de prueba (pendiente de implementación)",
      data: [],
    });
  }),
};

module.exports = preguntasController;
