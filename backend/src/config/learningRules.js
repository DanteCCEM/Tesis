// Reglas únicas del modelo de aprendizaje. Todos los servicios deben importar
// este módulo en lugar de declarar umbrales propios.
const UMBRAL_INTERMEDIO = 55;
const UMBRAL_AVANZADO = 80;
const UMBRAL_DOMINIO = UMBRAL_AVANZADO;

const redondearPorcentaje = (valor) =>
  Math.round(Number(valor ?? 0) * 100) / 100;

const determinarNivel = (porcentaje) => {
  const valor = redondearPorcentaje(porcentaje);
  if (valor < UMBRAL_INTERMEDIO) return "BASICO";
  if (valor <= UMBRAL_AVANZADO) return "INTERMEDIO";
  return "AVANZADO";
};

const porcentajeANota20 = (porcentaje) =>
  Math.round((redondearPorcentaje(porcentaje) / 5) * 10) / 10;

const esTemaDominado = (porcentaje) =>
  redondearPorcentaje(porcentaje) >= UMBRAL_DOMINIO;

module.exports = {
  UMBRAL_INTERMEDIO,
  UMBRAL_AVANZADO,
  UMBRAL_DOMINIO,
  UMBRALES: { UMBRAL_INTERMEDIO, UMBRAL_AVANZADO, UMBRAL_DOMINIO },
  determinarNivel,
  porcentajeANota20,
  redondearPorcentaje,
  esTemaDominado,
};
