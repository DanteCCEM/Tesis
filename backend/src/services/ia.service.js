const prisma = require("../config/prisma");
const ApiError = require("../utils/ApiError");
const aiService = require("./aiService");

const registrarSolicitudIA = (usuario, accion, detalle = {}) => {
  console.info(
    "[IA]",
    JSON.stringify({
      timestamp: new Date().toISOString(),
      accion,
      usuarioId: usuario.id,
      correo: usuario.correo,
      rol: usuario.rol,
      ...detalle,
    }),
  );
};

const verificarAccesoRetroalimentacion = async (intentoId, usuario) => {
  const intento = await prisma.intentoEvaluacion.findUnique({
    where: { id: intentoId },
    include: {
      evaluacion: {
        select: {
          id: true,
          titulo: true,
          tema: true,
          subtema: true,
          curso: {
            select: { id: true, docenteId: true },
          },
        },
      },
    },
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
      throw ApiError.forbidden("No eres el propietario del curso de este intento");
    }
  } else {
    throw ApiError.forbidden("No tienes permisos para solicitar retroalimentación");
  }

  if (intento.estado !== "FINALIZADO") {
    throw ApiError.badRequest("El intento debe estar finalizado para generar retroalimentación");
  }

  return intento;
};

const normalizarRetroalimentacionGuardada = (payload) => {
  if (!payload || typeof payload !== "object") {
    return null;
  }

  const {
    fortalezas,
    temasPorReforzar,
    explicacionErroresFrecuentes,
    recomendacionEstudio,
    siguienteNivelSugerido,
    generadoEn,
  } = payload;

  if (
    !Array.isArray(fortalezas) ||
    !Array.isArray(temasPorReforzar) ||
    !explicacionErroresFrecuentes ||
    !recomendacionEstudio ||
    !siguienteNivelSugerido
  ) {
    return null;
  }

  return {
    fortalezas,
    temasPorReforzar,
    explicacionErroresFrecuentes,
    recomendacionEstudio,
    siguienteNivelSugerido,
    generadoEn: generadoEn ?? null,
    generadoPorIA: true,
  };
};

const iaServiceLayer = {
  async generarPreguntas(datos, usuario) {
    registrarSolicitudIA(usuario, "generar-preguntas", {
      tema: datos.tema,
      subtema: datos.subtema,
      cantidadPreguntas: datos.cantidadPreguntas,
    });

    const borrador = await aiService.generarPreguntasBorrador(datos);

    return {
      ok: true,
      borrador: true,
      solicitadoPor: {
        id: usuario.id,
        correo: usuario.correo,
      },
      ...borrador,
    };
  },

  async generarRetroalimentacion(datos, usuario) {
    const intento = await verificarAccesoRetroalimentacion(datos.intentoId, usuario);

    const guardada = normalizarRetroalimentacionGuardada(intento.retroalimentacionIA);
    if (guardada) {
      return {
        ok: true,
        intentoId: datos.intentoId,
        cached: true,
        retroalimentacion: guardada,
      };
    }

    registrarSolicitudIA(usuario, "generar-retroalimentacion", {
      intentoId: datos.intentoId,
      porcentajeObtenido: datos.porcentajeObtenido,
    });

    const retroalimentacion = await aiService.generarRetroalimentacionPedagogica({
      resultadoEvaluacion: datos.resultadoEvaluacion,
      preguntasFalladas: datos.preguntasFalladas,
      temas: datos.temas,
      subtemas: datos.subtemas,
      porcentajeObtenido: datos.porcentajeObtenido,
      nivelAdaptativo: datos.nivelAdaptativo,
    });

    const payloadGuardado = {
      fortalezas: retroalimentacion.fortalezas,
      temasPorReforzar: retroalimentacion.temasPorReforzar,
      explicacionErroresFrecuentes: retroalimentacion.explicacionErroresFrecuentes,
      recomendacionEstudio: retroalimentacion.recomendacionEstudio,
      siguienteNivelSugerido: retroalimentacion.siguienteNivelSugerido,
      generadoEn: new Date().toISOString(),
      generadoPorIA: true,
    };

    await prisma.intentoEvaluacion.update({
      where: { id: datos.intentoId },
      data: { retroalimentacionIA: payloadGuardado },
    });

    return {
      ok: true,
      intentoId: datos.intentoId,
      cached: false,
      solicitadoPor: {
        id: usuario.id,
        correo: usuario.correo,
      },
      retroalimentacion: payloadGuardado,
    };
  },
};

module.exports = iaServiceLayer;
