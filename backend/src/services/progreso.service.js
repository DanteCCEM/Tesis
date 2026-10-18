const prisma = require("../config/prisma");
const ApiError = require("../utils/ApiError");
const { verificarEstudianteCurso } = require("./accesoAcademico.service");
const {
  determinarNivel,
  porcentajeANota20,
  redondearPorcentaje,
  esTemaDominado,
} = require("../config/learningRules");
const { construirRecomendacion } = require("./adaptiveLearningService");

const NIVEL_LABEL = {
  BASICO: "Básico",
  INTERMEDIO: "Intermedio",
  AVANZADO: "Avanzado",
};

const redondear = redondearPorcentaje;
const aNota20 = porcentajeANota20;

const normalizarTema = (valor) => String(valor ?? "").trim().toLowerCase();

const calcularEstadoEstudiante = ({
  finalizadas,
  enProgreso,
  porcentajeDominio,
  promedioEvaluaciones,
}) => {
  const dominio =
    porcentajeDominio ??
    (Number.isFinite(promedioEvaluaciones) ? promedioEvaluaciones : null);

  if (dominio != null && esTemaDominado(dominio)) {
    return "COMPLETADO";
  }
  if (
    enProgreso > 0 ||
    finalizadas > 0 ||
    (dominio != null && dominio > 0)
  ) {
    return "EN_PROCESO";
  }
  return "PENDIENTE";
};

const construirPorTema = (intentos, progresos) => {
  const acumulado = new Map();

  for (const intento of intentos) {
    const evaluacion = intento.evaluacion;
    const claves = [];

    if (evaluacion.temaCurricularId != null) {
      claves.push(`id:${evaluacion.temaCurricularId}`);
    }
    claves.push(`text:${normalizarTema(evaluacion.tema)}`);

    for (const clave of claves) {
      if (!acumulado.has(clave)) {
        acumulado.set(clave, {
          temaCurricularId: evaluacion.temaCurricularId ?? null,
          tema: evaluacion.tema,
          intentoIds: new Set(),
          finalizadas: [],
          enProgreso: 0,
        });
      }

      const entrada = acumulado.get(clave);
      if (entrada.intentoIds.has(intento.id)) continue;
      entrada.intentoIds.add(intento.id);

      if (intento.estado === "FINALIZADO") {
        entrada.finalizadas.push(intento);
      } else if (intento.estado === "EN_PROGRESO") {
        entrada.enProgreso += 1;
      }
    }
  }

  const resumenPorTexto = new Map(
    progresos.map((progreso) => [
      normalizarTema(progreso.tema),
      {
        porcentajeDominio: redondear(progreso.porcentajeDominio),
        nivelActual: progreso.nivelActual,
        cantidadEvaluaciones: progreso.cantidadEvaluaciones ?? 0,
      },
    ]),
  );

  const consolidado = new Map();

  for (const entrada of acumulado.values()) {
    const claveResultado =
      entrada.temaCurricularId != null
        ? `id:${entrada.temaCurricularId}`
        : `text:${normalizarTema(entrada.tema)}`;

    if (consolidado.has(claveResultado)) continue;

    const promedioEvaluaciones =
      entrada.finalizadas.length > 0
        ? redondear(
            entrada.finalizadas.reduce(
              (acc, intento) => acc + intento.porcentaje,
              0,
            ) / entrada.finalizadas.length,
          )
        : null;

    const resumenTema = resumenPorTexto.get(normalizarTema(entrada.tema));
    const porcentajeDominio =
      resumenTema?.porcentajeDominio ?? promedioEvaluaciones;

    consolidado.set(claveResultado, {
      temaCurricularId: entrada.temaCurricularId,
      tema: entrada.tema,
      estadoEstudiante: calcularEstadoEstudiante({
        finalizadas: entrada.finalizadas.length,
        enProgreso: entrada.enProgreso,
        porcentajeDominio,
        promedioEvaluaciones,
      }),
      porcentajeDominio,
      nivelActual:
        resumenTema?.nivelActual ??
        (porcentajeDominio != null ? determinarNivel(porcentajeDominio) : null),
      cantidadEvaluaciones:
        resumenTema?.cantidadEvaluaciones ?? entrada.finalizadas.length,
      promedioEvaluaciones,
      evaluacionesFinalizadas: entrada.finalizadas.length,
      tieneIntentoEnProgreso: entrada.enProgreso > 0,
    });
  }

  for (const progreso of progresos) {
    const clave = `text:${normalizarTema(progreso.tema)}`;
    const yaIncluido = [...consolidado.values()].some(
      (item) => normalizarTema(item.tema) === normalizarTema(progreso.tema),
    );
    if (yaIncluido) continue;

    const porcentajeDominio = redondear(progreso.porcentajeDominio);
    consolidado.set(clave, {
      temaCurricularId: null,
      tema: progreso.tema,
      estadoEstudiante: calcularEstadoEstudiante({
        finalizadas: 0,
        enProgreso: 0,
        porcentajeDominio,
        promedioEvaluaciones: null,
      }),
      porcentajeDominio,
      nivelActual: progreso.nivelActual,
      cantidadEvaluaciones: progreso.cantidadEvaluaciones ?? 0,
      promedioEvaluaciones: null,
      evaluacionesFinalizadas: 0,
      tieneIntentoEnProgreso: false,
    });
  }

  return [...consolidado.values()].sort((a, b) =>
    a.tema.localeCompare(b.tema, "es"),
  );
};

const verificarMatricula = async (estudianteId, cursoId) => {
  await verificarEstudianteCurso(cursoId, estudianteId);
};

const enteroPositivo = (valor, nombre, { opcional = true } = {}) => {
  if ((valor === undefined || valor === null || valor === "") && opcional) return null;
  const numero = Number(valor);
  if (!Number.isInteger(numero) || numero <= 0) {
    throw ApiError.badRequest(`${nombre} inválido`);
  }
  return numero;
};

const construirFiltrosHistorial = (filtros = {}) => {
  const asignacionCursoId = enteroPositivo(
    filtros.asignacionCursoId,
    "asignacionCursoId",
  );
  const temaCurricularId = enteroPositivo(
    filtros.temaCurricularId,
    "temaCurricularId",
  );
  const limiteSolicitado = filtros.limite == null ? 500 : Number(filtros.limite);
  if (!Number.isInteger(limiteSolicitado) || limiteSolicitado < 1) {
    throw ApiError.badRequest("limite inválido");
  }

  const where = {};
  if (asignacionCursoId) where.asignacionCursoId = asignacionCursoId;
  if (temaCurricularId) where.temaCurricularId = temaCurricularId;

  if (filtros.desde || filtros.hasta) {
    where.fecha = {};
    if (filtros.desde) {
      const desde = new Date(filtros.desde);
      if (Number.isNaN(desde.getTime())) throw ApiError.badRequest("desde inválido");
      where.fecha.gte = desde;
    }
    if (filtros.hasta) {
      const hasta = new Date(filtros.hasta);
      if (Number.isNaN(hasta.getTime())) throw ApiError.badRequest("hasta inválido");
      where.fecha.lte = hasta;
    }
  }

  return {
    where,
    asignacionCursoId,
    temaCurricularId,
    limite: Math.min(limiteSolicitado, 500),
  };
};

const obtenerAsignacion = async (asignacionCursoId) => {
  const asignacion = await prisma.asignacionCurso.findUnique({
    where: { id: asignacionCursoId },
    include: {
      areaCurricular: true,
      anioAcademico: true,
      seccion: { include: { grado: true } },
    },
  });
  if (!asignacion) throw ApiError.notFound("Asignación académica no encontrada");
  return asignacion;
};

const verificarEstudianteEnAsignacion = async (estudianteId, asignacion) => {
  const matricula = await prisma.matriculaAcademica.findFirst({
    where: {
      estudianteId,
      seccionId: asignacion.seccionId,
      anioAcademicoId: asignacion.anioAcademicoId,
      estado: "ACTIVO",
    },
    select: { id: true },
  });
  if (!matricula) {
    throw ApiError.forbidden("El estudiante no pertenece a esta asignación");
  }
};

const consultarEvolucion = async (estudianteId, filtros = {}) => {
  const estudianteIdNum = enteroPositivo(estudianteId, "estudianteId", {
    opcional: false,
  });
  const normalizados = construirFiltrosHistorial(filtros);
  const where = { estudianteId: estudianteIdNum, ...normalizados.where };
  const whereResumen = { estudianteId: estudianteIdNum };
  if (normalizados.asignacionCursoId) {
    whereResumen.asignacionCursoId = normalizados.asignacionCursoId;
  }
  if (normalizados.temaCurricularId) {
    whereResumen.temaCurricularId = normalizados.temaCurricularId;
  }

  const [estudiante, resumenes, historial] = await Promise.all([
    prisma.usuario.findUnique({
      where: { id: estudianteIdNum },
      select: { id: true, username: true, nombres: true, rol: true },
    }),
    prisma.progresoEstudiante.findMany({
      where: whereResumen,
      orderBy: [{ asignacionCursoId: "asc" }, { tema: "asc" }],
      include: {
        temaCurricular: { select: { id: true, titulo: true } },
        asignacionCurso: {
          select: {
            id: true,
            areaCurricular: { select: { id: true, nombre: true } },
            anioAcademico: { select: { id: true, anio: true } },
            seccion: {
              select: {
                id: true,
                nombre: true,
                grado: { select: { id: true, nombre: true } },
              },
            },
          },
        },
      },
    }),
    prisma.historialProgreso.findMany({
      where,
      orderBy: [{ fecha: "desc" }, { id: "desc" }],
      take: normalizados.limite,
      include: {
        evaluacion: {
          select: { id: true, titulo: true, tipoEvaluacion: true },
        },
        temaCurricular: { select: { id: true, titulo: true } },
        subtemaCurricular: { select: { id: true, titulo: true } },
        asignacionCurso: {
          select: {
            id: true,
            areaCurricular: { select: { id: true, nombre: true } },
            anioAcademico: { select: { id: true, anio: true } },
            seccion: {
              select: {
                id: true,
                nombre: true,
                grado: { select: { id: true, nombre: true } },
              },
            },
          },
        },
      },
    }),
  ]);

  if (!estudiante) throw ApiError.notFound("Estudiante no encontrado");
  if (estudiante.rol !== "ESTUDIANTE") {
    throw ApiError.badRequest("El usuario indicado no es estudiante");
  }

  // La consulta limita los registros más recientes; la respuesta se ordena
  // cronológicamente para graficar la evolución sin procesamiento adicional.
  historial.reverse();

  const porTema = new Map();
  for (const registro of historial) {
    const clave = `${registro.asignacionCursoId}:${registro.temaCurricularId ?? registro.tema}`;
    if (!porTema.has(clave)) {
      porTema.set(clave, {
        asignacionCursoId: registro.asignacionCursoId,
        temaCurricularId: registro.temaCurricularId,
        tema: registro.tema,
        puntos: [],
      });
    }
    porTema.get(clave).puntos.push({
      historialId: registro.id,
      evaluacionId: registro.evaluacionId,
      intentoId: registro.intentoId,
      fecha: registro.fecha,
      porcentaje: registro.porcentaje,
      nota: registro.nota,
      nivelAntes: registro.nivelAntes,
      nivelDespues: registro.nivelDespues,
    });
  }

  return {
    estudiante,
    filtros: {
      asignacionCursoId: normalizados.asignacionCursoId,
      temaCurricularId: normalizados.temaCurricularId,
      limite: normalizados.limite,
    },
    resumenes,
    historial,
    evolucionPorTema: [...porTema.values()],
  };
};

// Capa de acceso a datos / lógica de negocio para ProgresoEstudiante.
const progresoService = {
  // Progreso del estudiante autenticado (global o filtrado por curso).
  async obtenerMiProgreso(estudianteId, cursoId = null) {
    const cursoIdNum =
      cursoId != null && cursoId !== "" ? Number(cursoId) : null;

    if (
      cursoId != null &&
      cursoId !== "" &&
      (!Number.isInteger(cursoIdNum) || cursoIdNum <= 0)
    ) {
      throw ApiError.badRequest("cursoId inválido");
    }

    if (cursoIdNum) {
      await verificarMatricula(estudianteId, cursoIdNum);
    }

    const whereProgreso = { estudianteId };
    const filtroEvaluacion = { esPracticaAdaptativa: false };

    if (cursoIdNum) {
      whereProgreso.cursoId = cursoIdNum;
      filtroEvaluacion.cursoId = cursoIdNum;
    }

    const progresos = await prisma.progresoEstudiante.findMany({
      where: whereProgreso,
      orderBy: { porcentajeDominio: "desc" },
    });

    const intentos = await prisma.intentoEvaluacion.findMany({
      where: {
        estudianteId,
        estado: "FINALIZADO",
        evaluacion: filtroEvaluacion,
      },
      orderBy: { fechaFin: "asc" },
      include: {
        evaluacion: {
          select: {
            id: true,
            titulo: true,
            tema: true,
            cursoId: true,
            tipoEvaluacion: true,
          },
        },
      },
    });

    const intentosPorTema = cursoIdNum
      ? await prisma.intentoEvaluacion.findMany({
          where: {
            estudianteId,
            evaluacion: {
              ...filtroEvaluacion,
              estado: "PUBLICADA",
            },
          },
          include: {
            evaluacion: {
              select: {
                id: true,
                titulo: true,
                tema: true,
                temaCurricularId: true,
                cursoId: true,
              },
            },
          },
        })
      : [];

    // Las variantes adaptativas tienen exigencias distintas. Se conservan en
    // el historial, pero no se promedian entre sí ni con evaluaciones comunes.
    const intentosComparables = intentos.filter(
      (it) => it.evaluacion.tipoEvaluacion !== "FORMATIVA_ADAPTATIVA",
    );
    const evaluacionesRealizadas = intentos.length;
    const promedioPorcentaje =
      intentosComparables.length > 0
        ? redondear(
            intentosComparables.reduce((acc, it) => acc + it.porcentaje, 0) /
              intentosComparables.length,
          )
        : 0;
    const promedioNota = aNota20(promedioPorcentaje);
    const nivel = determinarNivel(promedioPorcentaje);

    const temasDominados = progresos
      .filter((p) => esTemaDominado(p.porcentajeDominio))
      .map((p) => ({
        tema: p.tema,
        porcentajeDominio: redondear(p.porcentajeDominio),
        nivelActual: p.nivelActual,
      }));

    const temasPorReforzar = progresos
      .filter((p) => !esTemaDominado(p.porcentajeDominio))
      .sort((a, b) => a.porcentajeDominio - b.porcentajeDominio)
      .map((p) => ({
        tema: p.tema,
        porcentajeDominio: redondear(p.porcentajeDominio),
        nivelActual: p.nivelActual,
        recomendaciones: p.recomendaciones,
      }));

    const evolucion = intentosComparables.map((it, index) => ({
      label: `Eval. ${index + 1}`,
      titulo: it.evaluacion.titulo,
      porcentaje: redondear(it.porcentaje),
      nota: aNota20(it.porcentaje),
      fecha: it.fechaFin,
      tipoEvaluacion: it.evaluacion.tipoEvaluacion,
      nivelAlRendir: it.nivelAlRendir,
      dificultadVariante: it.dificultadVariante,
      cantidadPreguntas: it.cantidadPreguntas,
    }));

    const historial = [...intentos]
      .sort((a, b) => new Date(b.fechaFin) - new Date(a.fechaFin))
      .map((it) => {
        const nota = aNota20(it.porcentaje);
        return {
          id: it.id,
          titulo: it.evaluacion.titulo,
          tema: it.evaluacion.tema,
          fecha: it.fechaFin,
          porcentaje: redondear(it.porcentaje),
          nota,
          nivelObtenido: it.nivelObtenido,
          nivelAlRendir: it.nivelAlRendir,
          dificultadVariante: it.dificultadVariante,
          cantidadPreguntas: it.cantidadPreguntas,
          tipoEvaluacion: it.evaluacion.tipoEvaluacion,
          aprobado:
            it.evaluacion.tipoEvaluacion === "FORMATIVA_ADAPTATIVA"
              ? null
              : nota >= 11,
        };
      });

    const variantes = new Map();
    for (const intento of intentos.filter(
      (it) => it.evaluacion.tipoEvaluacion === "FORMATIVA_ADAPTATIVA",
    )) {
      const clave = `${intento.nivelAlRendir ?? "BASICO"}:${intento.dificultadVariante ?? "BASICO"}:${intento.cantidadPreguntas ?? 0}`;
      const actual = variantes.get(clave) ?? {
        nivelAlRendir: intento.nivelAlRendir ?? "BASICO",
        dificultadVariante: intento.dificultadVariante ?? "BASICO",
        cantidadPreguntas: intento.cantidadPreguntas ?? 0,
        intentos: 0,
        sumaPorcentaje: 0,
      };
      actual.intentos += 1;
      actual.sumaPorcentaje += intento.porcentaje;
      variantes.set(clave, actual);
    }
    const resultadosAdaptativosPorVariante = [...variantes.values()].map(
      ({ sumaPorcentaje, ...variante }) => ({
        ...variante,
        promedioPorcentaje: redondear(sumaPorcentaje / variante.intentos),
        promedioNota: aNota20(sumaPorcentaje / variante.intentos),
      }),
    );

    const recomendacionDetalle = construirRecomendacion(nivel, {
      temasPorReforzar: temasPorReforzar.map((t) => t.tema),
      temasDominados: temasDominados.map((t) => t.tema),
      temasConMasErrores: temasPorReforzar.map((t) => t.tema),
    });
    const recomendaciones = [
      recomendacionDetalle.descripcion,
      ...recomendacionDetalle.acciones,
    ];

    const resultado = {
      // Compatibilidad visual: este nivel general es solo referencial. El perfil
      // de aprendizaje formal se encuentra en nivelesPorTema/porTema.
      nivelActual: nivel,
      nivelLabel: NIVEL_LABEL[nivel],
      nivelGeneralReferencial: nivel,
      promedioPorcentaje,
      promedioNota,
      evaluacionesRealizadas,
      evaluacionesComparables: intentosComparables.length,
      resultadosAdaptativosPorVariante,
      temasDominados,
      temasPorReforzar,
      recomendaciones,
      recomendacionDetalle,
      evolucion,
      historial,
      nivelesPorTema: progresos.map((p) => ({
        asignacionCursoId: p.asignacionCursoId,
        temaCurricularId: p.temaCurricularId,
        tema: p.tema,
        nivelActual: p.nivelActual,
        porcentajeDominio: redondear(p.porcentajeDominio),
        cantidadEvaluaciones: p.cantidadEvaluaciones ?? 0,
        ultimaActualizacion: p.ultimaActualizacion,
      })),
    };

    if (cursoIdNum) {
      resultado.cursoId = cursoIdNum;
      resultado.porTema = construirPorTema(intentosPorTema, progresos);
    }

    return resultado;
  },

  async obtenerMiEvolucion(estudianteId, filtros) {
    const normalizados = construirFiltrosHistorial(filtros);
    if (normalizados.asignacionCursoId) {
      const asignacion = await obtenerAsignacion(normalizados.asignacionCursoId);
      await verificarEstudianteEnAsignacion(estudianteId, asignacion);
    }
    return consultarEvolucion(estudianteId, filtros);
  },

  async obtenerEvolucionDocente(docenteId, asignacionCursoId, estudianteId, filtros) {
    const asignacionId = enteroPositivo(
      asignacionCursoId,
      "asignacionCursoId",
      { opcional: false },
    );
    const estudianteIdNum = enteroPositivo(estudianteId, "estudianteId", {
      opcional: false,
    });
    const asignacion = await obtenerAsignacion(asignacionId);
    if (asignacion.docenteId !== docenteId) {
      throw ApiError.forbidden("No tienes acceso a esta asignación académica");
    }
    await verificarEstudianteEnAsignacion(estudianteIdNum, asignacion);
    return consultarEvolucion(estudianteIdNum, {
      ...filtros,
      asignacionCursoId: asignacionId,
    });
  },

  async obtenerEvolucionAdmin(estudianteId, filtros) {
    return consultarEvolucion(estudianteId, filtros);
  },

  async obtenerResumenAdmin() {
    const [estudiantes, evaluaciones, historial, niveles, ultimos] = await Promise.all([
      prisma.usuario.count({ where: { rol: "ESTUDIANTE", estado: "ACTIVO" } }),
      prisma.intentoEvaluacion.count({ where: { estado: "FINALIZADO" } }),
      prisma.historialProgreso.count(),
      prisma.progresoEstudiante.groupBy({ by: ["nivelActual"], _count: { _all: true } }),
      prisma.historialProgreso.findMany({
        orderBy: [{ fecha: "desc" }, { id: "desc" }],
        take: 8,
        select: {
          id: true, tema: true, porcentaje: true, nota: true,
          nivelAntes: true, nivelDespues: true, fecha: true,
          estudiante: { select: { id: true, nombres: true } },
        },
      }),
    ]);
    return {
      soloLectura: true,
      estudiantesActivos: estudiantes,
      evaluacionesFinalizadas: evaluaciones,
      registrosHistoricos: historial,
      distribucionNiveles: Object.fromEntries(
        niveles.map((item) => [item.nivelActual, item._count._all]),
      ),
      ultimosCambios: ultimos,
    };
  },
};

module.exports = progresoService;
