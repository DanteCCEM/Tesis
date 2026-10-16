const test = require("node:test");
const assert = require("node:assert/strict");
const autorizarRoles = require("../src/middlewares/role.middleware");

test("las rutas ADMIN rechazan a docentes y estudiantes", () => {
  const middleware = autorizarRoles("ADMIN");
  for (const rol of ["DOCENTE", "ESTUDIANTE"]) {
    let error;
    middleware({ usuario: { rol } }, {}, (resultado) => { error = resultado; });
    assert.equal(error.statusCode, 403);
  }
});

test("las rutas ADMIN permiten administradores", () => {
  const middleware = autorizarRoles("ADMIN");
  let resultado = "sin ejecutar";
  middleware({ usuario: { rol: "ADMIN" } }, {}, (error) => { resultado = error; });
  assert.equal(resultado, undefined);
});
