const fs = require("fs/promises");
const path = require("path");
const prisma = require("../config/prisma");
const ApiError = require("../utils/ApiError");
const aiService = require("./aiService");
const pdfExtractService = require("./pdfExtract.service");
const { sanitizeOriginalName } = require("../config/upload");

const PERIODOS = ["SEMESTRE", "BIMESTRE", "TRIMESTRE"];
const ESTADOS_PLAN = ["BORRADOR", "PUBLICADO"];
const ESTADOS_TEMA = ["PENDIENTE", "EN_PROCESO", "COMPLETADO"];

const estructuraInclude = {
  unidades: {
    orderBy: { orden: "asc" },
    include: {
      temas: {
        orderBy: { orden: "asc" },
        include: {
          subtemas: { orderBy: { orden: "asc" } },
        },
      },
    },
  },
};

const obtenerCurso = async (cursoId) => {
  const curso = await prisma.curso.findUnique({ where: { id: cursoId } });
  if (!curso) {
    throw ApiError.notFound("Curso no encontrado");
  }
  return curso;
};

const verificarDocentePropietario = async (cursoId, docenteId) => {
  const curso = await obtenerCurso(cursoId);
  if (curso.docenteId !== docenteId) {
    throw ApiError.forbidden("No eres el propietario de este curso");
  }
  return curso;
};

const verificarEstudianteMatriculado = async (cursoId, estudianteId) => {
  const matricula = await prisma.matricula.findUnique({
    where: { estudianteId_cursoId: { estudianteId, cursoId } },
  });
  if (!matricula) {
    throw ApiError.forbidden("No estás matriculado en este curso");
  }
};

const obtenerPlan = async (planId) => {
  const plan = await prisma.planCurricular.findUnique({
    where: { id: planId },
    include: { curso: true },
  });
  if (!plan) {
    throw ApiError.notFound("Plan curricular no encontrado");
  }
  return plan;
};

const verificarPlanDocente = async (planId, docenteId) => {
  const plan = await obtenerPlan(planId);
  if (plan.curso.docenteId !== docenteId) {
    throw ApiError.forbidden("No eres el propietario de este plan curricular");
  }
  return plan;
};

const verificarAccesoLecturaPlan = async (planId, usuario) => {
  const plan = await prisma.planCurricular.findUnique({
    where: { id: planId },
    include: { curso: true, ...estructuraInclude },
  });

  if (!plan) {
    throw ApiError.notFound("Plan curricular no encontrado");
  }

  if (usuario.rol === "DOCENTE") {
    if (plan.curso.docenteId !== usuario.id) {
      throw ApiError.forbidden("No eres el propietario de este plan curricular");
    }
    return plan;
  }

  if (usuario.rol === "ESTUDIANTE") {
    await verificarEstudianteMatriculado(plan.cursoId, usuario.id);
    if (plan.estado !== "PUBLICADO") {
      throw ApiError.forbidden("Este plan curricular aún no está publicado");
    }
    return plan;
  }

  throw ApiError.forbidden("No tienes permisos para ver este plan curricular");
};

const siguienteOrden = async (modelo, where) => {
  const ultimo = await prisma[modelo].findFirst({
    where,
    orderBy: { orden: "desc" },
    select: { orden: true },
  });
  return (ultimo?.orden ?? 0) + 1;
};

const eliminarArchivoSeguro = async (rutaArchivo) => {
  if (!rutaArchivo) return;
  try {
    await fs.unlink(rutaArchivo);
  } catch {
    // Ignora si el archivo ya no existe.
  }
};

const sincronizarEstructura = async (planId, unidades = []) => {
  if (!Array.isArray(unidades)) {
    throw ApiError.badRequest("unidades debe ser un arreglo");
  }

  await prisma.$transaction(async (tx) => {
    await tx.unidadCurricular.deleteMany({ where: { planCurricularId: planId } });

    for (const [uIndex, unidad] of unidades.entries()) {
      if (!unidad?.titulo || !String(unidad.titulo).trim()) {
        throw ApiError.badRequest(`La unidad en posición ${uIndex + 1} requiere título`);
      }

      const unidadCreada = await tx.unidadCurricular.create({
        data: {
          planCurricularId: planId,
          titulo: String(unidad.titulo).trim(),
          descripcion: unidad.descripcion ? String(unidad.descripcion).trim() : null,
          orden: Number.isInteger(unidad.orden) ? unidad.orden : uIndex + 1,
        },
      });

      const temas = Array.isArray(unidad.temas) ? unidad.temas : [];
      for (const [tIndex, tema] of temas.entries()) {
        if (!tema?.titulo || !String(tema.titulo).trim()) {
          throw ApiError.badRequest(
            `El tema en posición ${tIndex + 1} de la unidad "${unidad.titulo}" requiere título`,
          );
        }

        const estadoTema = tema.estado ?? "PENDIENTE";
        if (!ESTADOS_TEMA.includes(estadoTema)) {
          throw ApiError.badRequest(`Estado de tema inválido: ${estadoTema}`);
        }

        const temaCreado = await tx.temaCurricular.create({
          data: {
            unidadCurricularId: unidadCreada.id,
            titulo: String(tema.titulo).trim(),
            descripcion: tema.descripcion ? String(tema.descripcion).trim() : null,
            orden: Number.isInteger(tema.orden) ? tema.orden : tIndex + 1,
            estado: estadoTema,
          },
        });

        const subtemas = Array.isArray(tema.subtemas) ? tema.subtemas : [];
        for (const [sIndex, subtema] of subtemas.entries()) {
          if (!subtema?.titulo || !String(subtema.titulo).trim()) {
            throw ApiError.badRequest(
              `El subtema en posición ${sIndex + 1} del tema "${tema.titulo}" requiere título`,
            );
          }

          await tx.subtemaCurricular.create({
            data: {
              temaCurricularId: temaCreado.id,
              titulo: String(subtema.titulo).trim(),
              descripcion: subtema.descripcion
                ? String(subtema.descripcion).trim()
                : null,
              orden: Number.isInteger(subtema.orden) ? subtema.orden : sIndex + 1,
            },
          });
        }
      }
    }
  });
};

const mapearEstructuraParaPersistencia = (estructuraIA) =>
  estructuraIA.unidades.map((unidad, uIndex) => ({
    titulo: unidad.titulo,
    descripcion: unidad.descripcion,
    orden: uIndex + 1,
    temas: (unidad.temas ?? []).map((tema, tIndex) => ({
      titulo: tema.titulo,
      descripcion: tema.descripcion,
      orden: tIndex + 1,
      estado: "PENDIENTE",
      subtemas: (tema.subtemas ?? []).map((subtema, sIndex) => ({
        titulo: subtema.titulo,
        descripcion: subtema.descripcion,
        orden: sIndex + 1,
      })),
    })),
  }));

const planCurricularService = {
  PERIODOS,
  ESTADOS_PLAN,
  ESTADOS_TEMA,

  async crearPlan(cursoId, docenteId, { periodo }, archivo) {
    await verificarDocentePropietario(cursoId, docenteId);

    if (!archivo) {
      throw ApiError.badRequest('Debes adjuntar un archivo PDF en el campo "archivo"');
    }

    if (!PERIODOS.includes(periodo)) {
      await eliminarArchivoSeguro(archivo.path);
      throw ApiError.badRequest(
        `periodo debe ser uno de: ${PERIODOS.join(", ")}`,
      );
    }

    const nombreArchivo = sanitizeOriginalName(archivo.originalname);
    const rutaArchivo = path.resolve(archivo.path);

    return prisma.planCurricular.create({
      data: {
        cursoId,
        nombreArchivo,
        rutaArchivo,
        periodo,
        estado: "BORRADOR",
      },
      include: estructuraInclude,
    });
  },

  async listarPorCurso(cursoId, usuario) {
    await obtenerCurso(cursoId);

    if (usuario.rol === "DOCENTE") {
      await verificarDocentePropietario(cursoId, usuario.id);
      return prisma.planCurricular.findMany({
        where: { cursoId },
        orderBy: { createdAt: "desc" },
        include: estructuraInclude,
      });
    }

    if (usuario.rol === "ESTUDIANTE") {
      await verificarEstudianteMatriculado(cursoId, usuario.id);
      return prisma.planCurricular.findMany({
        where: { cursoId, estado: "PUBLICADO" },
        orderBy: { createdAt: "desc" },
        include: estructuraInclude,
      });
    }

    throw ApiError.forbidden("No tienes permisos para ver planes curriculares");
  },

  async obtenerPlanDetalle(planId, usuario) {
    return verificarAccesoLecturaPlan(planId, usuario);
  },

  async actualizarPlan(planId, docenteId, datos) {
    await verificarPlanDocente(planId, docenteId);

    const data = {};

    if (datos.periodo !== undefined) {
      if (!PERIODOS.includes(datos.periodo)) {
        throw ApiError.badRequest(
          `periodo debe ser uno de: ${PERIODOS.join(", ")}`,
        );
      }
      data.periodo = datos.periodo;
    }

    if (datos.estado !== undefined) {
      if (!ESTADOS_PLAN.includes(datos.estado)) {
        throw ApiError.badRequest(
          `estado debe ser uno de: ${ESTADOS_PLAN.join(", ")}`,
        );
      }
      data.estado = datos.estado;
    }

    if (Object.keys(data).length > 0) {
      await prisma.planCurricular.update({ where: { id: planId }, data });
    }

    if (datos.unidades !== undefined) {
      await sincronizarEstructura(planId, datos.unidades);
    }

    return prisma.planCurricular.findUnique({
      where: { id: planId },
      include: estructuraInclude,
    });
  },

  async publicarPlan(planId, docenteId) {
    await verificarPlanDocente(planId, docenteId);

    return prisma.planCurricular.update({
      where: { id: planId },
      data: { estado: "PUBLICADO" },
      include: estructuraInclude,
    });
  },

  async crearUnidad(planId, docenteId, datos) {
    await verificarPlanDocente(planId, docenteId);

    const orden =
      datos.orden !== undefined
        ? Number(datos.orden)
        : await siguienteOrden("unidadCurricular", { planCurricularId: planId });

    return prisma.unidadCurricular.create({
      data: {
        planCurricularId: planId,
        titulo: String(datos.titulo).trim(),
        descripcion: datos.descripcion ? String(datos.descripcion).trim() : null,
        orden,
      },
    });
  },

  async actualizarUnidad(unidadId, docenteId, datos) {
    const unidad = await prisma.unidadCurricular.findUnique({
      where: { id: unidadId },
      include: { planCurricular: { include: { curso: true } } },
    });

    if (!unidad) {
      throw ApiError.notFound("Unidad curricular no encontrada");
    }
    if (unidad.planCurricular.curso.docenteId !== docenteId) {
      throw ApiError.forbidden("No eres el propietario de esta unidad curricular");
    }

    const data = {};
    if (datos.titulo !== undefined) data.titulo = String(datos.titulo).trim();
    if (datos.descripcion !== undefined) {
      data.descripcion = datos.descripcion ? String(datos.descripcion).trim() : null;
    }
    if (datos.orden !== undefined) data.orden = Number(datos.orden);

    return prisma.unidadCurricular.update({ where: { id: unidadId }, data });
  },

  async eliminarUnidad(unidadId, docenteId) {
    const unidad = await prisma.unidadCurricular.findUnique({
      where: { id: unidadId },
      include: { planCurricular: { include: { curso: true } } },
    });

    if (!unidad) {
      throw ApiError.notFound("Unidad curricular no encontrada");
    }
    if (unidad.planCurricular.curso.docenteId !== docenteId) {
      throw ApiError.forbidden("No eres el propietario de esta unidad curricular");
    }

    await prisma.unidadCurricular.delete({ where: { id: unidadId } });
    return { ok: true, mensaje: "Unidad curricular eliminada" };
  },

  async crearTema(unidadId, docenteId, datos) {
    const unidad = await prisma.unidadCurricular.findUnique({
      where: { id: unidadId },
      include: { planCurricular: { include: { curso: true } } },
    });

    if (!unidad) {
      throw ApiError.notFound("Unidad curricular no encontrada");
    }
    if (unidad.planCurricular.curso.docenteId !== docenteId) {
      throw ApiError.forbidden("No eres el propietario de esta unidad curricular");
    }

    const estado = datos.estado ?? "PENDIENTE";
    if (!ESTADOS_TEMA.includes(estado)) {
      throw ApiError.badRequest(`estado debe ser uno de: ${ESTADOS_TEMA.join(", ")}`);
    }

    const orden =
      datos.orden !== undefined
        ? Number(datos.orden)
        : await siguienteOrden("temaCurricular", { unidadCurricularId: unidadId });

    return prisma.temaCurricular.create({
      data: {
        unidadCurricularId: unidadId,
        titulo: String(datos.titulo).trim(),
        descripcion: datos.descripcion ? String(datos.descripcion).trim() : null,
        orden,
        estado,
      },
    });
  },

  async actualizarTema(temaId, docenteId, datos) {
    const tema = await prisma.temaCurricular.findUnique({
      where: { id: temaId },
      include: {
        unidadCurricular: {
          include: { planCurricular: { include: { curso: true } } },
        },
      },
    });

    if (!tema) {
      throw ApiError.notFound("Tema curricular no encontrado");
    }
    if (tema.unidadCurricular.planCurricular.curso.docenteId !== docenteId) {
      throw ApiError.forbidden("No eres el propietario de este tema curricular");
    }

    const data = {};
    if (datos.titulo !== undefined) data.titulo = String(datos.titulo).trim();
    if (datos.descripcion !== undefined) {
      data.descripcion = datos.descripcion ? String(datos.descripcion).trim() : null;
    }
    if (datos.orden !== undefined) data.orden = Number(datos.orden);
    if (datos.estado !== undefined) {
      if (!ESTADOS_TEMA.includes(datos.estado)) {
        throw ApiError.badRequest(`estado debe ser uno de: ${ESTADOS_TEMA.join(", ")}`);
      }
      data.estado = datos.estado;
    }

    return prisma.temaCurricular.update({ where: { id: temaId }, data });
  },

  async eliminarTema(temaId, docenteId) {
    const tema = await prisma.temaCurricular.findUnique({
      where: { id: temaId },
      include: {
        unidadCurricular: {
          include: { planCurricular: { include: { curso: true } } },
        },
      },
    });

    if (!tema) {
      throw ApiError.notFound("Tema curricular no encontrado");
    }
    if (tema.unidadCurricular.planCurricular.curso.docenteId !== docenteId) {
      throw ApiError.forbidden("No eres el propietario de este tema curricular");
    }

    await prisma.temaCurricular.delete({ where: { id: temaId } });
    return { ok: true, mensaje: "Tema curricular eliminado" };
  },

  async crearSubtema(temaId, docenteId, datos) {
    const tema = await prisma.temaCurricular.findUnique({
      where: { id: temaId },
      include: {
        unidadCurricular: {
          include: { planCurricular: { include: { curso: true } } },
        },
      },
    });

    if (!tema) {
      throw ApiError.notFound("Tema curricular no encontrado");
    }
    if (tema.unidadCurricular.planCurricular.curso.docenteId !== docenteId) {
      throw ApiError.forbidden("No eres el propietario de este tema curricular");
    }

    const orden =
      datos.orden !== undefined
        ? Number(datos.orden)
        : await siguienteOrden("subtemaCurricular", { temaCurricularId: temaId });

    return prisma.subtemaCurricular.create({
      data: {
        temaCurricularId: temaId,
        titulo: String(datos.titulo).trim(),
        descripcion: datos.descripcion ? String(datos.descripcion).trim() : null,
        orden,
      },
    });
  },

  async actualizarSubtema(subtemaId, docenteId, datos) {
    const subtema = await prisma.subtemaCurricular.findUnique({
      where: { id: subtemaId },
      include: {
        temaCurricular: {
          include: {
            unidadCurricular: {
              include: { planCurricular: { include: { curso: true } } },
            },
          },
        },
      },
    });

    if (!subtema) {
      throw ApiError.notFound("Subtema curricular no encontrado");
    }
    if (
      subtema.temaCurricular.unidadCurricular.planCurricular.curso.docenteId !==
      docenteId
    ) {
      throw ApiError.forbidden("No eres el propietario de este subtema curricular");
    }

    const data = {};
    if (datos.titulo !== undefined) data.titulo = String(datos.titulo).trim();
    if (datos.descripcion !== undefined) {
      data.descripcion = datos.descripcion ? String(datos.descripcion).trim() : null;
    }
    if (datos.orden !== undefined) data.orden = Number(datos.orden);

    return prisma.subtemaCurricular.update({ where: { id: subtemaId }, data });
  },

  async eliminarSubtema(subtemaId, docenteId) {
    const subtema = await prisma.subtemaCurricular.findUnique({
      where: { id: subtemaId },
      include: {
        temaCurricular: {
          include: {
            unidadCurricular: {
              include: { planCurricular: { include: { curso: true } } },
            },
          },
        },
      },
    });

    if (!subtema) {
      throw ApiError.notFound("Subtema curricular no encontrado");
    }
    if (
      subtema.temaCurricular.unidadCurricular.planCurricular.curso.docenteId !==
      docenteId
    ) {
      throw ApiError.forbidden("No eres el propietario de este subtema curricular");
    }

    await prisma.subtemaCurricular.delete({ where: { id: subtemaId } });
    return { ok: true, mensaje: "Subtema curricular eliminado" };
  },

  async validarReferenciasEvaluacion(cursoId, temaCurricularId, subtemaCurricularId) {
    if (temaCurricularId == null && subtemaCurricularId == null) {
      return { temaCurricularId: null, subtemaCurricularId: null };
    }

    let temaId = temaCurricularId != null ? Number(temaCurricularId) : null;
    let subtemaId =
      subtemaCurricularId != null ? Number(subtemaCurricularId) : null;

    if (subtemaId) {
      const subtema = await prisma.subtemaCurricular.findUnique({
        where: { id: subtemaId },
        include: {
          temaCurricular: {
            include: {
              unidadCurricular: { include: { planCurricular: true } },
            },
          },
        },
      });

      if (!subtema) {
        throw ApiError.badRequest("subtemaCurricularId no válido");
      }
      if (subtema.temaCurricular.unidadCurricular.planCurricular.cursoId !== cursoId) {
        throw ApiError.badRequest(
          "El subtema curricular no pertenece al curso de la evaluación",
        );
      }

      if (temaId && temaId !== subtema.temaCurricularId) {
        throw ApiError.badRequest(
          "temaCurricularId no coincide con el subtema indicado",
        );
      }

      temaId = subtema.temaCurricularId;
    }

    if (temaId) {
      const tema = await prisma.temaCurricular.findUnique({
        where: { id: temaId },
        include: {
          unidadCurricular: { include: { planCurricular: true } },
        },
      });

      if (!tema) {
        throw ApiError.badRequest("temaCurricularId no válido");
      }
      if (tema.unidadCurricular.planCurricular.cursoId !== cursoId) {
        throw ApiError.badRequest(
          "El tema curricular no pertenece al curso de la evaluación",
        );
      }
    }

    return { temaCurricularId: temaId, subtemaCurricularId: subtemaId };
  },

  async procesarPdf(planId, docenteId, { confirmarReemplazo = false } = {}) {
    const plan = await verificarPlanDocente(planId, docenteId);

    const unidadesExistentes = await prisma.unidadCurricular.count({
      where: { planCurricularId: planId },
    });

    if (unidadesExistentes > 0 && !confirmarReemplazo) {
      throw ApiError.conflict(
        "Este plan ya tiene una estructura curricular. Envía confirmarReemplazo: true para reemplazarla con el resultado del PDF",
      );
    }

    const extraccion = await pdfExtractService.extraerTextoDesdeArchivo(plan.rutaArchivo);

    console.info(
      "[PlanCurricular]",
      JSON.stringify({
        timestamp: new Date().toISOString(),
        accion: "procesar-pdf",
        planId,
        docenteId,
        nombreArchivo: plan.nombreArchivo,
        caracteresExtraidos: extraccion.caracteresOriginales ?? extraccion.texto.length,
        textoTruncado: extraccion.truncado,
      }),
    );

    const estructuraIA = await aiService.extraerEstructuraCurricularDeTexto({
      textoPdf: extraccion.texto,
      periodoActual: plan.periodo,
      nombreArchivo: plan.nombreArchivo,
      textoTruncado: extraccion.truncado,
    });

    const periodoActualizado = PERIODOS.includes(estructuraIA.periodoSugerido)
      ? estructuraIA.periodoSugerido
      : plan.periodo;

    await prisma.planCurricular.update({
      where: { id: planId },
      data: {
        estado: "BORRADOR",
        periodo: periodoActualizado,
      },
    });

    const unidades = mapearEstructuraParaPersistencia(estructuraIA);
    await sincronizarEstructura(planId, unidades);

    const planActualizado = await prisma.planCurricular.findUnique({
      where: { id: planId },
      include: estructuraInclude,
    });

    return {
      plan: planActualizado,
      meta: {
        generadoPorIA: true,
        borrador: true,
        publicado: false,
        reemplazoConfirmado: unidadesExistentes > 0,
        periodoSugerido: estructuraIA.periodoSugerido,
        periodoAplicado: periodoActualizado,
        unidadesGeneradas: unidades.length,
        textoExtraidoCaracteres:
          extraccion.caracteresOriginales ?? extraccion.texto.length,
        textoTruncado: extraccion.truncado,
        mensaje:
          "Estructura generada en borrador. Revísala y edítala antes de publicar el plan.",
      },
    };
  },
};

module.exports = planCurricularService;
