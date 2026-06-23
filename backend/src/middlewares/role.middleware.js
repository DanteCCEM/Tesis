const ApiError = require("../utils/ApiError");

// Restringe el acceso a los roles indicados. Debe usarse SIEMPRE después de
// authMiddleware, ya que depende de req.usuario.
// Uso: autorizarRoles("DOCENTE") o autorizarRoles("DOCENTE", "ESTUDIANTE").
const autorizarRoles = (...roles) => (req, res, next) => {
  if (!req.usuario) {
    return next(ApiError.unauthorized("No autenticado"));
  }
  if (!roles.includes(req.usuario.rol)) {
    return next(ApiError.forbidden("No tienes permisos para realizar esta acción"));
  }
  next();
};

module.exports = autorizarRoles;
