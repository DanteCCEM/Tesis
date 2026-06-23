const prisma = require("../config/prisma");

// Capa de acceso a datos / lógica de negocio para Usuario.
const usuariosService = {
  async listar() {
    // TODO: implementar consulta real con prisma.usuario.findMany()
    return [];
  },
};

module.exports = usuariosService;
