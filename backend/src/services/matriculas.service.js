const prisma = require("../config/prisma");

// Capa de acceso a datos / lógica de negocio para Matricula.
const matriculasService = {
  async listar() {
    // TODO: implementar consulta real con prisma.matricula.findMany()
    return [];
  },
};

module.exports = matriculasService;
