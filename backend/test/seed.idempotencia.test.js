const test = require("node:test");
const assert = require("node:assert/strict");

const cargarSeed = (prismaMock) => {
  const prismaPath = require.resolve("../src/config/prisma");
  const seedPath = require.resolve("../prisma/seed.js");
  require.cache[prismaPath] = {
    id: prismaPath,
    filename: prismaPath,
    loaded: true,
    exports: prismaMock,
    children: [],
    paths: [],
  };
  delete require.cache[seedPath];
  return require(seedPath);
};

test("el seed reutiliza una cuenta existente sin actualizarla", async () => {
  const existente = {
    id: 7,
    username: "admin.institucional",
    correo: "admin@institucion.edu",
    contrasena: "hash-original",
    rol: "ADMIN",
    nombres: "Administrador original",
  };
  let creaciones = 0;
  const seed = cargarSeed({
    usuario: {
      findUnique: async ({ where }) =>
        where.username === existente.username || where.correo === existente.correo
          ? existente
          : null,
      create: async () => {
        creaciones += 1;
        return existente;
      },
    },
  });

  const resultado = await seed.upsertUsuario({
    username: existente.username,
    correo: existente.correo,
    nombres: "Nombre que no debe sobrescribir",
    contrasena: "nueva-clave-que-no-debe-usarse",
    rol: "ADMIN",
  });

  assert.equal(resultado, existente);
  assert.equal(creaciones, 0);
  assert.equal(resultado.contrasena, "hash-original");
});

test("el seed detecta username y correo pertenecientes a usuarios distintos", async () => {
  const seed = cargarSeed({
    usuario: {
      findUnique: async ({ where }) =>
        where.username ? { id: 1 } : { id: 2 },
    },
  });

  await assert.rejects(
    seed.upsertUsuario({
      username: "admin.duplicado",
      correo: "otro@institucion.edu",
      nombres: "Administrador",
      contrasena: "clave-segura",
      rol: "ADMIN",
    }),
    /pertenecen a usuarios diferentes/,
  );
});
