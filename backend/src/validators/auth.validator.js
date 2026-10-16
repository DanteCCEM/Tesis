const ApiError = require("../utils/ApiError");
const { validarPasswordSegura } = require("../utils/password");

const USERNAME_REGEX = /^[a-z0-9._-]{3,40}$/;

const validarLogin = (req, _res, next) => {
  const { username, contrasena } = req.body ?? {};
  const errores = [];
  if (!username || !String(username).trim()) errores.push("username es obligatorio");
  if (!contrasena) errores.push("contraseña es obligatoria");
  if (errores.length) return next(ApiError.badRequest(errores.join("; ")));
  next();
};

const validarCambioPassword = (req, _res, next) => {
  const { contrasenaActual, nuevaContrasena } = req.body ?? {};
  const errores = [];
  if (!contrasenaActual) errores.push("contraseña actual es obligatoria");
  const errorPassword = validarPasswordSegura(nuevaContrasena);
  if (errorPassword) errores.push(`nueva contraseña ${errorPassword}`);
  if (errores.length) return next(ApiError.badRequest(errores.join("; ")));
  next();
};

module.exports = { validarLogin, validarCambioPassword, USERNAME_REGEX };
