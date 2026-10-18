const test = require("node:test");
const assert = require("node:assert/strict");
const {
  validarCrearEvaluacion,
} = require("../src/validators/evaluaciones.validator");

const base = {
  titulo: "Evaluación de álgebra",
  tema: "Ecuaciones",
  cursoId: 1,
  dificultad: "INTERMEDIO",
};

const validar = (body) => {
  let resultado = "no-ejecutado";
  validarCrearEvaluacion({ body }, {}, (error) => {
    resultado = error;
  });
  return resultado;
};

test("acepta diagnósticas y finales como evaluaciones comunes", () => {
  for (const tipoEvaluacion of ["DIAGNOSTICA", "FINAL"]) {
    assert.equal(
      validar({ ...base, tipoEvaluacion, esAdaptativa: false }),
      undefined,
    );
  }
});

test("rechaza una diagnóstica marcada como adaptativa", () => {
  const error = validar({
    ...base,
    tipoEvaluacion: "DIAGNOSTICA",
    esAdaptativa: true,
  });
  assert.equal(error.statusCode, 400);
  assert.match(error.message, /común, no adaptativa/);
});

test("exige configuración completa en una formativa adaptativa", () => {
  const error = validar({
    ...base,
    tipoEvaluacion: "FORMATIVA_ADAPTATIVA",
    esAdaptativa: true,
  });
  assert.equal(error.statusCode, 400);
  assert.match(error.message, /configuracionAdaptativa es obligatoria/);
});

test("acepta configuración adaptativa con criterios y cantidades por nivel", () => {
  const error = validar({
    ...base,
    tipoEvaluacion: "FORMATIVA_ADAPTATIVA",
    esAdaptativa: true,
    configuracionAdaptativa: {
      version: 1,
      criterios: "Nivel inicial y dominio por tema",
      cantidadPorNivel: { BASICO: 5, INTERMEDIO: 7, AVANZADO: 10 },
    },
  });
  assert.equal(error, undefined);
});

test("mantiene compatible una creación sin tipo explícito", () => {
  assert.equal(validar(base), undefined);
});
