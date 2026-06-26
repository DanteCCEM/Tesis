const prisma = require("../config/prisma");
const ApiError = require("../utils/ApiError");
const {
  determinarNivel,
  construirRecomendacion,
} = require("./adaptiveLearningService");

// Un tema se considera dominado a partir de este porcentaje de dominio.
const UMBRAL_DOMINIO = 80;

const NIVEL_LABEL = {
  BASICO: "Básico",
  INTERMEDIO: "Intermedio",
  AVANZADO: "Avanzado",
};

const redondear = (valor) => Math.round(valor * 100) / 100;

// Convierte un porcentaje (0-100) a una nota en escala 0-20 (1 decimal).
const aNota20 = (porcentaje) => Math.round((porcentaje / 5) * 10) / 10;

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

  if (dominio != null && dominio >= UMBRAL_DOMINIO) {
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

  const dominioPorTexto = new Map(
    progresos.map((progreso) => [
      normalizarTema(progreso.tema),
      redondear(progreso.porcentajeDominio),
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

    const porcentajeDominio =
      dominioPorTexto.get(normalizarTema(entrada.tema)) ?? promedioEvaluaciones;

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
  const matricula = await prisma.matricula.findUnique({
    where: {
      estudianteId_cursoId: {
        estudianteId,
        cursoId,
      },
    },
  });

  if (!matricula) {
    throw ApiError.forbidden("No estás matriculado en este curso");
  }
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
          select: { id: true, titulo: true, tema: true, cursoId: true },
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

    const evaluacionesRealizadas = intentos.length;
    const promedioPorcentaje =
      evaluacionesRealizadas > 0
        ? redondear(
            intentos.reduce((acc, it) => acc + it.porcentaje, 0) /
              evaluacionesRealizadas,
          )
        : 0;
    const promedioNota = aNota20(promedioPorcentaje);
    const nivel = determinarNivel(promedioPorcentaje);

    const temasDominados = progresos
      .filter((p) => p.porcentajeDominio >= UMBRAL_DOMINIO)
      .map((p) => ({
        tema: p.tema,
        porcentajeDominio: redondear(p.porcentajeDominio),
        nivelActual: p.nivelActual,
      }));

    const temasPorReforzar = progresos
      .filter((p) => p.porcentajeDominio < UMBRAL_DOMINIO)
      .sort((a, b) => a.porcentajeDominio - b.porcentajeDominio)
      .map((p) => ({
        tema: p.tema,
        porcentajeDominio: redondear(p.porcentajeDominio),
        nivelActual: p.nivelActual,
        recomendaciones: p.recomendaciones,
      }));

    const evolucion = intentos.map((it, index) => ({
      label: `Eval. ${index + 1}`,
      titulo: it.evaluacion.titulo,
      porcentaje: redondear(it.porcentaje),
      nota: aNota20(it.porcentaje),
      fecha: it.fechaFin,
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
          aprobado: nota >= 11,
        };
      });

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
      nivelActual: nivel,
      nivelLabel: NIVEL_LABEL[nivel],
      promedioPorcentaje,
      promedioNota,
      evaluacionesRealizadas,
      temasDominados,
      temasPorReforzar,
      recomendaciones,
      recomendacionDetalle,
      evolucion,
      historial,
    };

    if (cursoIdNum) {
      resultado.cursoId = cursoIdNum;
      resultado.porTema = construirPorTema(intentosPorTema, progresos);
    }

    return resultado;
  },
};

module.exports = progresoService;
