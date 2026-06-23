const ApiError = require("../utils/ApiError");

const esEnteroPositivo = (valor) =>
  Number.isInteger(Number(valor)) && Number(valor) > 0;

const validarGenerarPractica = (req, res, next) => {
  const { cursoId } = req.body ?? {};
  const errores = [];

  if (cursoId !== undefined && cursoId !== null && cursoId !== "") {
    if (!esEnteroPositivo(cursoId)) {
      errores.push("cursoId debe ser un entero válido");
    }
  }

  if (errores.length > 0) {
    return next(ApiError.badRequest(errores.join("; ")));
  }

  req.body = {
    cursoId:
      cursoId !== undefined && cursoId !== null && cursoId !== ""
        ? Number(cursoId)
        : undefined,
  };

  next();
};

module.exports = {
  validarGenerarPractica,
};
