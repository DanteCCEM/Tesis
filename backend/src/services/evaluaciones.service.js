const prisma = require("../config/prisma");
const ApiError = require("../utils/ApiError");
const planCurricularService = require("./planCurricular.service");

// Verifica que el curso exista y pertenezca al docente indicado.
const verificarCursoPropio = async (cursoId, docenteId) => {
  const curso = await prisma.curso.findUnique({ where: { id: cursoId } });
  if (!curso) {
    throw ApiError.notFound("Curso no encontrado");
  }
  if (curso.docenteId !== docenteId) {
    throw ApiError.forbidden("No eres el propietario de este curso");
  }
  return curso;
};

// Verifica que la evaluación exista y pertenezca al docente indicado.
const verificarEvaluacionPropia = async (evaluacionId, docenteId) => {
  const evaluacion = await prisma.evaluacion.findUnique({
    where: { id: evaluacionId },
  });
  if (!evaluacion) {
    throw ApiError.notFound("Evaluación no encontrada");
  }
  if (evaluacion.docenteId !== docenteId) {
    throw ApiError.forbidden("No eres el propietario de esta evaluación");
  }
  return evaluacion;
};

// Indica si el estudiante está matriculado en el curso.
const estaMatriculado = async (cursoId, estudianteId) => {
  const matricula = await prisma.matricula.findUnique({
    where: { estudianteId_cursoId: { estudianteId, cursoId } },
  });
  return Boolean(matricula);
};

// Normaliza distintas formas de "verdadero/falso" a un valor canónico.
const normalizarVerdaderoFalso = (valor) => {
  const v = String(valor).trim().toLowerCase();
  return ["true", "verdadero", "v"].includes(v) ? "VERDADERO" : "FALSO";
};

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

const evaluacionesService = {
  // Crea una evaluación en un curso del docente autenticado.
  async crear(datos, docenteId) {
    const cursoId = Number(datos.cursoId);
    await verificarCursoPropio(cursoId, docenteId);

    const nivel = datos.dificultad ?? datos.nivelDificultad;

    const refs = await planCurricularService.validarReferenciasEvaluacion(
      cursoId,
      datos.temaCurricularId,
      datos.subtemaCurricularId,
    );

    return prisma.evaluacion.create({
      data: {
        titulo: String(datos.titulo).trim(),
        tema: String(datos.tema).trim(),
        subtema: datos.subtema ? String(datos.subtema).trim() : null,
        nivelDificultad: nivel,
        fechaLimite: datos.fechaLimite ? new Date(datos.fechaLimite) : null,
        estado: datos.estado ?? "BORRADOR",
        cursoId,
        docenteId,
        temaCurricularId: refs.temaCurricularId,
        subtemaCurricularId: refs.subtemaCurricularId,
      },
    });
  },

  // Agrega una pregunta (con alternativas/respuesta) a una evaluación propia.
  async agregarPregunta(evaluacionId, docenteId, datos) {
    await verificarEvaluacionPropia(evaluacionId, docenteId);

    const base = {
      enunciado: String(datos.enunciado).trim(),
      tipo: datos.tipo,
      dificultad: datos.dificultad,
      tema: String(datos.tema).trim(),
      puntaje: datos.puntaje !== undefined ? Number(datos.puntaje) : 1,
      evaluacionId,
    };

    if (datos.tipo === "OPCION_MULTIPLE") {
      return prisma.pregunta.create({
        data: {
          ...base,
          respuestaCorrecta: datos.respuestaCorrecta
            ? String(datos.respuestaCorrecta).trim()
            : null,
          alternativas: {
            create: datos.alternativas.map((alt) => ({
              texto: String(alt.texto).trim(),
              esCorrecta: alt.esCorrecta === true,
            })),
          },
        },
        include: { alternativas: true },
      });
    }

    if (datos.tipo === "VERDADERO_FALSO") {
      const correcta = normalizarVerdaderoFalso(datos.respuestaCorrecta);
      return prisma.pregunta.create({
        data: {
          ...base,
          respuestaCorrecta: correcta,
          alternativas: {
            create: [
              { texto: "Verdadero", esCorrecta: correcta === "VERDADERO" },
              { texto: "Falso", esCorrecta: correcta === "FALSO" },
            ],
          },
        },
        include: { alternativas: true },
      });
    }

    // RESPUESTA_CORTA
    return prisma.pregunta.create({
      data: {
        ...base,
        respuestaCorrecta: String(datos.respuestaCorrecta).trim(),
      },
      include: { alternativas: true },
    });
  },

  // Lista evaluaciones de un curso según el rol del usuario.
  async listarPorCurso(cursoId, usuario) {
    const curso = await prisma.curso.findUnique({ where: { id: cursoId } });
    if (!curso) {
      throw ApiError.notFound("Curso no encontrado");
    }

    if (usuario.rol === "DOCENTE") {
      if (curso.docenteId !== usuario.id) {
        throw ApiError.forbidden("No eres el propietario de este curso");
      }
      return prisma.evaluacion.findMany({
        where: { cursoId, esPracticaAdaptativa: false },
        orderBy: { createdAt: "desc" },
        include: { _count: { select: { preguntas: true } } },
      });
    }

    // ESTUDIANTE: solo evaluaciones PUBLICADAS de cursos donde está matriculado.
    const matriculado = await estaMatriculado(cursoId, usuario.id);
    if (!matriculado) {
      throw ApiError.forbidden("No estás matriculado en este curso");
    }

    const evaluaciones = await prisma.evaluacion.findMany({
      where: {
        cursoId,
        estado: "PUBLICADA",
        OR: [
          { esPracticaAdaptativa: false },
          { esPracticaAdaptativa: true, estudianteObjetivoId: usuario.id },
        ],
      },
      orderBy: { createdAt: "desc" },
      include: { _count: { select: { preguntas: true } } },
    });

    if (evaluaciones.length === 0) {
      return evaluaciones;
    }

    const intentos = await prisma.intentoEvaluacion.findMany({
      where: {
        estudianteId: usuario.id,
        evaluacionId: { in: evaluaciones.map((ev) => ev.id) },
      },
      select: { id: true, evaluacionId: true, estado: true },
    });

    const intentosPorEvaluacion = new Map(
      intentos.map((intento) => [intento.evaluacionId, intento]),
    );

    return evaluaciones.map((evaluacion) => {
      const miIntento = intentosPorEvaluacion.get(evaluacion.id);
      return {
        ...evaluacion,
        miIntento: miIntento
          ? { id: miIntento.id, estado: miIntento.estado }
          : null,
      };
    });
  },

  // Detalle de una evaluación con sus preguntas (respetando permisos).
  async obtenerDetalle(evaluacionId, usuario) {
    const evaluacion = await prisma.evaluacion.findUnique({
      where: { id: evaluacionId },
      include: {
        curso: { select: { id: true, nombre: true, docenteId: true } },
        preguntas: {
          orderBy: { id: "asc" },
          include: { alternativas: { orderBy: { id: "asc" } } },
        },
      },
    });

    if (!evaluacion) {
      throw ApiError.notFound("Evaluación no encontrada");
    }

    if (usuario.rol === "DOCENTE") {
      if (evaluacion.docenteId !== usuario.id) {
        throw ApiError.forbidden("No eres el propietario de esta evaluación");
      }
      return evaluacion;
    }

    // ESTUDIANTE: matriculado y evaluación disponible (formal publicada o práctica personal).
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

    // Solo se exponen respuestas correctas si ya finalizó un intento.
    const intentoFinalizado = await prisma.intentoEvaluacion.findFirst({
      where: {
        evaluacionId,
        estudianteId: usuario.id,
        estado: "FINALIZADO",
      },
    });

    return intentoFinalizado ? evaluacion : ocultarRespuestas(evaluacion);
  },

  // Edita una evaluación propia (campos parciales).
  async actualizar(evaluacionId, docenteId, datos) {
    const evaluacion = await verificarEvaluacionPropia(evaluacionId, docenteId);

    const data = {};
    if (datos.titulo !== undefined) data.titulo = String(datos.titulo).trim();
    if (datos.tema !== undefined) data.tema = String(datos.tema).trim();
    if (datos.subtema !== undefined) {
      data.subtema = datos.subtema ? String(datos.subtema).trim() : null;
    }
    const nivel = datos.dificultad ?? datos.nivelDificultad;
    if (nivel !== undefined) data.nivelDificultad = nivel;
    if (datos.estado !== undefined) data.estado = datos.estado;
    if (datos.fechaLimite !== undefined) {
      data.fechaLimite = datos.fechaLimite ? new Date(datos.fechaLimite) : null;
    }

    if (
      datos.temaCurricularId !== undefined ||
      datos.subtemaCurricularId !== undefined
    ) {
      const temaId =
        datos.temaCurricularId !== undefined
          ? datos.temaCurricularId
          : evaluacion.temaCurricularId;
      const subtemaId =
        datos.subtemaCurricularId !== undefined
          ? datos.subtemaCurricularId
          : evaluacion.subtemaCurricularId;

      const refs = await planCurricularService.validarReferenciasEvaluacion(
        evaluacion.cursoId,
        temaId,
        subtemaId,
      );
      data.temaCurricularId = refs.temaCurricularId;
      data.subtemaCurricularId = refs.subtemaCurricularId;
    }

    return prisma.evaluacion.update({ where: { id: evaluacionId }, data });
  },

  // Publica una evaluación propia.
  async publicar(evaluacionId, docenteId) {
    await verificarEvaluacionPropia(evaluacionId, docenteId);
    return prisma.evaluacion.update({
      where: { id: evaluacionId },
      data: { estado: "PUBLICADA" },
    });
  },

  // Elimina una evaluación propia (preguntas en cascada por el schema).
  async eliminar(evaluacionId, docenteId) {
    await verificarEvaluacionPropia(evaluacionId, docenteId);
    await prisma.evaluacion.delete({ where: { id: evaluacionId } });
  },

  // Analítica agregada del aula para una evaluación (solo docente propietario).
  async obtenerAnalitica(evaluacionId, docenteId) {
    await verificarEvaluacionPropia(evaluacionId, docenteId);

    const evaluacion = await prisma.evaluacion.findUnique({
      where: { id: evaluacionId },
      include: {
        curso: { select: { id: true, nombre: true } },
        preguntas: {
          select: { id: true, enunciado: true, tema: true },
          orderBy: { id: "asc" },
        },
      },
    });

    const [estudiantesMatriculados, intentos] = await Promise.all([
      prisma.matricula.count({ where: { cursoId: evaluacion.cursoId } }),
      prisma.intentoEvaluacion.findMany({
        where: { evaluacionId, estado: "FINALIZADO" },
        include: {
          estudiante: { select: { id: true, nombres: true, correo: true } },
          respuestas: {
            include: {
              pregunta: { select: { id: true, tema: true, enunciado: true } },
            },
          },
        },
        orderBy: { porcentaje: "desc" },
      }),
    ]);

    const redondear = (valor) => Math.round(valor * 100) / 100;
    const aNota20 = (porcentaje) => Math.round((porcentaje / 5) * 10) / 10;

    const intentosFinalizados = intentos.length;
    const promedioPorcentaje =
      intentosFinalizados > 0
        ? redondear(
            intentos.reduce((acc, it) => acc + it.porcentaje, 0) /
              intentosFinalizados,
          )
        : 0;

    const estudiantes = intentos.map((it) => {
      const nota = aNota20(it.porcentaje);
      const temasFallados = [
        ...new Set(
          it.respuestas
            .filter((r) => !r.esCorrecta)
            .map((r) => r.pregunta.tema),
        ),
      ];
      const recomendacion =
        temasFallados.length > 0
          ? `Reforzar: ${temasFallados.slice(0, 2).join(", ")}`
          : "Excelente desempeño; puede avanzar a retos mayores.";

      return {
        id: it.estudianteId,
        intentoId: it.id,
        nombres: it.estudiante.nombres,
        porcentaje: redondear(it.porcentaje),
        nota,
        nivelObtenido: it.nivelObtenido,
        aprobado: nota >= 11,
        recomendacion,
      };
    });

    const aprobados = estudiantes.filter((e) => e.aprobado).length;
    const reprobados = estudiantes.filter((e) => !e.aprobado).length;
    const porcentajeAprobacion =
      intentosFinalizados > 0
        ? redondear((aprobados / intentosFinalizados) * 100)
        : 0;

    const preguntaStats = new Map();
    for (const pregunta of evaluacion.preguntas) {
      preguntaStats.set(pregunta.id, {
        id: pregunta.id,
        enunciado: pregunta.enunciado,
        tema: pregunta.tema,
        total: 0,
        incorrectas: 0,
      });
    }

    for (const intento of intentos) {
      for (const respuesta of intento.respuestas) {
        const stat = preguntaStats.get(respuesta.preguntaId);
        if (!stat) continue;
        stat.total += 1;
        if (!respuesta.esCorrecta) stat.incorrectas += 1;
      }
    }

    const preguntasConMasErrores = [...preguntaStats.values()]
      .filter((p) => p.total > 0 && p.incorrectas > 0)
      .map((p) => ({
        id: p.id,
        enunciado: p.enunciado,
        tema: p.tema,
        totalRespuestas: p.total,
        incorrectas: p.incorrectas,
        porcentajeError: redondear((p.incorrectas / p.total) * 100),
      }))
      .sort(
        (a, b) =>
          b.porcentajeError - a.porcentajeError || b.incorrectas - a.incorrectas,
      )
      .slice(0, 8);

    const temaStats = new Map();
    for (const intento of intentos) {
      for (const respuesta of intento.respuestas) {
        const { tema } = respuesta.pregunta;
        if (!temaStats.has(tema)) {
          temaStats.set(tema, { tema, total: 0, incorrectas: 0 });
        }
        const stat = temaStats.get(tema);
        stat.total += 1;
        if (!respuesta.esCorrecta) stat.incorrectas += 1;
      }
    }

    const temasConMasErrores = [...temaStats.values()]
      .filter((t) => t.total > 0 && t.incorrectas > 0)
      .map((t) => ({
        tema: t.tema,
        totalRespuestas: t.total,
        incorrectas: t.incorrectas,
        porcentajeError: redondear((t.incorrectas / t.total) * 100),
      }))
      .sort(
        (a, b) =>
          b.porcentajeError - a.porcentajeError || b.incorrectas - a.incorrectas,
      )
      .slice(0, 8);

    return {
      evaluacion: {
        id: evaluacion.id,
        titulo: evaluacion.titulo,
        tema: evaluacion.tema,
        estado: evaluacion.estado,
        nivelDificultad: evaluacion.nivelDificultad,
        totalPreguntas: evaluacion.preguntas.length,
        curso: evaluacion.curso,
      },
      resumen: {
        estudiantesMatriculados,
        intentosFinalizados,
        pendientes: Math.max(0, estudiantesMatriculados - intentosFinalizados),
        promedioPorcentaje,
        promedioNota: aNota20(promedioPorcentaje),
        aprobados,
        reprobados,
        porcentajeAprobacion,
        estudiantesPorReforzar: reprobados,
      },
      preguntasConMasErrores,
      temasConMasErrores,
      estudiantes,
    };
  },
};

module.exports = evaluacionesService;
