const prisma = require("../config/prisma");
const ApiError = require("../utils/ApiError");
const {
  determinarNivel,
  UMBRALES,
} = require("./adaptiveLearningService");
const aiService = require("./aiService");

const MIN_EVALUACIONES = 1;
const CANTIDAD_PREGUNTAS = 5;

const NIVEL_LABEL = {
  BASICO: "Básico",
  INTERMEDIO: "Intermedio",
  AVANZADO: "Avanzado",
};

const filtroEvaluacionesRegulares = {
  esPracticaAdaptativa: false,
};

const agruparErroresPorTema = (intentos) => {
  const mapa = new Map();
  for (const intento of intentos) {
    for (const respuesta of intento.respuestas) {
      const tema = respuesta.pregunta.tema;
      const actual = mapa.get(tema) || { total: 0, errores: 0 };
      actual.total += 1;
      if (!respuesta.esCorrecta) actual.errores += 1;
      mapa.set(tema, actual);
    }
  }
  return [...mapa.entries()]
    .map(([tema, stats]) => ({ tema, ...stats }))
    .sort((a, b) => b.errores - a.errores || a.tema.localeCompare(b.tema));
};

const definirEnfoque = ({
  ultimoPorcentaje,
  nivelActual,
  temasConMasErrores,
  temasDominados,
  temasPorReforzar,
}) => {
  if (ultimoPorcentaje < UMBRALES.UMBRAL_INTERMEDIO) {
    return {
      regla: "MENOR_55",
      dificultad: "BASICO",
      titulo: "Repaso básico personalizado",
      descripcion:
        "Tu último resultado fue menor al 55%. Esta práctica se centra en conceptos fundamentales de tus temas más débiles.",
      enfoque: "Preguntas básicas centradas en temas con más errores",
      temasEnfoque:
        temasConMasErrores.length > 0
          ? temasConMasErrores.slice(0, 3)
          : temasPorReforzar.slice(0, 3),
    };
  }

  if (ultimoPorcentaje <= UMBRALES.UMBRAL_AVANZADO) {
    return {
      regla: "ENTRE_55_80",
      dificultad: "INTERMEDIO",
      titulo: "Consolidación intermedia",
      descripcion:
        "Tu desempeño está entre 55% y 80%. Esta práctica refuerza lo aprendido con ejercicios de dificultad media.",
      enfoque: "Preguntas intermedias de consolidación",
      temasEnfoque:
        temasPorReforzar.length > 0
          ? temasPorReforzar.slice(0, 3)
          : temasConMasErrores.slice(0, 3),
    };
  }

  return {
    regla: "MAYOR_80",
    dificultad: "AVANZADO",
    titulo: "Retos avanzados",
    descripcion:
      "Tu último resultado supera el 80%. Esta práctica propone retos contextualizados para profundizar.",
    enfoque: "Preguntas avanzadas y contextualizadas",
    temasEnfoque:
      temasDominados.length > 0
        ? temasDominados.slice(0, 3)
        : temasConMasErrores.slice(0, 3),
  };
};

const generarPreguntasPlantilla = ({ tema, dificultad, cantidad }) => {
  const preguntas = [];

  for (let i = 0; i < cantidad; i += 1) {
    const esOpcionMultiple = i % 2 === 0;

    if (esOpcionMultiple) {
      preguntas.push({
        enunciado: `[Práctica ${dificultad}] Selecciona la respuesta correcta sobre ${tema}.`,
        tipo: "OPCION_MULTIPLE",
        dificultad,
        tema,
        respuestaCorrecta: "Concepto clave del tema",
        puntaje: 1,
        alternativas: [
          { texto: "Concepto clave del tema", esCorrecta: true },
          { texto: "Afirmación incorrecta A", esCorrecta: false },
          { texto: "Afirmación incorrecta B", esCorrecta: false },
          { texto: "Afirmación incorrecta C", esCorrecta: false },
        ],
      });
    } else {
      preguntas.push({
        enunciado: `[Práctica ${dificultad}] Verdadero o falso: repasar ${tema} te ayudará a mejorar tu dominio del contenido.`,
        tipo: "VERDADERO_FALSO",
        dificultad,
        tema,
        respuestaCorrecta: "verdadero",
        puntaje: 1,
        alternativas: [
          { texto: "Verdadero", esCorrecta: true },
          { texto: "Falso", esCorrecta: false },
        ],
      });
    }
  }

  return preguntas;
};

const obtenerPreguntasPractica = async ({ curso, temaPrincipal, dificultad }) => {
  try {
    const borrador = await aiService.generarPreguntasBorrador({
      curso: curso.nombre,
      grado: curso.grado,
      tema: temaPrincipal,
      subtema: temaPrincipal,
      dificultad,
      cantidadPreguntas: CANTIDAD_PREGUNTAS,
      tiposPregunta: ["OPCION_MULTIPLE", "VERDADERO_FALSO"],
    });
    return borrador.preguntas.map((pregunta) => ({
      enunciado: pregunta.enunciado,
      tipo: pregunta.tipo,
      dificultad: pregunta.dificultad || dificultad,
      tema: pregunta.tema || temaPrincipal,
      respuestaCorrecta: pregunta.respuestaCorrecta,
      puntaje: pregunta.puntaje ?? 1,
      alternativas: pregunta.alternativas ?? [],
    }));
  } catch {
    return generarPreguntasPlantilla({
      tema: temaPrincipal,
      dificultad,
      cantidad: CANTIDAD_PREGUNTAS,
    });
  }
};

const crearPreguntaEnEvaluacion = async (db, evaluacionId, pregunta) => {
  const base = {
    enunciado: pregunta.enunciado,
    tipo: pregunta.tipo,
    dificultad: pregunta.dificultad,
    tema: pregunta.tema,
    puntaje: pregunta.puntaje ?? 1,
    evaluacionId,
  };

  if (pregunta.tipo === "OPCION_MULTIPLE") {
    return db.pregunta.create({
      data: {
        ...base,
        respuestaCorrecta: pregunta.respuestaCorrecta ?? null,
        alternativas: {
          create: pregunta.alternativas.map((alt) => ({
            texto: alt.texto,
            esCorrecta: alt.esCorrecta === true,
          })),
        },
      },
    });
  }

  if (pregunta.tipo === "VERDADERO_FALSO") {
    const esVerdadero = String(pregunta.respuestaCorrecta ?? "verdadero")
      .trim()
      .toLowerCase()
      .startsWith("v");
    return db.pregunta.create({
      data: {
        ...base,
        respuestaCorrecta: esVerdadero ? "VERDADERO" : "FALSO",
        alternativas: {
          create: [
            { texto: "Verdadero", esCorrecta: esVerdadero },
            { texto: "Falso", esCorrecta: !esVerdadero },
          ],
        },
      },
    });
  }

  return db.pregunta.create({
    data: {
      ...base,
      respuestaCorrecta: String(pregunta.respuestaCorrecta ?? "").trim(),
    },
  });
};

const practicasAdaptativasService = {
  async generar(estudianteId, { cursoId } = {}) {
    const intentos = await prisma.intentoEvaluacion.findMany({
      where: {
        estudianteId,
        estado: "FINALIZADO",
        evaluacion: filtroEvaluacionesRegulares,
      },
      orderBy: { fechaFin: "desc" },
      include: {
        evaluacion: {
          select: {
            id: true,
            titulo: true,
            tema: true,
            cursoId: true,
            curso: { select: { id: true, nombre: true, grado: true, docenteId: true } },
          },
        },
        respuestas: {
          include: {
            pregunta: { select: { tema: true } },
          },
        },
      },
    });

    if (intentos.length < MIN_EVALUACIONES) {
      throw ApiError.badRequest(
        "Necesitas completar al menos una evaluación formal antes de generar una práctica adaptativa.",
      );
    }

    const ultimoIntento = intentos[0];
    const cursoObjetivoId = cursoId ? Number(cursoId) : ultimoIntento.evaluacion.cursoId;

    const matricula = await prisma.matricula.findUnique({
      where: {
        estudianteId_cursoId: { estudianteId, cursoId: cursoObjetivoId },
      },
    });
    if (!matricula) {
      throw ApiError.forbidden("No estás matriculado en el curso seleccionado");
    }

    const curso = await prisma.curso.findUnique({
      where: { id: cursoObjetivoId },
    });
    if (!curso) {
      throw ApiError.notFound("Curso no encontrado");
    }

    const progresos = await prisma.progresoEstudiante.findMany({
      where: { estudianteId, cursoId: cursoObjetivoId },
      orderBy: { porcentajeDominio: "asc" },
    });

    const temasConMasErrores = agruparErroresPorTema(
      intentos.filter((it) => it.evaluacion.cursoId === cursoObjetivoId),
    )
      .filter((t) => t.errores > 0)
      .map((t) => t.tema);

    const intentosCurso = intentos.filter((it) => it.evaluacion.cursoId === cursoObjetivoId);

    if (intentosCurso.length === 0) {
      throw ApiError.badRequest(
        "Aún no tienes evaluaciones finalizadas en este curso. Completa al menos una para generar una práctica adaptativa.",
      );
    }

    const ultimoCurso = intentosCurso[0];
    const ultimoPorcentaje = ultimoCurso.porcentaje;
    const promedioPorcentaje =
      intentosCurso.length > 0
        ? intentosCurso.reduce((acc, it) => acc + it.porcentaje, 0) / intentosCurso.length
        : ultimoPorcentaje;

    const nivelActual = determinarNivel(promedioPorcentaje);
    const temasDominados = progresos
      .filter((p) => p.porcentajeDominio >= UMBRALES.UMBRAL_AVANZADO)
      .map((p) => p.tema);
    const temasPorReforzar = progresos
      .filter((p) => p.porcentajeDominio < UMBRALES.UMBRAL_AVANZADO)
      .map((p) => p.tema);

    const enfoque = definirEnfoque({
      ultimoPorcentaje,
      nivelActual,
      temasConMasErrores,
      temasDominados,
      temasPorReforzar,
    });

    const temaPrincipal =
      enfoque.temasEnfoque[0] ??
      temasConMasErrores[0] ??
      ultimoCurso.evaluacion.tema ??
      "Repaso general";

    const motivoResumen = {
      titulo: enfoque.titulo,
      descripcion: enfoque.descripcion,
      enfoque: enfoque.enfoque,
      reglaAplicada: enfoque.regla,
      ultimoPorcentaje: Math.round(ultimoPorcentaje * 100) / 100,
      promedioPorcentaje: Math.round(promedioPorcentaje * 100) / 100,
      nivelActual,
      nivelActualLabel: NIVEL_LABEL[nivelActual],
      dificultadPractica: enfoque.dificultad,
      dificultadPracticaLabel: NIVEL_LABEL[enfoque.dificultad],
      temasEnfoque: enfoque.temasEnfoque,
      temasConMasErrores,
      temasPorReforzar,
      evaluacionesAnalizadas: intentosCurso.length,
    };

    const preguntas = await obtenerPreguntasPractica({
      curso,
      temaPrincipal,
      dificultad: enfoque.dificultad,
    });

    const tituloPractica = `Práctica adaptativa — ${temaPrincipal}`;

    const resultado = await prisma.$transaction(async (tx) => {
      const evaluacion = await tx.evaluacion.create({
        data: {
          titulo: tituloPractica,
          tema: temaPrincipal,
          subtema: `Práctica ${NIVEL_LABEL[enfoque.dificultad]}`,
          nivelDificultad: enfoque.dificultad,
          estado: "PUBLICADA",
          esPracticaAdaptativa: true,
          estudianteObjetivoId: estudianteId,
          cursoId: cursoObjetivoId,
          docenteId: curso.docenteId,
        },
      });

      for (const pregunta of preguntas) {
        await crearPreguntaEnEvaluacion(tx, evaluacion.id, pregunta);
      }

      const practica = await tx.practicaAdaptativa.create({
        data: {
          tema: temaPrincipal,
          dificultad: enfoque.dificultad,
          estado: "PENDIENTE",
          motivoResumen,
          cantidadPreguntas: preguntas.length,
          estudianteId,
          cursoId: cursoObjetivoId,
          evaluacionId: evaluacion.id,
        },
        include: {
          evaluacion: {
            select: {
              id: true,
              titulo: true,
              tema: true,
              nivelDificultad: true,
            },
          },
        },
      });

      return practica;
    });

    return {
      practica: {
        id: resultado.id,
        tema: resultado.tema,
        dificultad: resultado.dificultad,
        estado: resultado.estado,
        cantidadPreguntas: resultado.cantidadPreguntas,
        createdAt: resultado.createdAt,
        evaluacionId: resultado.evaluacionId,
        evaluacion: resultado.evaluacion,
      },
      evaluacionId: resultado.evaluacionId,
      resumen: motivoResumen,
    };
  },
};

module.exports = practicasAdaptativasService;
