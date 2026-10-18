const test = require("node:test");
const assert = require("node:assert/strict");

const cargarServicio = (nivelActual = "BASICO") => {
  const prismaPath = require.resolve("../src/config/prisma");
  const servicePath = require.resolve("../src/services/adaptiveEvaluation.service");
  require.cache[prismaPath] = {
    id: prismaPath,
    filename: prismaPath,
    loaded: true,
    exports: {
      progresoEstudiante: {
        findFirst: async () => ({ nivelActual }),
        findUnique: async () => ({ nivelActual }),
      },
    },
    children: [],
    paths: [],
  };
  delete require.cache[servicePath];
  return require(servicePath);
};

const banco = [
  ...Array.from({ length: 8 }, (_, i) => ({ id: i + 1, dificultad: "BASICO" })),
  ...Array.from({ length: 6 }, (_, i) => ({ id: i + 20, dificultad: "INTERMEDIO" })),
  ...Array.from({ length: 5 }, (_, i) => ({ id: i + 40, dificultad: "AVANZADO" })),
];

const evaluacion = {
  id: 10,
  cursoId: 20,
  tema: "Fracciones",
  temaCurricularId: 30,
  tipoEvaluacion: "FORMATIVA_ADAPTATIVA",
  nivelDificultad: "INTERMEDIO",
  configuracionAdaptativa: null,
  preguntas: banco,
};

for (const [nivel, cantidad, distribucion] of [
  ["BASICO", 10, { BASICO: 7, INTERMEDIO: 3, AVANZADO: 0 }],
  ["INTERMEDIO", 7, { BASICO: 2, INTERMEDIO: 4, AVANZADO: 1 }],
  ["AVANZADO", 5, { BASICO: 0, INTERMEDIO: 1, AVANZADO: 4 }],
]) {
  test(`crea la variante ${nivel} con su cantidad y distribución`, async () => {
    const service = cargarServicio(nivel);
    const especificacion = await service.crearEspecificacion({
      evaluacion,
      estudianteId: 99,
    });

    assert.equal(especificacion.adaptativa, true);
    assert.equal(especificacion.nivelAlRendir, nivel);
    assert.equal(especificacion.dificultadVariante, nivel);
    assert.equal(especificacion.cantidadPreguntas, cantidad);
    assert.deepEqual(especificacion.distribucionReal, distribucion);
    assert.equal(new Set(especificacion.preguntasIds).size, cantidad);
  });
}

test("completa la cantidad con otras dificultades si la mezcla sugerida no está disponible", () => {
  const service = cargarServicio("BASICO");
  const preguntas = [
    { id: 1, dificultad: "BASICO" },
    { id: 2, dificultad: "INTERMEDIO" },
    { id: 3, dificultad: "INTERMEDIO" },
  ];
  const resultado = service.seleccionarPreguntas({
    preguntas,
    distribucion: { BASICO: 3, INTERMEDIO: 0, AVANZADO: 0 },
    cantidad: 3,
    nivel: "BASICO",
    semilla: "prueba",
  });

  assert.equal(resultado.seleccionadas.length, 3);
  assert.deepEqual(resultado.distribucionReal, {
    BASICO: 1,
    INTERMEDIO: 2,
    AVANZADO: 0,
  });
});

test("rechaza una variante cuando el banco total es insuficiente", () => {
  const service = cargarServicio("BASICO");
  assert.throws(
    () =>
      service.seleccionarPreguntas({
        preguntas: banco.slice(0, 2),
        distribucion: { BASICO: 3, INTERMEDIO: 0, AVANZADO: 0 },
        cantidad: 3,
        nivel: "BASICO",
        semilla: "prueba",
      }),
    /requiere 3 preguntas/,
  );
});
