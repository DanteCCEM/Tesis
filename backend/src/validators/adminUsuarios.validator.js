const ApiError = require("../utils/ApiError");
const { USERNAME_REGEX } = require("./auth.validator");

const DNI_REGEX = /^\d{8}$/;
const ESTADOS_MATRICULA = ["ACTIVO", "INACTIVO"];
const texto = (valor) => String(valor ?? "").trim();

const validarPersona = (rol, parcial = false) => (req, _res, next) => {
  const datos = req.body ?? {};
  const errores = [];
  const requeridos = ["dni", "nombres", "apellidoPaterno", "apellidoMaterno"];
  for (const campo of requeridos) {
    if ((!parcial || datos[campo] !== undefined) && !texto(datos[campo])) errores.push(`${campo} es obligatorio`);
  }
  if (datos.dni !== undefined && !DNI_REGEX.test(texto(datos.dni))) errores.push("dni debe contener 8 dígitos");
  if (datos.username !== undefined && !USERNAME_REGEX.test(texto(datos.username).toLowerCase())) {
    errores.push("username debe tener entre 3 y 40 caracteres válidos");
  }
  for (const campo of ["nombres", "apellidoPaterno", "apellidoMaterno"]) {
    if (datos[campo] !== undefined && texto(datos[campo]).length > 100) errores.push(`${campo} es demasiado largo`);
  }
  if (datos.telefono !== undefined && texto(datos.telefono).length > 30) errores.push("telefono es demasiado largo");
  if (rol === "DOCENTE" && datos.especialidad !== undefined && texto(datos.especialidad).length > 150) {
    errores.push("especialidad es demasiado larga");
  }
  if (rol === "ESTUDIANTE" && datos.codigoEstudiante !== undefined && texto(datos.codigoEstudiante).length > 50) {
    errores.push("codigoEstudiante es demasiado largo");
  }
  if (rol === "ESTUDIANTE" && datos.fechaNacimiento && Number.isNaN(Date.parse(datos.fechaNacimiento))) {
    errores.push("fechaNacimiento no es válida");
  }
  if (errores.length) return next(ApiError.badRequest(errores.join("; ")));
  next();
};

const validarMatriculaAcademica = (req, _res, next) => {
  const { anioAcademicoId, seccionId, estado } = req.body ?? {};
  const errores = [];
  if (!Number.isInteger(Number(anioAcademicoId)) || Number(anioAcademicoId) <= 0) errores.push("anioAcademicoId no es válido");
  if (!Number.isInteger(Number(seccionId)) || Number(seccionId) <= 0) errores.push("seccionId no es válido");
  if (estado !== undefined && !ESTADOS_MATRICULA.includes(estado)) errores.push("estado no es válido");
  if (errores.length) return next(ApiError.badRequest(errores.join("; ")));
  next();
};

module.exports = {
  crearDocente: validarPersona("DOCENTE"),
  actualizarDocente: validarPersona("DOCENTE", true),
  crearEstudiante: validarPersona("ESTUDIANTE"),
  actualizarEstudiante: validarPersona("ESTUDIANTE", true),
  validarMatriculaAcademica,
};
