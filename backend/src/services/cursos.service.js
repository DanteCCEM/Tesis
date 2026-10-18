const prisma = require("../config/prisma");
const ApiError = require("../utils/ApiError");
const {
  determinarNivel,
  porcentajeANota20: aNota20,
  UMBRALES,
} = require("../config/learningRules");
const {
  verificarDocenteCurso,
  verificarEstudianteCurso,
} = require("./accesoAcademico.service");

const NIVEL_LABEL = {
  BASICO: "Básico",
  INTERMEDIO: "Intermedio",
  AVANZADO: "Avanzado",
  SIN_EVALUACIONES: "Sin evaluaciones",
};
const ESTADO_LABEL = { BORRADOR: "Borrador", PUBLICADA: "Publicada", CERRADA: "Cerrada" };
const redondear = (valor) => Math.round(valor * 100) / 100;
const incluirAsignacion = {
  areaCurricular: true,
  anioAcademico: true,
  seccion: { include: { grado: true } },
  docente: { select: { id: true, nombres: true } },
  cursoLegacy: {
    include: { _count: { select: { evaluaciones: true } } },
  },
};

const dtoCurso = (asignacion, rol) => {
  const curso = asignacion.cursoLegacy;
  if (!curso) return null;
  const base = {
    id: curso.id,
    asignacionCursoId: asignacion.id,
    nombre: asignacion.areaCurricular.nombre,
    descripcion: asignacion.areaCurricular.descripcion,
    grado: asignacion.seccion.grado.nombre,
    seccion: asignacion.seccion.nombre,
    anio: asignacion.anioAcademico.anio,
    estadoAsignacion: asignacion.estado,
    docente: asignacion.docente,
    _count: { evaluaciones: curso._count?.evaluaciones ?? 0 },
  };
  return rol === "DOCENTE"
    ? { ...base, cantidadEstudiantes: asignacion._count?.estudiantes ?? 0 }
    : base;
};

const estudiantesSeccion = async (asignacion) => {
  const matriculas = await prisma.matriculaAcademica.findMany({
    where: {
      seccionId: asignacion.seccionId,
      anioAcademicoId: asignacion.anioAcademicoId,
      estado: "ACTIVO",
      estudiante: { estado: "ACTIVO", rol: "ESTUDIANTE" },
    },
    orderBy: { estudiante: { nombres: "asc" } },
    select: {
      fechaMatricula: true,
      estudiante: {
        select: {
          id: true,
          nombres: true,
          perfilEstudiante: { select: { dni: true, codigoEstudiante: true } },
        },
      },
    },
  });
  return matriculas.map(({ estudiante, fechaMatricula }) => ({
    id: estudiante.id,
    nombres: estudiante.nombres,
    dni: estudiante.perfilEstudiante?.dni ?? null,
    codigoEstudiante: estudiante.perfilEstudiante?.codigoEstudiante ?? null,
    fechaMatricula,
  }));
};

const statsEstudiante = async (estudiante, cursoId, asignacionCursoId) => {
  const [intentos, progresos, historial] = await Promise.all([
    prisma.intentoEvaluacion.findMany({
      where: {
        estudianteId: estudiante.id,
        estado: "FINALIZADO",
        evaluacion: {
          cursoId,
          esPracticaAdaptativa: false,
        },
      },
      orderBy: { fechaFin: "desc" },
      include: {
        evaluacion: { select: { id: true, titulo: true, tema: true, tipoEvaluacion: true } },
        varianteEvaluacion: { select: { id: true, nivelObjetivo: true } },
      },
    }),
    prisma.progresoEstudiante.findMany({
      where: {
        estudianteId: estudiante.id,
        OR: [{ asignacionCursoId }, { cursoId }],
      },
      orderBy: { porcentajeDominio: "asc" },
    }),
    prisma.historialProgreso.findMany({
      where: { estudianteId: estudiante.id, asignacionCursoId },
      orderBy: [{ fecha: "asc" }, { id: "asc" }],
      select: {
        id: true, tema: true, porcentaje: true, nota: true,
        nivelAntes: true, nivelDespues: true, fecha: true,
        cantidadPreguntas: true, dificultadEvaluacion: true,
        evaluacionId: true, intentoId: true,
      },
    }),
  ]);

  const comparables = intentos.filter((item) => item.evaluacion.tipoEvaluacion !== "FORMATIVA_ADAPTATIVA");
  const promedio = comparables.length
    ? redondear(comparables.reduce((suma, item) => suma + item.porcentaje, 0) / comparables.length)
    : null;
  const nivelesPorTema = progresos.map((item) => ({
    tema: item.tema,
    nivelActual: item.nivelActual,
    porcentajeDominio: redondear(item.porcentajeDominio),
    cantidadEvaluaciones: item.cantidadEvaluaciones ?? 0,
    ultimaActualizacion: item.ultimaActualizacion,
  }));
  const temasDominados = nivelesPorTema.filter((item) => item.porcentajeDominio >= UMBRALES.UMBRAL_DOMINIO).map((item) => item.tema);
  const temasPorReforzar = nivelesPorTema.filter((item) => item.porcentajeDominio < UMBRALES.UMBRAL_DOMINIO).map((item) => item.tema);
  const ultimo = intentos[0] ?? null;
  const evolucion = historial.map((item) => ({
    id: item.id,
    tema: item.tema,
    fecha: item.fecha,
    porcentaje: redondear(item.porcentaje),
    nota: item.nota,
    nivelAntes: item.nivelAntes,
    nivelDespues: item.nivelDespues,
    cambioNivel: item.nivelAntes !== item.nivelDespues,
    cantidadPreguntas: item.cantidadPreguntas,
    dificultadEvaluacion: item.dificultadEvaluacion,
    evaluacionId: item.evaluacionId,
    intentoId: item.intentoId,
  }));

  return {
    ...estudiante,
    promedioGeneral: promedio,
    promedioNota: promedio == null ? null : aNota20(promedio),
    cantidadEvaluacionesRealizadas: intentos.length,
    nivelActual: nivelesPorTema[0]?.nivelActual ?? (promedio == null ? "SIN_EVALUACIONES" : determinarNivel(promedio)),
    nivelLabel: NIVEL_LABEL[nivelesPorTema[0]?.nivelActual] ?? (promedio == null ? NIVEL_LABEL.SIN_EVALUACIONES : NIVEL_LABEL[determinarNivel(promedio)]),
    nivelesPorTema,
    temasDominados,
    temasPorReforzar,
    evolucion,
    ultimaEvaluacion: ultimo ? {
      titulo: ultimo.evaluacion.titulo,
      puntaje: ultimo.puntajeTotal,
      porcentaje: redondear(ultimo.porcentaje),
      nota: aNota20(ultimo.porcentaje),
      fechaFin: ultimo.fechaFin,
      intentoId: ultimo.id,
      variante: ultimo.varianteEvaluacion,
      nivelAlRendir: ultimo.nivelAlRendir,
      nivelPosterior: ultimo.nivelObtenido,
    } : null,
  };
};

const rendimientoCurso = async (cursoId) => {
  const intentos = await prisma.intentoEvaluacion.findMany({
    where: {
      estado: "FINALIZADO",
      evaluacion: {
        cursoId,
        esPracticaAdaptativa: false,
        tipoEvaluacion: { not: "FORMATIVA_ADAPTATIVA" },
      },
    },
    include: {
      estudiante: { select: { id: true, nombres: true } },
      respuestas: { include: { pregunta: { select: { tema: true } } } },
    },
  });
  const promedio = intentos.length
    ? redondear(intentos.reduce((suma, item) => suma + item.porcentaje, 0) / intentos.length)
    : 0;
  const acumulado = new Map();
  for (const intento of intentos) {
    const actual = acumulado.get(intento.estudianteId) || { nombres: intento.estudiante.nombres, suma: 0, total: 0 };
    actual.suma += intento.porcentaje;
    actual.total += 1;
    acumulado.set(intento.estudianteId, actual);
  }
  const estudiantesBajoRendimiento = [...acumulado.entries()].map(([id, item]) => ({
    id,
    nombres: item.nombres,
    promedioPorcentaje: redondear(item.suma / item.total),
    promedioNota: aNota20(item.suma / item.total),
  })).filter((item) => item.promedioNota < 11).sort((a, b) => a.promedioNota - b.promedioNota);
  const temas = new Map();
  for (const intento of intentos) for (const respuesta of intento.respuestas) {
    const tema = respuesta.pregunta.tema;
    const actual = temas.get(tema) || { tema, total: 0, incorrectas: 0 };
    actual.total += 1;
    if (!respuesta.esCorrecta) actual.incorrectas += 1;
    temas.set(tema, actual);
  }
  const temasConMasErrores = [...temas.values()].filter((item) => item.incorrectas)
    .map((item) => ({ ...item, totalRespuestas: item.total, porcentajeError: redondear(item.incorrectas / item.total * 100) }))
    .sort((a, b) => b.incorrectas - a.incorrectas).slice(0, 8);
  return { promedioGeneral: aNota20(promedio), promedioPorcentaje: promedio, estudiantesBajoRendimiento, temasConMasErrores, intentosFinalizados: intentos.length };
};

const seguimientoPorTema = async (asignacionCursoId) => {
  const progresos = await prisma.progresoEstudiante.findMany({
    where: { asignacionCursoId },
    select: { tema: true, nivelActual: true, porcentajeDominio: true },
    orderBy: { tema: "asc" },
  });
  const temas = new Map();
  for (const progreso of progresos) {
    const actual = temas.get(progreso.tema) ?? {
      tema: progreso.tema,
      BASICO: 0,
      INTERMEDIO: 0,
      AVANZADO: 0,
      estudiantesConRegistro: 0,
      promedioPorcentaje: 0,
    };
    if (actual[progreso.nivelActual] !== undefined) actual[progreso.nivelActual] += 1;
    actual.estudiantesConRegistro += 1;
    actual.promedioPorcentaje += Number(progreso.porcentajeDominio ?? 0);
    temas.set(progreso.tema, actual);
  }
  return [...temas.values()].map((item) => ({
    ...item,
    promedioPorcentaje: item.estudiantesConRegistro
      ? redondear(item.promedioPorcentaje / item.estudiantesConRegistro)
      : 0,
  }));
};

const cursosService = {
  async listarMisCursos(usuario) {
    if (usuario.rol === "DOCENTE") {
      const asignaciones = await prisma.asignacionCurso.findMany({
        where: { docenteId: usuario.id, estado: "ACTIVO", anioAcademico: { estado: "ACTIVO" } },
        include: incluirAsignacion,
        orderBy: [{ anioAcademico: { anio: "desc" } }, { areaCurricular: { nombre: "asc" } }],
      });
      // Prisma no puede contar una relación indirecta; se resuelve por sección/año.
      return Promise.all(asignaciones.map(async (asignacion) => {
        const cantidadEstudiantes = await prisma.matriculaAcademica.count({
          where: { seccionId: asignacion.seccionId, anioAcademicoId: asignacion.anioAcademicoId, estado: "ACTIVO" },
        });
        return dtoCurso({ ...asignacion, _count: { estudiantes: cantidadEstudiantes } }, "DOCENTE");
      })).then((items) => items.filter(Boolean));
    }
    if (usuario.rol !== "ESTUDIANTE") throw ApiError.forbidden("Rol sin acceso a cursos");
    const matriculas = await prisma.matriculaAcademica.findMany({
      where: { estudianteId: usuario.id, estado: "ACTIVO", anioAcademico: { estado: "ACTIVO" } },
      include: {
        anioAcademico: {
          include: {
            asignaciones: {
              where: { estado: "ACTIVO" },
              include: incluirAsignacion,
              orderBy: { areaCurricular: { nombre: "asc" } },
            },
          },
        },
      },
    });
    return matriculas.flatMap((matricula) => matricula.anioAcademico.asignaciones
      .filter((asignacion) => asignacion.seccionId === matricula.seccionId)
      .map((asignacion) => dtoCurso(asignacion, "ESTUDIANTE"))
      .filter(Boolean));
  },

  async obtenerDetalleDocente(cursoId, docenteId) {
    const contexto = await verificarDocenteCurso(cursoId, docenteId);
    const curso = await prisma.curso.findUnique({
      where: { id: cursoId },
      include: { evaluaciones: { orderBy: { createdAt: "desc" }, include: { _count: { select: { preguntas: true } } } } },
    });
    const estudiantesBase = await estudiantesSeccion(contexto.asignacionCurso);
    const [estudiantes, rendimiento] = await Promise.all([
      Promise.all(estudiantesBase.map((item) => statsEstudiante(item, cursoId, contexto.asignacionCurso.id))),
      rendimientoCurso(cursoId),
    ]);
    return {
      id: curso.id,
      asignacionCursoId: contexto.asignacionCurso.id,
      nombre: contexto.asignacionCurso.areaCurricular.nombre,
      descripcion: contexto.asignacionCurso.areaCurricular.descripcion,
      grado: contexto.asignacionCurso.seccion.grado.nombre,
      seccion: contexto.asignacionCurso.seccion.nombre,
      anio: contexto.asignacionCurso.anioAcademico.anio,
      docente: { id: docenteId, nombres: contexto.asignacionCurso.docente?.nombres },
      cantidadEstudiantes: estudiantes.length,
      estudiantes,
      evaluaciones: curso.evaluaciones.map((ev) => ({
        id: ev.id, titulo: ev.titulo, tema: ev.tema, estado: ev.estado,
        estadoLabel: ESTADO_LABEL[ev.estado], tipoEvaluacion: ev.tipoEvaluacion,
        esAdaptativa: ev.esAdaptativa, nivelDificultad: ev.nivelDificultad,
        fechaLimite: ev.fechaLimite, totalPreguntas: ev._count.preguntas, createdAt: ev.createdAt,
      })),
      rendimiento,
      seguimientoPorTema: await seguimientoPorTema(contexto.asignacionCurso.id),
    };
  },

  async obtenerDetalleEstudiante(cursoId, estudianteId) {
    const contexto = await verificarEstudianteCurso(cursoId, estudianteId);
    const evaluacionesPublicadas = await prisma.evaluacion.count({
      where: { cursoId, estado: "PUBLICADA", esPracticaAdaptativa: false },
    });
    return {
      id: contexto.id,
      asignacionCursoId: contexto.asignacionCurso.id,
      nombre: contexto.asignacionCurso.areaCurricular.nombre,
      descripcion: contexto.asignacionCurso.areaCurricular.descripcion,
      grado: contexto.asignacionCurso.seccion.grado.nombre,
      seccion: contexto.asignacionCurso.seccion.nombre,
      anio: contexto.asignacionCurso.anioAcademico.anio,
      docente: { id: contexto.asignacionCurso.docenteId },
      cantidadEvaluaciones: evaluacionesPublicadas,
    };
  },

  async resumenEstudiantes(cursoId, docenteId) {
    const contexto = await verificarDocenteCurso(cursoId, docenteId);
    const estudiantes = await estudiantesSeccion(contexto.asignacionCurso);
    return Promise.all(estudiantes.map((item) => statsEstudiante(item, cursoId)));
  },
};

module.exports = cursosService;
