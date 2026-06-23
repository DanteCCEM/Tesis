const ApiError = require("../utils/ApiError");

// Valida el cuerpo de POST /api/cursos.
const validarCrearCurso = (req, res, next) => {
  const { nombre, grado, seccion } = req.body ?? {};
  const errores = [];

  if (!nombre || !String(nombre).trim()) {
    errores.push("nombre es obligatorio");
  }
  if (!grado || !String(grado).trim()) {
    errores.push("grado es obligatorio");
  }
  if (!seccion || !String(seccion).trim()) {
    errores.push("sección es obligatoria");
  }

  if (errores.length > 0) {
    return next(ApiError.badRequest(errores.join("; ")));
  }
  next();
};

// Valida el cuerpo de POST /api/cursos/:id/matriculas.
// Se requiere el correo o el id del estudiante.
const validarMatricula = (req, res, next) => {
  const { correo, estudianteId } = req.body ?? {};

  if (
    (!correo || !String(correo).trim()) &&
    (estudianteId === undefined || estudianteId === null || estudianteId === "")
  ) {
    return next(
      ApiError.badRequest("Debes proporcionar el correo o el id del estudiante"),
    );
  }
  next();
};

module.exports = { validarCrearCurso, validarMatricula };
