const test = require("node:test");
const assert = require("node:assert/strict");
const bcrypt = require("bcryptjs");

const cargarServicio = (prismaMock) => {
  const prismaPath = require.resolve("../src/config/prisma");
  const servicePath = require.resolve("../src/services/admin.service");
  require.cache[prismaPath] = {
    id: prismaPath,
    filename: prismaPath,
    loaded: true,
    exports: prismaMock,
    children: [],
    paths: [],
  };
  delete require.cache[servicePath];
  return require(servicePath);
};

test("restablecerPassword guarda un hash, invalida sesiones y audita sin texto plano", async () => {
  let datosActualizacion;
  let datosAuditoria;
  const usuarioActualizado = {
    id: 8,
    username: "docente.prueba",
    contrasena: "hash-no-expuesto",
    sessionVersion: 4,
    debeCambiarPassword: true,
  };
  const tx = {
    usuario: {
      update: async ({ data }) => {
        datosActualizacion = data;
        return usuarioActualizado;
      },
    },
    auditoria: {
      create: async ({ data }) => {
        datosAuditoria = data;
      },
    },
  };
  const prismaMock = {
    usuario: { findUnique: async () => ({ id: 8 }) },
    $transaction: async (callback) => callback(tx),
  };
  const service = cargarServicio(prismaMock);

  const resultado = await service.restablecerPassword(8, 2);

  assert.equal(await bcrypt.compare(resultado.contrasenaTemporal, datosActualizacion.contrasena), true);
  assert.deepEqual(datosActualizacion.sessionVersion, { increment: 1 });
  assert.equal(datosActualizacion.debeCambiarPassword, true);
  assert.equal(datosAuditoria.accion, "PASSWORD_RESET");
  assert.equal(datosAuditoria.usuarioActorId, 2);
  assert.equal(JSON.stringify(datosAuditoria).includes(resultado.contrasenaTemporal), false);
  assert.equal("contrasena" in resultado.usuario, false);
  assert.equal("sessionVersion" in resultado.usuario, false);
});

test("impide desactivar al último administrador activo", async () => {
  let intentoActualizar = false;
  const tx = {
    usuario: {
      findUnique: async () => ({ id: 3, rol: "ADMIN", estado: "ACTIVO" }),
      count: async () => 1,
      update: async () => {
        intentoActualizar = true;
      },
    },
  };
  const prismaMock = {
    $transaction: async (callback) => callback(tx),
  };
  const service = cargarServicio(prismaMock);

  await assert.rejects(
    service.cambiarEstado(3, "INACTIVO", 3),
    (error) => error.statusCode === 409,
  );
  assert.equal(intentoActualizar, false);
});
