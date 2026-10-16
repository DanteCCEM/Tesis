const prisma = require("../config/prisma");
const ApiError = require("../utils/ApiError");

const id = (valor, campo) => {
  const numero = Number(valor);
  if (!Number.isInteger(numero) || numero <= 0) throw ApiError.badRequest(`${campo} no es válido`);
  return numero;
};

const include = {
  areaCurricular: true,
  anioAcademico: true,
  seccion: { include: { grado: true } },
  docente: { select: { id: true, username: true, nombres: true, estado: true } },
  cursoLegacy: { select: { id: true, nombre: true } },
};

const verificarRelaciones = async (tx, datos) => {
  const [area, seccion, docente, anio] = await Promise.all([
    tx.areaCurricular.findUnique({ where: { id: id(datos.areaCurricularId, "areaCurricularId") } }),
    tx.seccion.findUnique({ where: { id: id(datos.seccionId, "seccionId") }, include: { grado: true } }),
    tx.usuario.findUnique({ where: { id: id(datos.docenteId, "docenteId") } }),
    tx.anioAcademico.findUnique({ where: { id: id(datos.anioAcademicoId, "anioAcademicoId") } }),
  ]);
  if (!area || area.estado !== "ACTIVO") throw ApiError.badRequest("El área curricular no está activa");
  if (!seccion || seccion.estado !== "ACTIVO") throw ApiError.badRequest("La sección no está activa");
  if (!docente || docente.rol !== "DOCENTE" || docente.estado !== "ACTIVO") throw ApiError.badRequest("El docente no está activo");
  if (!anio) throw ApiError.badRequest("El año académico no existe");
  return { area, seccion, docente, anio };
};

const asignacionesService = {
  listar() {
    return prisma.asignacionCurso.findMany({
      include,
      orderBy: [{ anioAcademico: { anio: "desc" } }, { areaCurricular: { nombre: "asc" } }],
    });
  },

  async crear(datos, actorId) {
    try {
      return await prisma.$transaction(async (tx) => {
        const refs = await verificarRelaciones(tx, datos);
        const asignacion = await tx.asignacionCurso.create({
          data: {
            areaCurricularId: refs.area.id,
            seccionId: refs.seccion.id,
            docenteId: refs.docente.id,
            anioAcademicoId: refs.anio.id,
            estado: datos.estado || "ACTIVO",
          },
        });
        await tx.curso.create({
          data: {
            nombre: refs.area.nombre,
            grado: refs.seccion.grado.nombre,
            seccion: refs.seccion.nombre,
            descripcion: refs.area.descripcion,
            docenteId: refs.docente.id,
            asignacionCursoId: asignacion.id,
          },
        });
        await tx.auditoria.create({
          data: {
            usuarioActorId: actorId,
            usuarioObjetivoId: refs.docente.id,
            accion: "COURSE_ASSIGNMENT_CHANGED",
            datos: { asignacionCursoId: asignacion.id, operacion: "CREATED" },
          },
        });
        return tx.asignacionCurso.findUnique({ where: { id: asignacion.id }, include });
      });
    } catch (error) {
      if (error?.code === "P2002") throw ApiError.conflict("Ya existe una asignación para esa área, sección y año");
      throw error;
    }
  },

  async actualizar(asignacionId, datos, actorId) {
    const asignacionIdNum = id(asignacionId, "id");
    try {
      return await prisma.$transaction(async (tx) => {
        const actual = await tx.asignacionCurso.findUnique({ where: { id: asignacionIdNum } });
        if (!actual) throw ApiError.notFound("Asignación no encontrada");
        const combinados = { ...actual, ...datos };
        const refs = await verificarRelaciones(tx, combinados);
        const actualizada = await tx.asignacionCurso.update({
          where: { id: asignacionIdNum },
          data: {
            areaCurricularId: refs.area.id,
            seccionId: refs.seccion.id,
            docenteId: refs.docente.id,
            anioAcademicoId: refs.anio.id,
            ...(datos.estado !== undefined ? { estado: datos.estado } : {}),
          },
        });
        await tx.curso.upsert({
          where: { asignacionCursoId: asignacionIdNum },
          create: {
            nombre: refs.area.nombre, grado: refs.seccion.grado.nombre,
            seccion: refs.seccion.nombre, descripcion: refs.area.descripcion,
            docenteId: refs.docente.id, asignacionCursoId: asignacionIdNum,
          },
          update: {
            nombre: refs.area.nombre, grado: refs.seccion.grado.nombre,
            seccion: refs.seccion.nombre, descripcion: refs.area.descripcion,
            docenteId: refs.docente.id,
          },
        });
        await tx.auditoria.create({
          data: {
            usuarioActorId: actorId,
            usuarioObjetivoId: refs.docente.id,
            accion: "COURSE_ASSIGNMENT_CHANGED",
            datos: { asignacionCursoId: asignacionIdNum, operacion: "UPDATED" },
          },
        });
        return tx.asignacionCurso.findUnique({ where: { id: actualizada.id }, include });
      });
    } catch (error) {
      if (error?.code === "P2002") throw ApiError.conflict("Ya existe una asignación para esa área, sección y año");
      throw error;
    }
  },
};

module.exports = asignacionesService;
