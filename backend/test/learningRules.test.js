const test = require("node:test");
const assert = require("node:assert/strict");
const {
  determinarNivel,
  porcentajeANota20,
  esTemaDominado,
} = require("../src/config/learningRules");

test("aplica un único umbral de nivel en los límites", () => {
  assert.equal(determinarNivel(0), "BASICO");
  assert.equal(determinarNivel(54.99), "BASICO");
  assert.equal(determinarNivel(55), "INTERMEDIO");
  assert.equal(determinarNivel(80), "INTERMEDIO");
  assert.equal(determinarNivel(80.01), "AVANZADO");
});

test("convierte porcentaje a nota vigesimal de manera centralizada", () => {
  assert.equal(porcentajeANota20(55), 11);
  assert.equal(porcentajeANota20(82.5), 16.5);
});

test("considera dominado un tema desde 80 por ciento", () => {
  assert.equal(esTemaDominado(79.99), false);
  assert.equal(esTemaDominado(80), true);
});
