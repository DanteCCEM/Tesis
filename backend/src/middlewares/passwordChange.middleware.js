const ApiError = require("../utils/ApiError");

const exigirPasswordActualizada = (req, _res, next) => {
  if (req.usuario?.debeCambiarPassword) {
    return next(
      new ApiError(
        403,
        "Debes cambiar tu contraseña antes de continuar",
        "PASSWORD_CHANGE_REQUIRED",
      ),
    );
  }
  next();
};

module.exports = exigirPasswordActualizada;
