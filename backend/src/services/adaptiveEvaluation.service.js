const prisma = require("../config/prisma");
const ApiError = require("../utils/ApiError");
const {
  NIVELES,
  normalizarConfiguracionAdaptativa,
  obtenerReglaParaNivel,
} = require("../config/adaptiveEvaluationRules");

const ordenPreferido = {
  BASICO: ["BASICO", "INTERMEDIO", "AVANZADO"],
  INTERMEDIO: ["INTERMEDIO", "BASICO", "AVANZADO"],
  AVANZADO: ["AVANZADO", "INTERMEDIO", "BASICO"],
};

const hashEstable = (valor) => {
  let hash = 2166136261;
  for (const caracter of String(valor)) {
    hash ^= caracter.charCodeAt(0);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
};

const ordenarBanco = (preguntas, semilla) =>
  [...preguntas].sort(
    (a, b) =>
      hashEstable(`${semilla}:${a.id}`) - hashEstable(`${semilla}:${b.id}`) ||
      a.id - b.id,
  );

const seleccionarPreguntas = ({ preguntas, distribucion, cantidad, nivel, semilla }) => {
  if (preguntas.length < cantidad) {
    throw ApiError.conflict(
      `La evaluación adaptativa requiere ${cantidad} preguntas, pero el banco solo tiene ${preguntas.length}`,
    );
  }

  const banco = Object.fromEntries(
    NIVELES.map((dificultad) => [
      dificultad,
      ordenarBanco(
        preguntas.filter((pregunta) => pregunta.dificultad === dificultad),
        `${semilla}:${dificultad}`,
      ),
    ]),
  );
  const seleccionadas = [];
  const ids = new Set();

  for (const dificultad of NIVELES) {
    const requeridas = distribucion[dificultad] ?? 0;
    for (const pregunta of banco[dificultad].slice(0, requeridas)) {
      seleccionadas.push(pregunta);
      ids.add(pregunta.id);
    }
  }

  for (const dificultad of ordenPreferido[nivel] ?? ordenPreferido.BASICO) {
    for (const pregunta of banco[dificultad]) {
      if (seleccionadas.length >= cantidad) break;
      if (!ids.has(pregunta.id)) {
        seleccionadas.push(pregunta);
        ids.add(pregunta.id);
      }
    }
  }

  const distribucionReal = Object.fromEntries(
    NIVELES.map((dificultad) => [
      dificultad,
      seleccionadas.filter((pregunta) => pregunta.dificultad === dificultad).length,
    ]),
  );
  return { seleccionadas, distribucionReal };
};

const obtenerNivelActualPorTema = async ({
  estudianteId,
  cursoId,
  temaCurricularId,
  tema,
}) => {
  let progreso = null;
  if (temaCurricularId) {
    progreso = await prisma.progresoEstudiante.findFirst({
      where: { estudianteId, cursoId, temaCurricularId },
      orderBy: { ultimaActualizacion: "desc" },
    });
  }
  if (!progreso) {
    progreso = await prisma.progresoEstudiante.findUnique({
      where: {
        estudianteId_cursoId_tema: { estudianteId, cursoId, tema },
      },
    });
  }
  return progreso?.nivelActual ?? "BASICO";
};

const crearEspecificacion = async ({ evaluacion, estudianteId }) => {
  const nivelActual = await obtenerNivelActualPorTema({
    estudianteId,
    cursoId: evaluacion.cursoId,
    temaCurricularId: evaluacion.temaCurricularId,
    tema: evaluacion.tema,
  });

  const varianteComun = evaluacion.variantesEvaluacion?.find(
    (variante) => variante.nivelObjetivo === "COMUN",
  );

  if (evaluacion.tipoEvaluacion !== "FORMATIVA_ADAPTATIVA") {
    const preguntasComunes = varianteComun?.preguntas ?? evaluacion.preguntas;
    return {
      version: 1,
      adaptativa: false,
      nivelAlRendir: nivelActual,
      dificultadVariante: evaluacion.nivelDificultad,
      varianteEvaluacionId: varianteComun?.id ?? null,
      cantidadPreguntas: preguntasComunes.length,
      preguntasIds: preguntasComunes.map((pregunta) => pregunta.id),
      distribucionReal: Object.fromEntries(
        NIVELES.map((nivel) => [
          nivel,
          preguntasComunes.filter((pregunta) => pregunta.dificultad === nivel).length,
        ]),
      ),
    };
  }

  const { configuracion, regla } = obtenerReglaParaNivel(
    evaluacion.configuracionAdaptativa,
    nivelActual,
  );
  const variante = evaluacion.variantesEvaluacion?.find(
    (item) => item.nivelObjetivo === nivelActual,
  );
  const preguntasFuente = variante?.preguntas ?? evaluacion.preguntas;
  const { seleccionadas, distribucionReal } = seleccionarPreguntas({
    preguntas: preguntasFuente,
    distribucion: regla.distribucion,
    cantidad: regla.cantidadPreguntas,
    nivel: nivelActual,
    semilla: `${evaluacion.id}:${estudianteId}`,
  });

  return {
    version: 1,
    adaptativa: true,
    configuracionVersion: configuracion.version,
    varianteEvaluacionId: variante?.id ?? null,
    nivelVariante: variante?.nivelObjetivo ?? nivelActual,
    nivelAlRendir: nivelActual,
    dificultadVariante: nivelActual,
    cantidadPreguntas: seleccionadas.length,
    distribucionObjetivo: regla.distribucion,
    distribucionReal,
    preguntasIds: seleccionadas.map((pregunta) => pregunta.id),
    criterios: configuracion.criterios,
  };
};

module.exports = {
  obtenerNivelActualPorTema,
  crearEspecificacion,
  seleccionarPreguntas,
  normalizarConfiguracionAdaptativa,
};
