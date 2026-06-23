const prisma = require("../config/prisma");
const ApiError = require("../utils/ApiError");
const progresoService = require("./progreso.service");

const sanitizarPerfil = (usuario) => {
  const {
    contrasena,
    cursos,
    evaluaciones,
    matriculas,
    intentos,
    progresos,
    ...perfil
  } = usuario;
  return perfil;
};

const perfilService = {
  async obtenerEstadisticasDocente(docenteId) {
    const [cursosCreados, evaluacionesPublicadas, matriculas] = await Promise.all([
      prisma.curso.count({ where: { docenteId } }),
      prisma.evaluacion.count({
        where: { docenteId, estado: "PUBLICADA" },
      }),
      prisma.matricula.findMany({
        where: { curso: { docenteId } },
        select: { estudianteId: true },
      }),
    ]);

    const cantidadEstudiantes = new Set(matriculas.map((m) => m.estudianteId)).size;

    return {
      cursosCreados,
      cantidadEstudiantes,
      evaluacionesPublicadas,
    };
  },

  async obtenerEstadisticasEstudiante(estudianteId) {
    const [cursosMatriculados, progreso] = await Promise.all([
      prisma.matricula.count({ where: { estudianteId } }),
      progresoService.obtenerMiProgreso(estudianteId),
    ]);

    return {
      cursosMatriculados,
      promedioGeneral: progreso.promedioNota,
      nivelActual: progreso.nivelLabel,
      temasPorReforzar: progreso.temasPorReforzar.map((t) => ({
        tema: t.tema,
        porcentajeDominio: t.porcentajeDominio,
      })),
      evaluacionesRealizadas: progreso.evaluacionesRealizadas,
    };
  },

  async construirPerfilCompleto(usuario) {
    const base = sanitizarPerfil(usuario);
    const estadisticas =
      usuario.rol === "DOCENTE"
        ? await perfilService.obtenerEstadisticasDocente(usuario.id)
        : await perfilService.obtenerEstadisticasEstudiante(usuario.id);

    return {
      ...base,
      nivelLabel: usuario.rol === "ESTUDIANTE" ? estadisticas.nivelActual : undefined,
      estadisticas,
    };
  },

  async obtenerMiPerfil(usuarioId) {
    const usuario = await prisma.usuario.findUnique({ where: { id: usuarioId } });
    if (!usuario) {
      throw ApiError.notFound("Usuario no encontrado");
    }
    return perfilService.construirPerfilCompleto(usuario);
  },

  async actualizarMiPerfil(usuarioId, datos) {
    const usuario = await prisma.usuario.findUnique({ where: { id: usuarioId } });
    if (!usuario) {
      throw ApiError.notFound("Usuario no encontrado");
    }

    const data = {};

    if (datos.nombres !== undefined) {
      data.nombres = String(datos.nombres).trim();
    }
    if (datos.correo !== undefined) {
      const correo = String(datos.correo).trim().toLowerCase();
      if (correo !== usuario.correo) {
        const existente = await prisma.usuario.findUnique({ where: { correo } });
        if (existente && existente.id !== usuarioId) {
          throw ApiError.conflict("El correo ya está registrado");
        }
        data.correo = correo;
      }
    }
    if (datos.fotoPerfil !== undefined) {
      data.fotoPerfil = datos.fotoPerfil ? String(datos.fotoPerfil).trim() : null;
    }
    if (datos.telefono !== undefined) {
      data.telefono = datos.telefono ? String(datos.telefono).trim() : null;
    }
    if (datos.institucionEducativa !== undefined) {
      data.institucionEducativa = datos.institucionEducativa
        ? String(datos.institucionEducativa).trim()
        : null;
    }
    if (datos.biografiaCorta !== undefined) {
      data.biografiaCorta = datos.biografiaCorta
        ? String(datos.biografiaCorta).trim()
        : null;
    }

    if (Object.keys(data).length === 0) {
      throw ApiError.badRequest("No se enviaron campos para actualizar");
    }

    const actualizado = await prisma.usuario.update({
      where: { id: usuarioId },
      data,
    });

    return perfilService.construirPerfilCompleto(actualizado);
  },

  async verificarAccesoPerfil(solicitante, objetivoId) {
    if (solicitante.id === objetivoId) {
      return { esPropio: true, vistaLimitada: false };
    }

    if (solicitante.rol === "ESTUDIANTE") {
      throw ApiError.forbidden("No puedes consultar el perfil de otros usuarios");
    }

    const objetivo = await prisma.usuario.findUnique({ where: { id: objetivoId } });
    if (!objetivo) {
      throw ApiError.notFound("Usuario no encontrado");
    }

    if (objetivo.rol !== "ESTUDIANTE") {
      throw ApiError.forbidden(
        "Solo puedes consultar perfiles de estudiantes matriculados en tus cursos",
      );
    }

    const matriculado = await prisma.matricula.findFirst({
      where: {
        estudianteId: objetivoId,
        curso: { docenteId: solicitante.id },
      },
    });

    if (!matriculado) {
      throw ApiError.forbidden(
        "Este estudiante no está matriculado en ninguno de tus cursos",
      );
    }

    return { esPropio: false, vistaLimitada: true, objetivo };
  },

  async obtenerPerfilUsuario(solicitante, objetivoId) {
    const acceso = await perfilService.verificarAccesoPerfil(solicitante, objetivoId);

    if (acceso.esPropio) {
      const perfil = await perfilService.obtenerMiPerfil(solicitante.id);
      return { perfil, esPropio: true };
    }

    const usuario = acceso.objetivo;
    const estadisticas = await perfilService.obtenerEstadisticasEstudiante(usuario.id);

    // Vista docente: datos académicos y contacto básico, sin correo ni biografía completa si sensibles.
    const perfil = {
      id: usuario.id,
      nombres: usuario.nombres,
      rol: usuario.rol,
      fotoPerfil: usuario.fotoPerfil,
      telefono: usuario.telefono,
      institucionEducativa: usuario.institucionEducativa,
      createdAt: usuario.createdAt,
      nivelLabel: estadisticas.nivelActual,
      estadisticas,
    };

    return { perfil, esPropio: false };
  },
};

module.exports = perfilService;
