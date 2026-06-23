const prisma = require("../config/prisma");

// Capa de acceso a datos / lógica de negocio para Pregunta.
const preguntasService = {
  async listar() {
    // TODO: implementar consulta real con prisma.pregunta.findMany()
    return [];
  },
};

module.exports = preguntasService;
