const prisma = require("../config/prisma");
const ApiError = require("../utils/ApiError");
const {
  determinarNivel,
  UMBRALES,
} = require("./adaptiveLearningService");

const NIVEL_LABEL = {
  BASICO: "Básico",
  INTERMEDIO: "Intermedio",
  AVANZADO: "Avanzado",
  SIN_EVALUACIONES: "Sin evaluaciones",
};

const ESTADO_LABEL = {
  BORRADOR: "Borrador",
  PUBLICADA: "Publicada",
  CERRADA: "Cerrada",
};

const redondear = (valor) => Math.round(valor * 100) / 100;
const aNota20 = (porcentaje) => Math.round((porcentaje / 5) * 10) / 10;

// Selección reutilizable de datos públicos de un usuario.
const usuarioPublico = { id: true, nombres: true, correo: true, rol: true };

// Verifica que el curso exista y que pertenezca al docente indicado.
const obtenerCursoPropio = async (cursoId, docenteId) => {
  const curso = await prisma.curso.findUnique({ where: { id: cursoId } });
  if (!curso) {
    throw ApiError.notFound("Curso no encontrado");
  }
  if (curso.docenteId !== docenteId) {
    throw ApiError.forbidden("No eres el propietario de este curso");
  }
  return curso;
};

// Capa de acceso a datos / lógica de negocio para Curso y Matricula.
const cursosService = {
  // Crea un curso asociado al docente autenticado.
  async crear({ nombre, grado, seccion, descripcion }, docenteId) {
    return prisma.curso.create({
      data: {
        nombre: String(nombre).trim(),
        grado: String(grado).trim(),
        seccion: String(seccion).trim(),
        descripcion: descripcion ? String(descripcion).trim() : null,
        docenteId,
      },
    });
  },

  // DOCENTE: cursos que creó. ESTUDIANTE: cursos donde está matriculado.
  async listarMisCursos(usuario) {
    if (usuario.rol === "DOCENTE") {
      return prisma.curso.findMany({
        where: { docenteId: usuario.id },
        orderBy: { createdAt: "desc" },
        include: {
          _count: { select: { matriculas: true, evaluaciones: true } },
        },
      });
    }

    const matriculas = await prisma.matricula.findMany({
      where: { estudianteId: usuario.id },
      orderBy: { fechaMatricula: "desc" },
      include: {
        curso: {
          include: {
            docente: { select: usuarioPublico },
            _count: { select: { matriculas: true, evaluaciones: true } },
          },
        },
      },
    });

    return matriculas.map((matricula) => matricula.curso);
  },

  // Detalle del curso con docente, estudiantes y evaluaciones.
  async obtenerDetalle(cursoId) {
    const curso = await prisma.curso.findUnique({
      where: { id: cursoId },
      include: {
        docente: { select: usuarioPublico },
        matriculas: {
          orderBy: { fechaMatricula: "asc" },
          include: { estudiante: { select: usuarioPublico } },
        },
        evaluaciones: { orderBy: { createdAt: "desc" } },
      },
    });

    if (!curso) {
      throw ApiError.notFound("Curso no encontrado");
    }

    const { matriculas, ...resto } = curso;
    return {
      ...resto,
      estudiantes: cursosService._mapearEstudiantes(matriculas),
    };
  },

  _mapearEstudiantes(matriculas) {
    return matriculas.map((matricula) => ({
      ...matricula.estudiante,
      matriculaId: matricula.id,
      fechaMatricula: matricula.fechaMatricula,
    }));
  },

  async _listarEstudiantes(cursoId) {
    const matriculas = await prisma.matricula.findMany({
      where: { cursoId },
      orderBy: { fechaMatricula: "asc" },
      include: { estudiante: { select: usuarioPublico } },
    });
    return cursosService._mapearEstudiantes(matriculas);
  },

  async _calcularStatsEstudianteEnCurso(estudianteId, cursoId) {
    const intentos = await prisma.intentoEvaluacion.findMany({
      where: {
        estudianteId,
        estado: "FINALIZADO",
        evaluacion: { cursoId },
      },
    });

    if (intentos.length === 0) {
      return {
        promedioPorcentaje: 0,
        promedioNota: 0,
        nivelActual: "BASICO",
        nivelLabel: NIVEL_LABEL.BASICO,
        evaluacionesRealizadas: 0,
      };
    }

    const promedioPorcentaje = redondear(
      intentos.reduce((acc, it) => acc + it.porcentaje, 0) / intentos.length,
    );
    const nivelActual = determinarNivel(promedioPorcentaje);

    return {
      promedioPorcentaje,
      promedioNota: aNota20(promedioPorcentaje),
      nivelActual,
      nivelLabel: NIVEL_LABEL[nivelActual],
      evaluacionesRealizadas: intentos.length,
    };
  },

  async _listarEstudiantesConStats(cursoId) {
    const estudiantes = await cursosService._listarEstudiantes(cursoId);
    return Promise.all(
      estudiantes.map(async (estudiante) => ({
        ...estudiante,
        ...(await cursosService._calcularStatsEstudianteEnCurso(
          estudiante.id,
          cursoId,
        )),
      })),
    );
  },

  async _calcularRendimientoCurso(cursoId) {
    const intentos = await prisma.intentoEvaluacion.findMany({
      where: {
        estado: "FINALIZADO",
        evaluacion: { cursoId },
      },
      include: {
        estudiante: { select: { id: true, nombres: true } },
        respuestas: {
          include: { pregunta: { select: { tema: true } } },
        },
      },
    });

    const promedioPorcentaje =
      intentos.length > 0
        ? redondear(
            intentos.reduce((acc, it) => acc + it.porcentaje, 0) / intentos.length,
          )
        : 0;

    const porEstudiante = new Map();
    for (const intento of intentos) {
      const previo = porEstudiante.get(intento.estudianteId) ?? {
        sum: 0,
        count: 0,
        nombres: intento.estudiante.nombres,
      };
      previo.sum += intento.porcentaje;
      previo.count += 1;
      porEstudiante.set(intento.estudianteId, previo);
    }

    const estudiantesBajoRendimiento = [...porEstudiante.entries()]
      .map(([id, datos]) => {
        const pct = datos.sum / datos.count;
        const nota = aNota20(pct);
        return {
          id,
          nombres: datos.nombres,
          promedioNota: nota,
          promedioPorcentaje: redondear(pct),
        };
      })
      .filter((est) => est.promedioNota < 11)
      .sort((a, b) => a.promedioNota - b.promedioNota);

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
      .filter((t) => t.incorrectas > 0)
      .map((t) => ({
        tema: t.tema,
        incorrectas: t.incorrectas,
        totalRespuestas: t.total,
        porcentajeError: redondear((t.incorrectas / t.total) * 100),
      }))
      .sort((a, b) => b.incorrectas - a.incorrectas || b.porcentajeError - a.porcentajeError)
      .slice(0, 8);

    return {
      promedioGeneral: aNota20(promedioPorcentaje),
      promedioPorcentaje,
      estudiantesBajoRendimiento,
      temasConMasErrores,
      intentosFinalizados: intentos.length,
    };
  },

  // Detalle completo del curso para el docente propietario.
  async obtenerDetalleDocente(cursoId, docenteId) {
    await obtenerCursoPropio(cursoId, docenteId);

    const curso = await prisma.curso.findUnique({
      where: { id: cursoId },
      include: {
        docente: { select: usuarioPublico },
        evaluaciones: {
          orderBy: { createdAt: "desc" },
          include: { _count: { select: { preguntas: true } } },
        },
      },
    });

    if (!curso) {
      throw ApiError.notFound("Curso no encontrado");
    }

    const [estudiantes, rendimiento] = await Promise.all([
      cursosService._listarEstudiantesConStats(cursoId),
      cursosService._calcularRendimientoCurso(cursoId),
    ]);

    const { evaluaciones, ...resto } = curso;

    return {
      ...resto,
      cantidadEstudiantes: estudiantes.length,
      estudiantes,
      evaluaciones: evaluaciones.map((ev) => ({
        id: ev.id,
        titulo: ev.titulo,
        tema: ev.tema,
        estado: ev.estado,
        estadoLabel: ESTADO_LABEL[ev.estado],
        nivelDificultad: ev.nivelDificultad,
        fechaLimite: ev.fechaLimite,
        totalPreguntas: ev._count.preguntas,
        createdAt: ev.createdAt,
      })),
      rendimiento,
    };
  },

  // Matricula a un estudiante (por correo o id) en el curso del docente.
  async matricular(cursoId, docenteId, { correo, estudianteId }) {
    await obtenerCursoPropio(cursoId, docenteId);

    const estudiante = estudianteId
      ? await prisma.usuario.findUnique({ where: { id: Number(estudianteId) } })
      : await prisma.usuario.findUnique({
          where: { correo: String(correo).trim() },
        });

    if (!estudiante) {
      throw ApiError.notFound("Estudiante no encontrado");
    }
    if (estudiante.rol !== "ESTUDIANTE") {
      throw ApiError.badRequest("El usuario indicado no es un estudiante");
    }

    const existente = await prisma.matricula.findUnique({
      where: {
        estudianteId_cursoId: { estudianteId: estudiante.id, cursoId },
      },
    });
    if (existente) {
      throw ApiError.conflict("El estudiante ya está matriculado en este curso");
    }

    return prisma.matricula.create({
      data: { estudianteId: estudiante.id, cursoId },
      include: { estudiante: { select: usuarioPublico } },
    });
  },

  // Elimina la matrícula de un estudiante en el curso del docente.
  // Los intentos e historial de evaluaciones se conservan.
  async eliminarMatricula(cursoId, docenteId, estudianteId) {
    await obtenerCursoPropio(cursoId, docenteId);

    const matricula = await prisma.matricula.findUnique({
      where: {
        estudianteId_cursoId: { estudianteId, cursoId },
      },
    });
    if (!matricula) {
      throw ApiError.notFound("El estudiante no está matriculado en este curso");
    }

    await prisma.matricula.delete({ where: { id: matricula.id } });

    const estudiantes = await cursosService.resumenEstudiantes(cursoId, docenteId);

    return {
      mensaje: "Estudiante eliminado del curso correctamente",
      estudiantes,
    };
  },

  // Resumen académico de estudiantes matriculados (solo docente propietario).
  async resumenEstudiantes(cursoId, docenteId) {
    await obtenerCursoPropio(cursoId, docenteId);

    const matriculas = await prisma.matricula.findMany({
      where: { cursoId },
      orderBy: { fechaMatricula: "asc" },
      include: {
        estudiante: { select: { id: true, nombres: true, correo: true } },
      },
    });

    const estudiantes = await Promise.all(
      matriculas.map(async ({ estudiante }) => {
        const intentos = await prisma.intentoEvaluacion.findMany({
          where: {
            estudianteId: estudiante.id,
            estado: "FINALIZADO",
            evaluacion: { cursoId, esPracticaAdaptativa: false },
          },
          orderBy: { fechaFin: "desc" },
          include: {
            evaluacion: { select: { titulo: true } },
          },
        });

        const progresos = await prisma.progresoEstudiante.findMany({
          where: {
            estudianteId: estudiante.id,
            cursoId,
            porcentajeDominio: { lt: UMBRALES.UMBRAL_AVANZADO },
          },
          orderBy: { porcentajeDominio: "asc" },
        });

        const temasPorReforzar = progresos.map((p) => p.tema);

        if (intentos.length === 0) {
          return {
            id: estudiante.id,
            nombres: estudiante.nombres,
            correo: estudiante.correo,
            promedioGeneral: null,
            promedioNota: null,
            cantidadEvaluacionesRealizadas: 0,
            nivelActual: "SIN_EVALUACIONES",
            nivelLabel: NIVEL_LABEL.SIN_EVALUACIONES,
            temasPorReforzar: [],
            ultimaEvaluacion: null,
          };
        }

        const promedioGeneral = redondear(
          intentos.reduce((acc, it) => acc + it.porcentaje, 0) / intentos.length,
        );
        const ultimo = intentos[0];

        return {
          id: estudiante.id,
          nombres: estudiante.nombres,
          correo: estudiante.correo,
          promedioGeneral,
          promedioNota: aNota20(promedioGeneral),
          cantidadEvaluacionesRealizadas: intentos.length,
          nivelActual: determinarNivel(promedioGeneral),
          nivelLabel: NIVEL_LABEL[determinarNivel(promedioGeneral)],
          temasPorReforzar,
          ultimaEvaluacion: {
            titulo: ultimo.evaluacion.titulo,
            puntaje: ultimo.puntajeTotal,
            porcentaje: redondear(ultimo.porcentaje),
            nota: aNota20(ultimo.porcentaje),
            fechaFin: ultimo.fechaFin,
            intentoId: ultimo.id,
          },
        };
      }),
    );

    return estudiantes;
  },
};

module.exports = cursosService;
