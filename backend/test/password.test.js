const test = require("node:test");
const assert = require("node:assert/strict");
const {
  generarPasswordTemporal,
  validarPasswordSegura,
} = require("../src/utils/password");

test("genera contraseñas temporales seguras y no repetidas", () => {
  const generadas = new Set();
  for (let i = 0; i < 100; i += 1) {
    const password = generarPasswordTemporal();
    assert.equal(password.length, 20);
    assert.equal(validarPasswordSegura(password), null);
    generadas.add(password);
  }
  assert.equal(generadas.size, 100);
});

test("rechaza contraseñas débiles", () => {
  assert.match(validarPasswordSegura("Corta1!"), /entre 12 y 128/);
  assert.match(validarPasswordSegura("sololetrasminusculas"), /mayúscula/);
  assert.equal(validarPasswordSegura("Segura-2026!Clave"), null);
});
