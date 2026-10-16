// Middleware centralizado de errores. Debe registrarse al final de la
// cadena de middlewares en server.js (después de las rutas).
const errorHandler = (err, req, res, next) => {
  const statusCode = err.statusCode || 500;
  const message = err.statusCode
    ? err.message
    : "Error interno del servidor";

  const detalleLog = err.statusCode
    ? message
    : `${err.name || "Error"}${err.code ? ` (${err.code})` : ""}`;
  console.error(`[Error] ${req.method} ${req.originalUrl} -> ${detalleLog}`);

  res.status(statusCode).json({
    ok: false,
    error: message,
    ...(err.code ? { code: err.code } : {}),
  });
};

module.exports = errorHandler;
