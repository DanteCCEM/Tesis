const ApiError = require("../utils/ApiError");

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MAX_BIO = 500;
const MAX_URL = 2048;

const validarActualizarPerfil = (req, _res, next) => {
  const {
    nombres,
    correo,
    fotoPerfil,
    telefono,
    institucionEducativa,
    biografiaCorta,
  } = req.body ?? {};
  const errores = [];

  if (nombres !== undefined && !String(nombres).trim()) {
    errores.push("nombres no puede estar vacío");
  }
  const correoNormalizado = String(correo ?? "").trim();
  if (correo !== undefined && correoNormalizado && !EMAIL_REGEX.test(correoNormalizado)) {
    errores.push("correo no tiene un formato válido");
  }
  if (fotoPerfil !== undefined && fotoPerfil !== null && fotoPerfil !== "") {
    if (String(fotoPerfil).trim().length > MAX_URL) {
      errores.push("fotoPerfil excede la longitud máxima permitida");
    }
  }
  if (telefono !== undefined && telefono !== null && String(telefono).length > 30) {
    errores.push("teléfono demasiado largo");
  }
  if (
    institucionEducativa !== undefined &&
    institucionEducativa !== null &&
    String(institucionEducativa).length > 150
  ) {
    errores.push("institución educativa demasiado larga");
  }
  if (
    biografiaCorta !== undefined &&
    biografiaCorta !== null &&
    String(biografiaCorta).length > MAX_BIO
  ) {
    errores.push(`biografía corta no puede superar ${MAX_BIO} caracteres`);
  }
  if (errores.length) return next(ApiError.badRequest(errores.join("; ")));
  next();
};

module.exports = { validarActualizarPerfil };
