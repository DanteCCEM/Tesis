const ApiError = require("../utils/ApiError");

const ROLES = ["DOCENTE", "ESTUDIANTE"];
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// Valida el cuerpo de POST /api/auth/registro.
const validarRegistro = (req, res, next) => {
  const { nombres, correo, contrasena, rol } = req.body ?? {};
  const errores = [];

  if (!nombres || !String(nombres).trim()) {
    errores.push("nombres es obligatorio");
  }
  if (!correo || !String(correo).trim()) {
    errores.push("correo es obligatorio");
  } else if (!EMAIL_REGEX.test(correo)) {
    errores.push("correo no tiene un formato válido");
  }
  if (!contrasena || String(contrasena).length < 6) {
    errores.push("contraseña es obligatoria y debe tener al menos 6 caracteres");
  }
  if (!rol || !ROLES.includes(rol)) {
    errores.push(`rol es obligatorio y debe ser uno de: ${ROLES.join(", ")}`);
  }

  if (errores.length > 0) {
    return next(ApiError.badRequest(errores.join("; ")));
  }
  next();
};

// Valida el cuerpo de POST /api/auth/login.
const validarLogin = (req, res, next) => {
  const { correo, contrasena } = req.body ?? {};
  const errores = [];

  if (!correo || !String(correo).trim()) {
    errores.push("correo es obligatorio");
  }
  if (!contrasena) {
    errores.push("contraseña es obligatoria");
  }

  if (errores.length > 0) {
    return next(ApiError.badRequest(errores.join("; ")));
  }
  next();
};

module.exports = { validarRegistro, validarLogin, ROLES };
