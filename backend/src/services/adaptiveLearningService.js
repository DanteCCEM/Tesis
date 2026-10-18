const prisma = require("../config/prisma");
const ApiError = require("../utils/ApiError");
const {
  determinarNivel,
  porcentajeANota20,
  redondearPorcentaje: redondear,
  UMBRALES,
  UMBRAL_DOMINIO,
} = require("../config/learningRules");
const {
  normalizarConfiguracionAdaptativa,
  decidirTransicionNivel,
} = require("../config/adaptiveEvaluationRules");

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

const agruparRespuestasParaHistorial = (respuestas) => {
  const temas = new Map();
  for (const respuesta of respuestas) {
    const tema = String(respuesta.tema || "General").trim() || "General";
    const clave = tema.toLocaleLowerCase("es");
    const actual = temas.get(clave) || {
      tema,
      temaCurricularId: respuesta.temaCurricularId ?? null,
      subtemaCurricularId: respuesta.subtemaCurricularId ?? null,
      resultadosPorPregunta: new Map(),
    };
    const preguntaClave = respuesta.preguntaId ?? `fila:${actual.resultadosPorPregunta.size}`;
    actual.resultadosPorPregunta.set(
      preguntaClave,
      Boolean(actual.resultadosPorPregunta.get(preguntaClave) || respuesta.esCorrecta),
    );
    if (actual.temaCurricularId == null && respuesta.temaCurricularId != null) {
      actual.temaCurricularId = respuesta.temaCurricularId;
    }
    if (actual.subtemaCurricularId == null && respuesta.subtemaCurricularId != null) {
      actual.subtemaCurricularId = respuesta.subtemaCurricularId;
    }
    temas.set(clave, actual);
  }
  return [...temas.values()].map(({ resultadosPorPregunta, ...tema }) => ({
    ...tema,
    cantidadPreguntas: resultadosPorPregunta.size,
    respuestasCorrectas: [...resultadosPorPregunta.values()].filter(Boolean).length,
  }));
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
  UMBRALES,

  /**
   * Procesa el resultado de un intento finalizado y:
   *  - agrupa errores por tema y subtema
   *  - identifica temas dominados y por reforzar
   *  - registra un HistorialProgreso inmutable por tema
   *  - actualiza el resumen acumulado ProgresoEstudiante por tema
   *  - devuelve un objeto estructurado para Resultados.jsx y Progreso.jsx
   *
   * @param {object} params
   * @param {number} params.estudianteId
   * @param {number} params.cursoId
   * @param {number} params.asignacionCursoId
   * @param {number} params.evaluacionId
   * @param {number} params.intentoId
   * @param {string} params.dificultadEvaluacion
   * @param {Array<{preguntaId:number, tema:string, subtema?:string, esCorrecta:boolean, temaCurricularId?:number, subtemaCurricularId?:number}>} params.respuestas
   */
  async procesarIntento({
    estudianteId,
    cursoId,
    asignacionCursoId,
    evaluacionId,
    intentoId,
    dificultadEvaluacion,
    nivelAlRendir,
    configuracionAdaptativa,
    fecha,
    porcentaje,
    respuestas,
  }) {
    const analisis = analizar({ porcentaje, respuestas });
    const reglasAdaptacion = normalizarConfiguracionAdaptativa(
      configuracionAdaptativa ?? {},
    );
    if (!asignacionCursoId) {
      throw ApiError.conflict(
        "La evaluación no está vinculada a una asignación académica",
      );
    }

    const temas = agruparRespuestasParaHistorial(respuestas);
    const progresoGuardado = await prisma.$transaction(async (tx) => {
      const guardados = [];

      for (const tema of temas) {
        const historialExistente = await tx.historialProgreso.findUnique({
          where: { intentoId_tema: { intentoId, tema: tema.tema } },
        });

        if (historialExistente) {
          const resumen = await tx.progresoEstudiante.findUnique({
            where: {
              estudianteId_cursoId_tema: {
                estudianteId,
                cursoId,
                tema: tema.tema,
              },
            },
          });
          if (resumen) guardados.push(resumen);
          continue;
        }

        const resumenAnterior = await tx.progresoEstudiante.findUnique({
          where: {
            estudianteId_cursoId_tema: {
              estudianteId,
              cursoId,
              tema: tema.tema,
            },
          },
        });

        const cantidadEvidenciasPrevias = Math.max(
          0,
          reglasAdaptacion.transicion.evaluacionesRecientes - 1,
        );
        const historialReciente = cantidadEvidenciasPrevias > 0
          ? await tx.historialProgreso.findMany({
              where: { estudianteId, asignacionCursoId, tema: tema.tema },
              orderBy: [{ fecha: "desc" }, { id: "desc" }],
              take: cantidadEvidenciasPrevias,
              select: { porcentaje: true },
            })
          : [];

        const acumuladoAnterior = await tx.historialProgreso.aggregate({
          where: { estudianteId, asignacionCursoId, tema: tema.tema },
          _sum: {
            cantidadPreguntas: true,
            respuestasCorrectas: true,
          },
          _count: { _all: true },
        });

        const preguntasPrevias = acumuladoAnterior._sum.cantidadPreguntas ?? 0;
        const correctasPrevias = acumuladoAnterior._sum.respuestasCorrectas ?? 0;
        const totalPreguntas = preguntasPrevias + tema.cantidadPreguntas;
        const totalCorrectas = correctasPrevias + tema.respuestasCorrectas;
        const porcentajeTema = redondear(
          tema.cantidadPreguntas > 0
            ? (tema.respuestasCorrectas / tema.cantidadPreguntas) * 100
            : 0,
        );
        const porcentajeAcumulado = redondear(
          totalPreguntas > 0 ? (totalCorrectas / totalPreguntas) * 100 : 0,
        );
        const nivelAntes =
          resumenAnterior?.nivelActual ?? nivelAlRendir ?? "BASICO";
        const transicion = decidirTransicionNivel({
          nivelActual: nivelAntes,
          porcentajesRecientes: [
            porcentajeTema,
            ...historialReciente.map((item) => item.porcentaje),
          ],
          configuracion: reglasAdaptacion,
        });
        const nivelDespues = transicion.nivelSiguiente;
        const respuestasIncorrectas =
          tema.cantidadPreguntas - tema.respuestasCorrectas;

        await tx.historialProgreso.create({
          data: {
            estudianteId,
            asignacionCursoId,
            temaCurricularId: tema.temaCurricularId,
            subtemaCurricularId: tema.subtemaCurricularId,
            evaluacionId,
            intentoId,
            tema: tema.tema,
            porcentaje: porcentajeTema,
            nota: porcentajeANota20(porcentajeTema),
            nivelAntes,
            nivelDespues,
            dificultadEvaluacion,
            cantidadPreguntas: tema.cantidadPreguntas,
            respuestasCorrectas: tema.respuestasCorrectas,
            respuestasIncorrectas,
            fecha: fecha ?? new Date(),
          },
        });

        const recoTema = recomendacionPorTema(nivelDespues, tema.tema);
        const resumen = await tx.progresoEstudiante.upsert({
          where: {
            estudianteId_cursoId_tema: {
              estudianteId,
              cursoId,
              tema: tema.tema,
            },
          },
          update: {
            asignacionCursoId,
            temaCurricularId: tema.temaCurricularId,
            nivelActual: nivelDespues,
            porcentajeDominio: porcentajeAcumulado,
            cantidadEvaluaciones: acumuladoAnterior._count._all + 1,
            recomendaciones: recoTema,
          },
          create: {
            estudianteId,
            cursoId,
            asignacionCursoId,
            temaCurricularId: tema.temaCurricularId,
            tema: tema.tema,
            nivelActual: nivelDespues,
            porcentajeDominio: porcentajeAcumulado,
            cantidadEvaluaciones: 1,
            recomendaciones: recoTema,
          },
        });
        guardados.push(resumen);
      }

      return guardados;
    });

    const progreso = progresoGuardado.map((p) => ({
      tema: p.tema,
      nivelActual: p.nivelActual,
      porcentajeDominio: p.porcentajeDominio,
      cantidadEvaluaciones: p.cantidadEvaluaciones,
      ultimaActualizacion: p.ultimaActualizacion,
      recomendaciones: p.recomendaciones,
    }));

    return { ...analisis, progreso };
  },
};

module.exports = adaptiveLearningService;
