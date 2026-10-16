const ApiError = require("../utils/ApiError");

const validarAsignacion = (req, _res, next) => {
  const datos = req.body ?? {};
  const parcial = req.method !== "POST";
  const errores = [];
  for (const campo of ["areaCurricularId", "seccionId", "docenteId", "anioAcademicoId"]) {
    if ((!parcial || datos[campo] !== undefined) && (!Number.isInteger(Number(datos[campo])) || Number(datos[campo]) <= 0)) errores.push(`${campo} no es válido`);
  }
  if (datos.estado !== undefined && !["ACTIVO", "INACTIVO"].includes(datos.estado)) errores.push("estado no es válido");
  if (errores.length) return next(ApiError.badRequest(errores.join("; ")));
  next();
};

module.exports = validarAsignacion;
