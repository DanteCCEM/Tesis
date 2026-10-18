const {
  CONFIGURACION_ADAPTATIVA_DEFAULT,
  normalizarConfiguracionAdaptativa,
  decidirTransicionNivel,
} = require("../../src/config/adaptiveEvaluationRules");
const { determinarNivel } = require("../../src/config/learningRules");

describe("reglas centrales de adaptación", () => {
  it("mantiene cantidades y distribuciones 10/7/5", () => {
    const config = normalizarConfiguracionAdaptativa();
    expect(config.porNivel).toEqual(CONFIGURACION_ADAPTATIVA_DEFAULT.porNivel);
    expect(config.porNivel.BASICO).toEqual({
      cantidadPreguntas: 10,
      distribucion: { BASICO: 7, INTERMEDIO: 3, AVANZADO: 0 },
    });
    expect(config.porNivel.INTERMEDIO).toEqual({
      cantidadPreguntas: 7,
      distribucion: { BASICO: 2, INTERMEDIO: 4, AVANZADO: 1 },
    });
    expect(config.porNivel.AVANZADO).toEqual({
      cantidadPreguntas: 5,
      distribucion: { BASICO: 0, INTERMEDIO: 1, AVANZADO: 4 },
    });
  });

  it("aplica exactamente los límites 55 y 80", () => {
    expect(determinarNivel(54.99)).toBe("BASICO");
    expect(determinarNivel(55)).toBe("INTERMEDIO");
    expect(determinarNivel(80)).toBe("INTERMEDIO");
    expect(determinarNivel(80.01)).toBe("AVANZADO");
  });

  it("limita cualquier subida o bajada a un nivel", () => {
    expect(decidirTransicionNivel({ nivelActual: "BASICO", porcentajesRecientes: [100] }).nivelSiguiente)
      .toBe("INTERMEDIO");
    expect(decidirTransicionNivel({ nivelActual: "AVANZADO", porcentajesRecientes: [0] }).nivelSiguiente)
      .toBe("INTERMEDIO");
  });

  it("prepara la transición para una ventana de resultados recientes", () => {
    const resultado = decidirTransicionNivel({
      nivelActual: "INTERMEDIO",
      porcentajesRecientes: [100, 40, 100],
      configuracion: { transicion: { evaluacionesRecientes: 3 } },
    });
    expect(resultado.cantidadEvidencias).toBe(3);
    expect(resultado.porcentajeDecision).toBeCloseTo(80, 2);
    expect(resultado.nivelSiguiente).toBe("INTERMEDIO");
  });
});
