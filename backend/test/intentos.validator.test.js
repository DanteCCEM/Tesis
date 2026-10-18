const test = require("node:test");
const assert = require("node:assert/strict");
const { validarModificacionCalificacion } = require("../src/validators/intentos.validator");

const ejecutar = (body) => {
  let error = null;
  validarModificacionCalificacion({ body }, null, (value) => { error = value; });
  return error?.message ?? null;
};

test("exige motivo para modificar una calificación", () => {
  assert.match(ejecutar({ notaFinal: 15 }), /motivoModificacion/);
});

test("acepta una nota final válida con motivo", () => {
  assert.equal(ejecutar({ notaFinal: 15.5, motivoModificacion: "Revisión pedagógica" }), null);
});

test("rechaza notas fuera de la escala vigesimal", () => {
  assert.match(ejecutar({ notaFinal: 21, motivoModificacion: "Corrección" }), /entre 0 y 20/);
});
