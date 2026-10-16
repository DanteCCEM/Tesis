const test = require("node:test");
const assert = require("node:assert/strict");

const cargarServicio = (prismaMock) => {
  const prismaPath = require.resolve("../src/config/prisma");
  const servicePath = require.resolve("../src/services/estructuraAcademica.service");
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

test("normaliza el nombre de una sección antes de crearla", async () => {
  let entrada;
  const service = cargarServicio({
    seccion: {
      create: async (args) => {
        entrada = args;
        return { id: 1, ...args.data };
      },
    },
  });

  const seccion = await service.crearSeccion({ gradoId: 2, nombre: " a ", estado: "ACTIVO" });

  assert.equal(entrada.data.nombre, "A");
  assert.equal(seccion.gradoId, 2);
  assert.deepEqual(entrada.include, { grado: true });
});

test("convierte duplicados académicos de Prisma en conflicto HTTP", async () => {
  const error = Object.assign(new Error("duplicate"), { code: "P2002" });
  const service = cargarServicio({
    grado: { create: async () => { throw error; } },
  });

  await assert.rejects(
    service.crearGrado({ nombre: "Primero", orden: 1 }),
    (resultado) => resultado.statusCode === 409 && !resultado.message.includes("P2002"),
  );
});
