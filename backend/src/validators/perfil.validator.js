const ApiError = require("../utils/ApiError");

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MAX_BIO = 500;
const MAX_URL = 2048;

// PUT /api/perfil
const validarActualizarPerfil = (req, res, next) => {
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
  if (correo !== undefined) {
    if (!String(correo).trim()) {
      errores.push("correo no puede estar vacío");
    } else if (!EMAIL_REGEX.test(String(correo).trim())) {
      errores.push("correo no tiene un formato válido");
    }
  }
  if (fotoPerfil !== undefined && fotoPerfil !== null && fotoPerfil !== "") {
    const url = String(fotoPerfil).trim();
    if (url.length > MAX_URL) {
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

  if (errores.length > 0) {
    return next(ApiError.badRequest(errores.join("; ")));
  }
  next();
};

module.exports = { validarActualizarPerfil };
