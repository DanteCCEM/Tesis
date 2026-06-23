const prisma = require("../config/prisma");
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

// Capa de acceso a datos / lógica de negocio para ProgresoEstudiante.
const progresoService = {
  // Progreso global del estudiante autenticado (todos sus cursos).
  async obtenerMiProgreso(estudianteId) {
    const progresos = await prisma.progresoEstudiante.findMany({
      where: { estudianteId },
      orderBy: { porcentajeDominio: "desc" },
    });

    const intentos = await prisma.intentoEvaluacion.findMany({
      where: {
        estudianteId,
        estado: "FINALIZADO",
        evaluacion: { esPracticaAdaptativa: false },
      },
      orderBy: { fechaFin: "asc" },
      include: { evaluacion: { select: { id: true, titulo: true, tema: true } } },
    });

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

    return {
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
  },
};

module.exports = progresoService;
