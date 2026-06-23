const prisma = require("../config/prisma");

// ===================== UMBRALES (lógica transparente) =====================
// Reglas explícitas y fáciles de justificar en una tesis:
//   - porcentaje < 55            -> BASICO
//   - 55 <= porcentaje <= 80     -> INTERMEDIO
//   - porcentaje > 80            -> AVANZADO
const UMBRAL_INTERMEDIO = 55; // a partir de aquí deja de ser BASICO
const UMBRAL_AVANZADO = 80; // por encima de aquí es AVANZADO

// Un tema se considera "dominado" si su porcentaje de dominio alcanza el
// umbral avanzado; en caso contrario, es un tema "por reforzar".
const UMBRAL_DOMINIO = UMBRAL_AVANZADO;

// Determina el nivel a partir de un porcentaje (0-100).
const determinarNivel = (porcentaje) => {
  if (porcentaje < UMBRAL_INTERMEDIO) return "BASICO";
  if (porcentaje <= UMBRAL_AVANZADO) return "INTERMEDIO";
  return "AVANZADO";
};

const redondear = (valor) => Math.round(valor * 100) / 100;

// Mensaje de retroalimentación: siempre positivo y claro.
const construirMensaje = (nivel, porcentaje) => {
  const pct = redondear(porcentaje);
  switch (nivel) {
    case "BASICO":
      return (
        `Obtuviste ${pct}%. Vas por buen camino: ya identificaste varios ` +
        `conceptos clave. Con un repaso guiado reforzarás lo esencial y ` +
        `avanzarás con seguridad.`
      );
    case "INTERMEDIO":
      return (
        `Obtuviste ${pct}%. ¡Buen desempeño! Dominas gran parte del ` +
        `contenido; con ejercicios de consolidación afianzarás los temas ` +
        `que aún tienes pendientes.`
      );
    default:
      return (
        `Obtuviste ${pct}%. ¡Excelente desempeño! Manejas el contenido con ` +
        `solidez; es momento de asumir retos de mayor dificultad.`
      );
  }
};

// Recomendación global según el nivel alcanzado.
const construirRecomendacion = (nivel, { temasPorReforzar, temasDominados, temasConMasErrores }) => {
  switch (nivel) {
    case "BASICO":
      return {
        tipo: "REPASO_GUIADO",
        titulo: "Repaso guiado",
        descripcion:
          "Repasa los conceptos fundamentales con apoyo paso a paso antes de avanzar.",
        acciones: [
          "Revisa el material base de los temas con más errores.",
          "Realiza una práctica guiada centrada en esos temas.",
          "Vuelve a intentar preguntas similares hasta afianzar el concepto.",
        ],
        practica: {
          enfoque: "Temas con más errores",
          temas: temasConMasErrores,
          dificultad: "BASICO",
        },
      };
    case "INTERMEDIO":
      return {
        tipo: "CONSOLIDACION",
        titulo: "Ejercicios de consolidación",
        descripcion:
          "Refuerza los temas pendientes con ejercicios de dificultad media.",
        acciones: [
          "Practica ejercicios de consolidación del mismo tema.",
          "Concéntrate en los temas marcados como por reforzar.",
        ],
        practica: {
          enfoque: "Mismo tema, dificultad media",
          temas: temasPorReforzar.length > 0 ? temasPorReforzar : temasConMasErrores,
          dificultad: "INTERMEDIO",
        },
      };
    default:
      return {
        tipo: "RETOS",
        titulo: "Retos y problemas contextualizados",
        descripcion:
          "Aplica lo aprendido en problemas contextualizados de mayor dificultad.",
        acciones: [
          "Resuelve retos y problemas contextualizados.",
          "Aborda preguntas de mayor dificultad para profundizar.",
        ],
        practica: {
          enfoque: "Problemas contextualizados",
          temas: temasDominados.length > 0 ? temasDominados : temasConMasErrores,
          dificultad: "AVANZADO",
        },
      };
  }
};

// Recomendación breve por tema (se guarda en ProgresoEstudiante).
const recomendacionPorTema = (nivel, tema) => {
  switch (nivel) {
    case "BASICO":
      return `Refuerza "${tema}" con un repaso guiado de los conceptos base.`;
    case "INTERMEDIO":
      return `Consolida "${tema}" con ejercicios de dificultad media.`;
    default:
      return `Dominas "${tema}"; profundiza con retos de mayor dificultad.`;
  }
};

// Agrupa aciertos/errores por una clave (tema o subtema).
const agrupar = (items, clave) => {
  const mapa = new Map();
  for (const item of items) {
    const valor = item[clave] || "General";
    const actual = mapa.get(valor) || { total: 0, aciertos: 0 };
    actual.total += 1;
    if (item.esCorrecta) actual.aciertos += 1;
    mapa.set(valor, actual);
  }
  return mapa;
};

// Convierte el mapa agrupado en una lista ordenada por cantidad de errores.
const aListaErrores = (mapa, nombreClave) =>
  [...mapa.entries()]
    .map(([clave, { total, aciertos }]) => ({
      [nombreClave]: clave,
      total,
      aciertos,
      errores: total - aciertos,
      porcentajeDominio: total > 0 ? redondear((aciertos / total) * 100) : 0,
    }))
    .sort((a, b) => b.errores - a.errores);

// Analiza un resultado SIN persistir nada (función pura). Útil tanto para
// finalizar un intento como para mostrar resultados ya guardados.
const analizar = ({ porcentaje, respuestas }) => {
  const porcentajeGeneral = redondear(porcentaje ?? 0);
  const nivel = determinarNivel(porcentajeGeneral);

  const mapaTema = agrupar(respuestas, "tema");
  const mapaSubtema = agrupar(respuestas, "subtema");

  const erroresPorTema = aListaErrores(mapaTema, "tema");
  const erroresPorSubtema = aListaErrores(mapaSubtema, "subtema");

  const temasDominados = erroresPorTema
    .filter((t) => t.porcentajeDominio >= UMBRAL_DOMINIO)
    .map((t) => t.tema);
  const temasPorReforzar = erroresPorTema
    .filter((t) => t.porcentajeDominio < UMBRAL_DOMINIO)
    .map((t) => t.tema);
  const temasConMasErrores = erroresPorTema
    .filter((t) => t.errores > 0)
    .map((t) => t.tema);

  const recomendaciones = construirRecomendacion(nivel, {
    temasPorReforzar,
    temasDominados,
    temasConMasErrores,
  });
  const mensaje = construirMensaje(nivel, porcentajeGeneral);

  return {
    porcentajeGeneral,
    nivel,
    mensaje,
    recomendaciones,
    errores: { porTema: erroresPorTema, porSubtema: erroresPorSubtema },
    temasDominados,
    temasPorReforzar,
  };
};

const adaptiveLearningService = {
  // Expuestos para pruebas / transparencia y reutilización.
  determinarNivel,
  construirRecomendacion,
  analizar,
  UMBRALES: { UMBRAL_INTERMEDIO, UMBRAL_AVANZADO, UMBRAL_DOMINIO },

  /**
   * Procesa el resultado de un intento finalizado y:
   *  - agrupa errores por tema y subtema
   *  - identifica temas dominados y por reforzar
   *  - actualiza/crea ProgresoEstudiante por tema
   *  - devuelve un objeto estructurado para Resultados.jsx y Progreso.jsx
   *
   * @param {object} params
   * @param {number} params.estudianteId
   * @param {number} params.cursoId
   * @param {number} params.porcentaje  Porcentaje general del intento (0-100).
   * @param {Array<{tema:string, subtema?:string, esCorrecta:boolean}>} params.respuestas
   */
  async procesarIntento({ estudianteId, cursoId, porcentaje, respuestas }) {
    const analisis = analizar({ porcentaje, respuestas });

    // Persistir progreso por tema (upsert por la clave única
    // [estudianteId, cursoId, tema]).
    const operaciones = analisis.errores.porTema.map((t) => {
      const nivelTema = determinarNivel(t.porcentajeDominio);
      const recoTema = recomendacionPorTema(nivelTema, t.tema);
      return prisma.progresoEstudiante.upsert({
        where: {
          estudianteId_cursoId_tema: { estudianteId, cursoId, tema: t.tema },
        },
        update: {
          nivelActual: nivelTema,
          porcentajeDominio: t.porcentajeDominio,
          recomendaciones: recoTema,
        },
        create: {
          estudianteId,
          cursoId,
          tema: t.tema,
          nivelActual: nivelTema,
          porcentajeDominio: t.porcentajeDominio,
          recomendaciones: recoTema,
        },
      });
    });

    const progresoGuardado = await prisma.$transaction(operaciones);

    const progreso = progresoGuardado.map((p) => ({
      tema: p.tema,
      nivelActual: p.nivelActual,
      porcentajeDominio: p.porcentajeDominio,
      recomendaciones: p.recomendaciones,
    }));

    return { ...analisis, progreso };
  },
};

module.exports = adaptiveLearningService;
