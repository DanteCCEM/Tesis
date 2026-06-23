const jwt = require("jsonwebtoken");
const ApiError = require("../utils/ApiError");

// Protege rutas que requieren un JWT válido.
// Espera el header: Authorization: Bearer <token>
const authMiddleware = (req, res, next) => {
  const header = req.headers.authorization || "";
  const [esquema, token] = header.split(" ");

  if (esquema !== "Bearer" || !token) {
    return next(ApiError.unauthorized("Token no proporcionado"));
  }

  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET);
    // Datos del usuario disponibles para los siguientes handlers.
    req.usuario = {
      id: payload.id,
      correo: payload.correo,
      rol: payload.rol,
    };
    next();
  } catch (err) {
    return next(ApiError.unauthorized("Token inválido o expirado"));
  }
};

module.exports = authMiddleware;
