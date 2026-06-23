const prisma = require("../config/prisma");
const ApiError = require("../utils/ApiError");
const adaptiveLearningService = require("./adaptiveLearningService");

const usuarioPublico = { id: true, nombres: true, correo: true };

// Normalización simple para comparar respuestas cortas:
// minúsculas, sin acentos, sin espacios sobrantes.
const normalizar = (texto) =>
  String(texto ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim()
    .replace(/\s+/g, " ");

// Quita las respuestas correctas de una evaluación (vista de estudiante).
const ocultarRespuestas = (evaluacion) => ({
  ...evaluacion,
  preguntas: evaluacion.preguntas.map((pregunta) => {
    const { respuestaCorrecta, alternativas, ...resto } = pregunta;
    return {
      ...resto,
      alternativas: alternativas.map((alt) => {
        const { esCorrecta, ...altResto } = alt;
        return altResto;
      }),
    };
  }),
});

// Nivel inicial sugerido a partir del porcentaje obtenido.
const nivelPorPorcentaje = (porcentaje) => {
  if (porcentaje >= 80) return "AVANZADO";
  if (porcentaje >= 50) return "INTERMEDIO";
  return "BASICO";
};

// Retroalimentación inicial automática por pregunta.
const generarRetroalimentacion = (esCorrecta, pregunta, respondida) => {
  if (!respondida) {
    return `No respondiste esta pregunta. Repasa el tema: ${pregunta.tema}.`;
  }
  if (esCorrecta) {
    return `¡Correcto! Buen dominio del tema: ${pregunta.tema}.`;
  }
  return `Respuesta incorrecta. Te recomendamos reforzar el tema: ${pregunta.tema}.`;
};

const estaMatriculado = async (cursoId, estudianteId) => {
  const matricula = await prisma.matricula.findUnique({
    where: { estudianteId_cursoId: { estudianteId, cursoId } },
  });
  return Boolean(matricula);
};

// Carga un intento verificando que pertenezca al estudiante autenticado.
const cargarIntentoPropio = async (intentoId, estudianteId) => {
  const intento = await prisma.intentoEvaluacion.findUnique({
    where: { id: intentoId },
  });
  if (!intento) {
    throw ApiError.notFound("Intento no encontrado");
  }
  if (intento.estudianteId !== estudianteId) {
    throw ApiError.forbidden("Este intento no te pertenece");
  }
  return intento;
};

// Construye el objeto de resultado a partir de un intento ya incluido.
const construirResultado = (intento) => {
  const respuestas = intento.respuestas.map((respuesta) => {
    const { pregunta } = respuesta;
    const respuestaCorrecta =
      pregunta.tipo === "RESPUESTA_CORTA"
        ? pregunta.respuestaCorrecta
        : pregunta.alternativas
            .filter((alt) => alt.esCorrecta)
            .map((alt) => alt.texto)
            .join(", ");

    return {
      preguntaId: pregunta.id,
      enunciado: pregunta.enunciado,
      tipo: pregunta.tipo,
      tema: pregunta.tema,
      tuRespuesta: respuesta.alternativa
        ? respuesta.alternativa.texto
        : respuesta.respuestaTexto,
      esCorrecta: respuesta.esCorrecta,
      puntajeObtenido: respuesta.puntajeObtenido,
      retroalimentacion: respuesta.retroalimentacion,
      respuestaCorrecta,
    };
  });

  // Un tema es "correcto" solo si todas sus preguntas se acertaron.
  const temas = new Map();
  for (const respuesta of intento.respuestas) {
    const tema = respuesta.pregunta.tema;
    const previo = temas.get(tema);
    temas.set(tema, previo === undefined ? respuesta.esCorrecta : previo && respuesta.esCorrecta);
  }

  const temasCorrectos = [...temas.entries()]
    .filter(([, ok]) => ok)
    .map(([tema]) => tema);
  const temasPorReforzar = [...temas.entries()]
    .filter(([, ok]) => !ok)
    .map(([tema]) => tema);

  return {
    intentoId: intento.id,
    estado: intento.estado,
    evaluacion: {
      id: intento.evaluacion.id,
      titulo: intento.evaluacion.titulo,
      tema: intento.evaluacion.tema,
      subtema: intento.evaluacion.subtema,
    },
    estudiante: intento.estudiante,
    nota: intento.puntajeTotal,
    porcentaje: intento.porcentaje,
    nivelObtenido: intento.nivelObtenido,
    retroalimentacionIA: intento.retroalimentacionIA ?? null,
    respuestas,
    temasCorrectos,
    temasPorReforzar,
  };
};

// Includes reutilizables para construir un resultado completo.
const includeResultado = {
  estudiante: { select: usuarioPublico },
  evaluacion: {
    include: {
      curso: { select: { id: true, nombre: true, docenteId: true } },
      practicaAdaptativa: { select: { id: true, motivoResumen: true } },
    },
  },
  respuestas: {
    orderBy: { preguntaId: "asc" },
    include: {
      pregunta: { include: { alternativas: { orderBy: { id: "asc" } } } },
      alternativa: true,
    },
  },
};

const intentosService = {
  // Crea o recupera un intento EN_PROGRESO y devuelve las preguntas sin
  // respuestas correctas. Solo para estudiantes matriculados.
  async iniciar(evaluacionId, usuario) {
    const evaluacion = await prisma.evaluacion.findUnique({
      where: { id: evaluacionId },
      include: {
        preguntas: {
          orderBy: { id: "asc" },
          include: { alternativas: { orderBy: { id: "asc" } } },
        },
      },
    });

    if (!evaluacion) {
      throw ApiError.notFound("Evaluación no encontrada");
    }

    const matriculado = await estaMatriculado(evaluacion.cursoId, usuario.id);
    if (!matriculado) {
      throw ApiError.forbidden("No estás matriculado en este curso");
    }

    if (evaluacion.esPracticaAdaptativa) {
      if (evaluacion.estudianteObjetivoId !== usuario.id) {
        throw ApiError.forbidden("Esta práctica adaptativa no está disponible para ti");
      }
    } else if (evaluacion.estado !== "PUBLICADA") {
      throw ApiError.forbidden("Esta evaluación no está disponible");
    }

    let intento = await prisma.intentoEvaluacion.findUnique({
      where: {
        estudianteId_evaluacionId: {
          estudianteId: usuario.id,
          evaluacionId,
        },
      },
      include: { respuestas: true },
    });

    if (intento?.estado === "FINALIZADO") {
      throw ApiError.conflict(
        "Ya realizaste esta evaluación. No puedes volver a intentarla.",
      );
    }

    if (!intento) {
      intento = await prisma.intentoEvaluacion.create({
        data: { evaluacionId, estudianteId: usuario.id },
        include: { respuestas: true },
      });

      if (evaluacion.esPracticaAdaptativa) {
        await prisma.practicaAdaptativa.updateMany({
          where: { evaluacionId, estado: "PENDIENTE" },
          data: { estado: "EN_CURSO" },
        });
      }
    }

    return {
      intento: {
        id: intento.id,
        estado: intento.estado,
        fechaInicio: intento.fechaInicio,
        evaluacionId: intento.evaluacionId,
      },
      evaluacion: ocultarRespuestas(evaluacion),
      // Respuestas ya guardadas (para reanudar el intento).
      respuestasGuardadas: intento.respuestas.map((r) => ({
        preguntaId: r.preguntaId,
        respuestaTexto: r.respuestaTexto,
        alternativaId: r.alternativaId,
      })),
    };
  },

  // Guarda o actualiza la respuesta del estudiante para una pregunta.
  async guardarRespuesta(intentoId, usuario, { preguntaId, respuestaTexto, alternativaId }) {
    const intento = await cargarIntentoPropio(intentoId, usuario.id);
    if (intento.estado !== "EN_PROGRESO") {
      throw ApiError.badRequest("El intento ya fue finalizado");
    }

    const pregunta = await prisma.pregunta.findUnique({
      where: { id: Number(preguntaId) },
      include: { alternativas: true },
    });
    if (!pregunta || pregunta.evaluacionId !== intento.evaluacionId) {
      throw ApiError.badRequest("La pregunta no pertenece a esta evaluación");
    }

    let altId = null;
    let texto = null;
    if (alternativaId !== undefined && alternativaId !== null && alternativaId !== "") {
      const alternativa = pregunta.alternativas.find(
        (alt) => alt.id === Number(alternativaId),
      );
      if (!alternativa) {
        throw ApiError.badRequest("La alternativa no pertenece a esta pregunta");
      }
      altId = alternativa.id;
    } else {
      texto = String(respuestaTexto);
    }

    const existente = await prisma.respuestaEstudiante.findFirst({
      where: { intentoId, preguntaId: pregunta.id },
    });

    const data = { respuestaTexto: texto, alternativaId: altId };

    const respuesta = existente
      ? await prisma.respuestaEstudiante.update({
          where: { id: existente.id },
          data,
        })
      : await prisma.respuestaEstudiante.create({
          data: { intentoId, preguntaId: pregunta.id, ...data },
        });

    // No se revela aún si es correcta (ocurre al finalizar).
    return {
      id: respuesta.id,
      preguntaId: respuesta.preguntaId,
      respuestaTexto: respuesta.respuestaTexto,
      alternativaId: respuesta.alternativaId,
    };
  },

  // Corrige el intento, calcula puntaje/porcentaje y lo marca FINALIZADO.
  async finalizar(intentoId, usuario) {
    const intento = await cargarIntentoPropio(intentoId, usuario.id);
    if (intento.estado === "FINALIZADO") {
      throw ApiError.badRequest("El intento ya fue finalizado");
    }

    const evaluacion = await prisma.evaluacion.findUnique({
      where: { id: intento.evaluacionId },
      include: { preguntas: { include: { alternativas: true } } },
    });

    const respuestas = await prisma.respuestaEstudiante.findMany({
      where: { intentoId },
    });
    const respuestaPorPregunta = new Map(
      respuestas.map((r) => [r.preguntaId, r]),
    );

    let puntajeTotal = 0;
    let puntajeMaximo = 0;
    const operaciones = [];

    for (const pregunta of evaluacion.preguntas) {
      puntajeMaximo += pregunta.puntaje;
      const respuesta = respuestaPorPregunta.get(pregunta.id);
      const respondida = Boolean(respuesta);
      let esCorrecta = false;

      if (respondida) {
        if (
          pregunta.tipo === "OPCION_MULTIPLE" ||
          pregunta.tipo === "VERDADERO_FALSO"
        ) {
          if (respuesta.alternativaId != null) {
            const alt = pregunta.alternativas.find(
              (a) => a.id === respuesta.alternativaId,
            );
            esCorrecta = Boolean(alt?.esCorrecta);
          }
        } else if (pregunta.tipo === "RESPUESTA_CORTA") {
          const dada = normalizar(respuesta.respuestaTexto);
          esCorrecta = dada !== "" && dada === normalizar(pregunta.respuestaCorrecta);
        }
      }

      const puntajeObtenido = esCorrecta ? pregunta.puntaje : 0;
      puntajeTotal += puntajeObtenido;
      const retroalimentacion = generarRetroalimentacion(
        esCorrecta,
        pregunta,
        respondida,
      );

      if (respuesta) {
        operaciones.push(
          prisma.respuestaEstudiante.update({
            where: { id: respuesta.id },
            data: { esCorrecta, puntajeObtenido, retroalimentacion },
          }),
        );
      } else {
        // Registra las preguntas no respondidas como incorrectas.
        operaciones.push(
          prisma.respuestaEstudiante.create({
            data: {
              intentoId,
              preguntaId: pregunta.id,
              respuestaTexto: null,
              alternativaId: null,
              esCorrecta: false,
              puntajeObtenido: 0,
              retroalimentacion,
            },
          }),
        );
      }
    }

    const porcentaje =
      puntajeMaximo > 0 ? Math.round((puntajeTotal / puntajeMaximo) * 10000) / 100 : 0;
    const nivelObtenido = nivelPorPorcentaje(porcentaje);

    operaciones.push(
      prisma.intentoEvaluacion.update({
        where: { id: intentoId },
        data: {
          estado: "FINALIZADO",
          fechaFin: new Date(),
          puntajeTotal,
          porcentaje,
          nivelObtenido,
        },
      }),
    );

    await prisma.$transaction(operaciones);

    const intentoFinal = await prisma.intentoEvaluacion.findUnique({
      where: { id: intentoId },
      include: includeResultado,
    });

    const resultado = construirResultado(intentoFinal);

    if (intentoFinal.evaluacion.esPracticaAdaptativa) {
      await prisma.practicaAdaptativa.updateMany({
        where: { evaluacionId: intentoFinal.evaluacionId },
        data: { estado: "COMPLETADA" },
      });
      return resultado;
    }

    // Aprendizaje adaptativo: determina nivel/recomendaciones y persiste
    // el progreso del estudiante por tema.
    const adaptativo = await adaptiveLearningService.procesarIntento({
      estudianteId: intentoFinal.estudianteId,
      cursoId: intentoFinal.evaluacion.cursoId,
      porcentaje: intentoFinal.porcentaje,
      respuestas: intentoFinal.respuestas.map((r) => ({
        tema: r.pregunta.tema,
        subtema: intentoFinal.evaluacion.subtema || r.pregunta.tema,
        esCorrecta: r.esCorrecta,
      })),
    });

    return { ...resultado, adaptativo };
  },

  // Devuelve el resultado completo de un intento. Accesible para el estudiante
  // dueño o el docente propietario del curso.
  async obtenerResultados(intentoId, usuario) {
    const intento = await prisma.intentoEvaluacion.findUnique({
      where: { id: intentoId },
      include: includeResultado,
    });

    if (!intento) {
      throw ApiError.notFound("Intento no encontrado");
    }

    if (usuario.rol === "ESTUDIANTE") {
      if (intento.estudianteId !== usuario.id) {
        throw ApiError.forbidden("Este intento no te pertenece");
      }
    } else if (usuario.rol === "DOCENTE") {
      if (intento.evaluacion.curso.docenteId !== usuario.id) {
        throw ApiError.forbidden("No eres el propietario de este curso");
      }
    } else {
      throw ApiError.forbidden("Acceso denegado");
    }

    if (intento.estado !== "FINALIZADO") {
      throw ApiError.badRequest("El intento aún no ha finalizado");
    }

    const resultado = construirResultado(intento);

    // Recalcula (sin persistir) nivel, mensaje y recomendaciones adaptativas
    // para mostrarlos en Resultados.jsx.
    const adaptativo = adaptiveLearningService.analizar({
      porcentaje: intento.porcentaje,
      respuestas: intento.respuestas.map((r) => ({
        tema: r.pregunta.tema,
        subtema: intento.evaluacion.subtema || r.pregunta.tema,
        esCorrecta: r.esCorrecta,
      })),
    });

    return { ...resultado, adaptativo };
  },
};

module.exports = intentosService;
