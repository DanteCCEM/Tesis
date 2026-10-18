const {
  determinarNivel,
  redondearPorcentaje,
} = require("./learningRules");

const NIVELES = ["BASICO", "INTERMEDIO", "AVANZADO"];

const CONFIGURACION_ADAPTATIVA_DEFAULT = Object.freeze({
  version: 2,
  porNivel: {
    BASICO: {
      cantidadPreguntas: 10,
      distribucion: { BASICO: 7, INTERMEDIO: 3, AVANZADO: 0 },
    },
    INTERMEDIO: {
      cantidadPreguntas: 7,
      distribucion: { BASICO: 2, INTERMEDIO: 4, AVANZADO: 1 },
    },
    AVANZADO: {
      cantidadPreguntas: 5,
      distribucion: { BASICO: 0, INTERMEDIO: 1, AVANZADO: 4 },
    },
  },
  transicion: {
    evaluacionesRecientes: 1,
    maxCambioNiveles: 1,
  },
});

const enteroEnRango = (valor, defecto, minimo = 0, maximo = 50) => {
  const numero = Number(valor);
  return Number.isInteger(numero) && numero >= minimo && numero <= maximo
    ? numero
    : defecto;
};

const ajustarDistribucion = (distribucion, cantidad) => {
  const valores = NIVELES.map((nivel) =>
    Math.max(0, Number(distribucion?.[nivel] ?? 0)),
  );
  const total = valores.reduce((suma, valor) => suma + valor, 0);
  if (total === cantidad) {
    return Object.fromEntries(NIVELES.map((nivel, i) => [nivel, valores[i]]));
  }
  if (total <= 0) return { BASICO: cantidad, INTERMEDIO: 0, AVANZADO: 0 };

  const proporciones = valores.map((valor) => (valor / total) * cantidad);
  const resultado = proporciones.map(Math.floor);
  let restantes = cantidad - resultado.reduce((suma, valor) => suma + valor, 0);
  const prioridad = proporciones
    .map((valor, indice) => ({ indice, fraccion: valor - Math.floor(valor) }))
    .sort((a, b) => b.fraccion - a.fraccion || a.indice - b.indice);
  for (let i = 0; i < restantes; i += 1) {
    resultado[prioridad[i % prioridad.length].indice] += 1;
  }
  return Object.fromEntries(NIVELES.map((nivel, i) => [nivel, resultado[i]]));
};

const normalizarConfiguracionAdaptativa = (entrada = {}) => {
  // Prisma devuelve null cuando una evaluación histórica aún no tiene JSON.
  entrada = entrada ?? {};
  const porNivel = {};
  for (const nivel of NIVELES) {
    const base = CONFIGURACION_ADAPTATIVA_DEFAULT.porNivel[nivel];
    const configurada = entrada.porNivel?.[nivel] ?? {};
    const cantidadLegacy = entrada.cantidadPorNivel?.[nivel];
    const cantidadPreguntas = enteroEnRango(
      configurada.cantidadPreguntas ?? cantidadLegacy,
      base.cantidadPreguntas,
      1,
      20,
    );
    porNivel[nivel] = {
      cantidadPreguntas,
      distribucion: ajustarDistribucion(
        configurada.distribucion ?? base.distribucion,
        cantidadPreguntas,
      ),
    };
  }

  return {
    version: 2,
    criterios: String(entrada.criterios ?? "Nivel actual del estudiante por tema").trim(),
    porNivel,
    transicion: {
      evaluacionesRecientes: enteroEnRango(
        entrada.transicion?.evaluacionesRecientes,
        CONFIGURACION_ADAPTATIVA_DEFAULT.transicion.evaluacionesRecientes,
        1,
        10,
      ),
      // Invariante pedagógica: jamás se permiten saltos de más de un nivel.
      maxCambioNiveles: 1,
    },
  };
};

const obtenerReglaParaNivel = (configuracion, nivel) => {
  const normalizada = normalizarConfiguracionAdaptativa(configuracion);
  const nivelSeguro = NIVELES.includes(nivel) ? nivel : "BASICO";
  return { configuracion: normalizada, regla: normalizada.porNivel[nivelSeguro] };
};

const limitarTransicion = (nivelActual, nivelObjetivo) => {
  const actual = Math.max(0, NIVELES.indexOf(nivelActual));
  const objetivo = Math.max(0, NIVELES.indexOf(nivelObjetivo));
  const diferencia = Math.max(-1, Math.min(1, objetivo - actual));
  return NIVELES[actual + diferencia];
};

const decidirTransicionNivel = ({
  nivelActual,
  porcentajesRecientes,
  configuracion,
}) => {
  const normalizada = normalizarConfiguracionAdaptativa(configuracion);
  const ventana = normalizada.transicion.evaluacionesRecientes;
  const muestras = (porcentajesRecientes ?? [])
    .filter((valor) => Number.isFinite(Number(valor)))
    .slice(0, ventana)
    .map(Number);
  const porcentajeDecision = redondearPorcentaje(
    muestras.length > 0
      ? muestras.reduce((suma, valor) => suma + valor, 0) / muestras.length
      : 0,
  );
  const nivelObjetivo = determinarNivel(porcentajeDecision);
  return {
    nivelAnterior: NIVELES.includes(nivelActual) ? nivelActual : "BASICO",
    nivelObjetivo,
    nivelSiguiente: limitarTransicion(nivelActual, nivelObjetivo),
    porcentajeDecision,
    cantidadEvidencias: muestras.length,
    ventanaConfigurada: ventana,
  };
};

module.exports = {
  NIVELES,
  CONFIGURACION_ADAPTATIVA_DEFAULT,
  normalizarConfiguracionAdaptativa,
  obtenerReglaParaNivel,
  limitarTransicion,
  decidirTransicionNivel,
};
