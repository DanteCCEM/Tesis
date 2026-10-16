const prisma = require("../config/prisma");
const ApiError = require("../utils/ApiError");
const progresoService = require("./progreso.service");

const sanitizarPerfil = (usuario) => {
  const {
    contrasena,
    sessionVersion,
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
    const [cursosCreados, evaluacionesPublicadas, asignaciones] = await Promise.all([
      prisma.asignacionCurso.count({ where: { docenteId, estado: "ACTIVO" } }),
      prisma.evaluacion.count({
        where: { docenteId, estado: "PUBLICADA" },
      }),
      prisma.asignacionCurso.findMany({
        where: { docenteId, estado: "ACTIVO" },
        select: { seccionId: true, anioAcademicoId: true },
      }),
    ]);

    const matriculas = asignaciones.length
      ? await prisma.matriculaAcademica.findMany({
          where: {
            estado: "ACTIVO",
            OR: asignaciones.map(({ seccionId, anioAcademicoId }) => ({
              seccionId,
              anioAcademicoId,
            })),
          },
          select: { estudianteId: true },
        })
      : [];
    const cantidadEstudiantes = new Set(matriculas.map((item) => item.estudianteId)).size;

    return {
      cursosCreados,
      cantidadEstudiantes,
      evaluacionesPublicadas,
    };
  },

  async obtenerEstadisticasEstudiante(estudianteId) {
    const [cursosMatriculados, progreso] = await Promise.all([
      prisma.matriculaAcademica.count({
        where: { estudianteId, estado: "ACTIVO" },
      }),
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
        : usuario.rol === "ESTUDIANTE"
          ? await perfilService.obtenerEstadisticasEstudiante(usuario.id)
          : {};

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
      const correo = String(datos.correo ?? "").trim().toLowerCase() || null;
      if (correo !== usuario.correo) {
        const existente = correo
          ? await prisma.usuario.findUnique({ where: { correo } })
          : null;
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

    if (solicitante.rol !== "DOCENTE") {
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

    const matriculas = await prisma.matriculaAcademica.findMany({
      where: { estudianteId: objetivoId, estado: "ACTIVO" },
      select: { seccionId: true, anioAcademicoId: true },
    });

    const asignacion = matriculas.length
      ? await prisma.asignacionCurso.findFirst({
          where: {
            docenteId: solicitante.id,
            estado: "ACTIVO",
            OR: matriculas.map(({ seccionId, anioAcademicoId }) => ({
              seccionId,
              anioAcademicoId,
            })),
          },
          select: { id: true },
        })
      : null;

    if (!asignacion) {
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
      username: usuario.username,
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
