const ApiError = require("../utils/ApiError");
const { USERNAME_REGEX } = require("./auth.validator");
const { validarPasswordSegura } = require("../utils/password");

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const ROLES = ["ADMIN", "DOCENTE", "ESTUDIANTE"];
const ESTADOS = ["ACTIVO", "BLOQUEADO", "INACTIVO"];

const validarCrearUsuario = (req, _res, next) => {
  const { username, nombres, correo, contrasenaTemporal, rol } = req.body ?? {};
  const errores = [];
  if (!USERNAME_REGEX.test(String(username || "").trim().toLowerCase())) {
    errores.push("username debe tener 3 a 40 caracteres: letras minúsculas, números, punto, guion o guion bajo");
  }
  if (!nombres || !String(nombres).trim()) errores.push("nombres es obligatorio");
  if (correo && !EMAIL_REGEX.test(String(correo).trim())) errores.push("correo no es válido");
  const errorPassword = validarPasswordSegura(contrasenaTemporal);
  if (errorPassword) errores.push(`contraseña temporal ${errorPassword}`);
  if (!ROLES.includes(rol)) errores.push(`rol debe ser uno de: ${ROLES.join(", ")}`);
  if (errores.length) return next(ApiError.badRequest(errores.join("; ")));
  next();
};

const validarEstado = (req, _res, next) => {
  if (!ESTADOS.includes(req.body?.estado)) {
    return next(ApiError.badRequest(`estado debe ser uno de: ${ESTADOS.join(", ")}`));
  }
  next();
};

module.exports = { validarCrearUsuario, validarEstado };
