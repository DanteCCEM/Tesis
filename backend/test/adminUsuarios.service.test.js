const test = require("node:test");
const assert = require("node:assert/strict");
const bcrypt = require("bcryptjs");

const cargarServicio = (prismaMock) => {
  const prismaPath = require.resolve("../src/config/prisma");
  const servicePath = require.resolve("../src/services/adminUsuarios.service");
  require.cache[prismaPath] = {
    id: prismaPath, filename: prismaPath, loaded: true, exports: prismaMock, children: [], paths: [],
  };
  delete require.cache[servicePath];
  return require(servicePath);
};

test("crea docente con contraseña hasheada y auditoría sin texto plano", async () => {
  let usuarioCreado;
  let auditoria;
  const tx = {
    usuario: {
      findUnique: async ({ where, select }) => {
        if (select?.id && !usuarioCreado) return null;
        return { id: 20, username: where.id ? "ana.perez" : where.username, rol: "DOCENTE" };
      },
      create: async ({ data }) => {
        usuarioCreado = { id: 20, ...data };
        return usuarioCreado;
      },
    },
    perfilDocente: { create: async () => ({ id: 1 }) },
    auditoria: { create: async ({ data }) => { auditoria = data; } },
  };
  const service = cargarServicio({ $transaction: async (callback) => callback(tx) });
  const resultado = await service.crear("DOCENTE", {
    dni: "12345678", nombres: "Ana", apellidoPaterno: "Pérez", apellidoMaterno: "López",
  }, 1);

  assert.equal(await bcrypt.compare(resultado.contrasenaTemporal, usuarioCreado.contrasena), true);
  assert.equal(usuarioCreado.debeCambiarPassword, true);
  assert.equal(auditoria.accion, "USER_CREATED");
  assert.equal(JSON.stringify(auditoria).includes(resultado.contrasenaTemporal), false);
});

test("rechaza un username solicitado que ya existe", async () => {
  const tx = { usuario: { findUnique: async () => ({ id: 9 }) } };
  const service = cargarServicio({ $transaction: async (callback) => callback(tx) });
  await assert.rejects(
    service.crear("ESTUDIANTE", {
      username: "ocupado", dni: "87654321", nombres: "Luis",
      apellidoPaterno: "Ramos", apellidoMaterno: "Díaz",
    }, 1),
    (error) => error.statusCode === 409,
  );
});
