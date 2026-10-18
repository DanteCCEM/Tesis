const test = require("node:test");
const assert = require("node:assert/strict");
const rules = require("../src/config/evaluationStateRules");

test("permite solo transiciones seguras y nunca reabre archivadas", () => {
  assert.equal(rules.puedeTransicionar("BORRADOR", "PUBLICADA"), true);
  assert.equal(rules.puedeTransicionar("PUBLICADA", "CERRADA"), true);
  assert.equal(rules.puedeTransicionar("CERRADA", "ARCHIVADA"), true);
  assert.equal(rules.puedeTransicionar("CERRADA", "PUBLICADA"), false);
  assert.equal(rules.puedeTransicionar("ARCHIVADA", "BORRADOR"), false);
});

test("bloquea nuevos intentos vencidos pero permite continuar uno iniciado", () => {
  const fechaPasada = new Date(Date.now() - 60_000);
  assert.equal(rules.puedeCrearIntento({ estado: "PUBLICADA", fechaLimite: fechaPasada, intentoExistente: null }), false);
  assert.equal(rules.puedeContinuarIntento({ estado: "PUBLICADA", intentoExistente: { estado: "EN_PROGRESO" } }), true);
  assert.equal(rules.puedeContinuarIntento({ estado: "CERRADA", intentoExistente: { estado: "EN_PROGRESO" } }), true);
  assert.equal(rules.puedeContinuarIntento({ estado: "ARCHIVADA", intentoExistente: { estado: "EN_PROGRESO" } }), false);
});

test("identifica cambios estructurales", () => {
  assert.equal(rules.tieneCambiosEstructurales({ titulo: "Nuevo título" }), false);
  assert.equal(rules.tieneCambiosEstructurales({ tema: "Fracciones" }), true);
  assert.equal(rules.tieneCambiosEstructurales({ configuracionAdaptativa: {} }), true);
});
