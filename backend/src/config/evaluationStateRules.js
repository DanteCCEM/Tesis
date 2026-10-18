const ESTADOS_EVALUACION = ["BORRADOR", "PUBLICADA", "CERRADA", "ARCHIVADA"];

const TRANSICIONES_PERMITIDAS = Object.freeze({
  BORRADOR: ["PUBLICADA", "ARCHIVADA"],
  PUBLICADA: ["CERRADA", "ARCHIVADA"],
  CERRADA: ["ARCHIVADA"],
  ARCHIVADA: [],
});

const CAMPOS_ESTRUCTURALES = new Set([
  "preguntas",
  "puntajes",
  "variantes",
  "tema",
  "subtema",
  "temaCurricularId",
  "subtemaCurricularId",
  "configuracionAdaptativa",
  "tipoEvaluacion",
  "esAdaptativa",
  "nivelDificultad",
  "dificultad",
]);

const puedeTransicionar = (actual, siguiente) =>
  actual === siguiente || (TRANSICIONES_PERMITIDAS[actual] ?? []).includes(siguiente);

const validarTransicion = (actual, siguiente) => {
  if (!ESTADOS_EVALUACION.includes(siguiente)) {
    throw new Error(`Estado de evaluación inválido: ${siguiente}`);
  }
  if (!puedeTransicionar(actual, siguiente)) {
    throw new Error(`No se permite cambiar una evaluación de ${actual} a ${siguiente}`);
  }
};

const tieneCambiosEstructurales = (datos) =>
  Object.keys(datos ?? {}).some((campo) => CAMPOS_ESTRUCTURALES.has(campo));

const estaVencida = (fechaLimite, ahora = new Date()) =>
  Boolean(fechaLimite && new Date(fechaLimite).getTime() < ahora.getTime());

// Política: una evaluación vencida no admite nuevos intentos. Un intento ya
// iniciado puede continuar y finalizar, para no destruir evidencia parcial.
const puedeCrearIntento = ({ estado, fechaLimite, intentoExistente }) => {
  if (estado !== "PUBLICADA") return false;
  if (estaVencida(fechaLimite) && !intentoExistente) return false;
  return true;
};

const puedeContinuarIntento = ({ estado, intentoExistente }) =>
  Boolean(intentoExistente) && intentoExistente.estado === "EN_PROGRESO" && estado !== "ARCHIVADA";

module.exports = {
  ESTADOS_EVALUACION,
  TRANSICIONES_PERMITIDAS,
  CAMPOS_ESTRUCTURALES,
  puedeTransicionar,
  validarTransicion,
  tieneCambiosEstructurales,
  estaVencida,
  puedeCrearIntento,
  puedeContinuarIntento,
};
