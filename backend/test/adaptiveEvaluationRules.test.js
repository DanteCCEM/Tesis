const test = require("node:test");
const assert = require("node:assert/strict");

const {
  CONFIGURACION_ADAPTATIVA_DEFAULT,
  normalizarConfiguracionAdaptativa,
  decidirTransicionNivel,
} = require("../src/config/adaptiveEvaluationRules");

test("la configuración base define cantidad y mezcla en un solo módulo", () => {
  assert.deepEqual(CONFIGURACION_ADAPTATIVA_DEFAULT.porNivel.BASICO, {
    cantidadPreguntas: 10,
    distribucion: { BASICO: 7, INTERMEDIO: 3, AVANZADO: 0 },
  });
  assert.deepEqual(CONFIGURACION_ADAPTATIVA_DEFAULT.porNivel.INTERMEDIO, {
    cantidadPreguntas: 7,
    distribucion: { BASICO: 2, INTERMEDIO: 4, AVANZADO: 1 },
  });
  assert.deepEqual(CONFIGURACION_ADAPTATIVA_DEFAULT.porNivel.AVANZADO, {
    cantidadPreguntas: 5,
    distribucion: { BASICO: 0, INTERMEDIO: 1, AVANZADO: 4 },
  });
});

test("normaliza configuraciones antiguas y conserva la suma de la mezcla", () => {
  const configuracion = normalizarConfiguracionAdaptativa({
    cantidadPorNivel: { BASICO: 8, INTERMEDIO: 6, AVANZADO: 4 },
  });

  for (const nivel of ["BASICO", "INTERMEDIO", "AVANZADO"]) {
    const regla = configuracion.porNivel[nivel];
    const total = Object.values(regla.distribucion).reduce(
      (suma, cantidad) => suma + cantidad,
      0,
    );
    assert.equal(total, regla.cantidadPreguntas);
  }
  assert.equal(configuracion.transicion.maxCambioNiveles, 1);
});

test("respeta los límites 55 y 80 al decidir el nivel objetivo", () => {
  const decidir = (porcentaje) =>
    decidirTransicionNivel({
      nivelActual: "INTERMEDIO",
      porcentajesRecientes: [porcentaje],
    }).nivelObjetivo;

  assert.equal(decidir(54.99), "BASICO");
  assert.equal(decidir(55), "INTERMEDIO");
  assert.equal(decidir(80), "INTERMEDIO");
  assert.equal(decidir(80.01), "AVANZADO");
});

test("nunca salta más de un nivel al subir o bajar", () => {
  const subida = decidirTransicionNivel({
    nivelActual: "BASICO",
    porcentajesRecientes: [100],
  });
  const bajada = decidirTransicionNivel({
    nivelActual: "AVANZADO",
    porcentajesRecientes: [0],
  });

  assert.equal(subida.nivelObjetivo, "AVANZADO");
  assert.equal(subida.nivelSiguiente, "INTERMEDIO");
  assert.equal(bajada.nivelObjetivo, "BASICO");
  assert.equal(bajada.nivelSiguiente, "INTERMEDIO");
});

test("puede decidir con una ventana configurable de evidencias recientes", () => {
  const decision = decidirTransicionNivel({
    nivelActual: "INTERMEDIO",
    porcentajesRecientes: [100, 70, 20, 0],
    configuracion: { transicion: { evaluacionesRecientes: 3 } },
  });

  assert.equal(decision.cantidadEvidencias, 3);
  assert.equal(decision.porcentajeDecision, 63.33);
  assert.equal(decision.nivelSiguiente, "INTERMEDIO");
});
