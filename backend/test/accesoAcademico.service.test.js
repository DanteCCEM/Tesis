const test = require("node:test");
const assert = require("node:assert/strict");

const curso = {
  id: 8,
  asignacionCurso: {
    id: 12,
    docenteId: 4,
    seccionId: 3,
    anioAcademicoId: 2,
    estado: "ACTIVO",
  },
};

const cargar = (matricula) => {
  const prismaPath = require.resolve("../src/config/prisma");
  const servicePath = require.resolve("../src/services/accesoAcademico.service");
  require.cache[prismaPath] = {
    id: prismaPath,
    filename: prismaPath,
    loaded: true,
    exports: {
      curso: { findUnique: async () => curso },
      matriculaAcademica: { findFirst: async () => matricula },
    },
    children: [],
    paths: [],
  };
  delete require.cache[servicePath];
  return require(servicePath);
};

test("rechaza al estudiante sin matrícula en la sección y año del curso", async () => {
  const service = cargar(null);
  await assert.rejects(
    service.verificarEstudianteCurso(8, 99),
    (error) => error.statusCode === 403,
  );
});

test("autoriza al estudiante matriculado en la sección y año del curso", async () => {
  const service = cargar({ id: 20 });
  const resultado = await service.verificarEstudianteCurso(8, 99);
  assert.equal(resultado.id, 8);
});

test("rechaza al docente que no es responsable de la asignación", async () => {
  const service = cargar(null);
  await assert.rejects(
    service.verificarDocenteCurso(8, 77),
    (error) => error.statusCode === 403,
  );
});
