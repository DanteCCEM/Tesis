const test = require("node:test");
const assert = require("node:assert/strict");
const { validarGenerarVariantes } = require("../src/validators/ia.validator");

const base = {
  cursoId: 1,
  tema: "Fracciones",
  subtema: "Suma de fracciones",
  criterios: "Comprensión conceptual y resolución paso a paso",
  tiposPregunta: ["OPCION_MULTIPLE", "RESPUESTA_CORTA"],
  configuracionAdaptativa: {
    cantidadPorNivel: { BASICO: 10, INTERMEDIO: 7, AVANZADO: 5 },
  },
};

const validar = (body) => {
  let resultado = "no-ejecutado";
  validarGenerarVariantes({ body }, {}, (error) => {
    resultado = error;
  });
  return resultado;
};

test("acepta la solicitud de las tres variantes con configuración válida", () => {
  assert.equal(validar(base), undefined);
});

test("rechaza variantes sin configuración de cantidad por nivel", () => {
  const error = validar({ ...base, configuracionAdaptativa: {} });
  assert.equal(error.statusCode, 400);
  assert.match(error.message, /cantidad de BASICO/);
});

test("rechaza solicitudes sin criterios pedagógicos", () => {
  const error = validar({ ...base, criterios: "" });
  assert.equal(error.statusCode, 400);
  assert.match(error.message, /criterios es obligatorio/);
});
