const prisma = require("../config/prisma");
const ApiError = require("../utils/ApiError");

const obtenerContextoCurso = async (cursoId) => {
  const curso = await prisma.curso.findUnique({
    where: { id: Number(cursoId) },
    include: {
      asignacionCurso: {
        include: {
          areaCurricular: true,
          anioAcademico: true,
          seccion: { include: { grado: true } },
          docente: { select: { id: true, nombres: true } },
        },
      },
    },
  });
  if (!curso) throw ApiError.notFound("Curso no encontrado");
  if (!curso.asignacionCurso) {
    throw ApiError.conflict("El curso aún no está vinculado a una asignación académica");
  }
  return curso;
};

const verificarDocenteCurso = async (cursoId, docenteId) => {
  const curso = await obtenerContextoCurso(cursoId);
  if (
    curso.asignacionCurso.docenteId !== docenteId ||
    curso.asignacionCurso.estado !== "ACTIVO"
  ) {
    throw ApiError.forbidden("No tienes acceso a esta asignación académica");
  }
  return curso;
};

const verificarEstudianteCurso = async (cursoId, estudianteId) => {
  const curso = await obtenerContextoCurso(cursoId);
  const asignacion = curso.asignacionCurso;
  if (asignacion.estado !== "ACTIVO") {
    throw ApiError.forbidden("La asignación académica no está activa");
  }
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
    throw ApiError.forbidden("No perteneces a la sección de esta asignación académica");
  }
  return curso;
};

module.exports = { obtenerContextoCurso, verificarDocenteCurso, verificarEstudianteCurso };
