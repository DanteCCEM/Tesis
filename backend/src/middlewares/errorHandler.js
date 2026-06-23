// Middleware centralizado de errores. Debe registrarse al final de la
// cadena de middlewares en server.js (después de las rutas).
const errorHandler = (err, req, res, next) => {
  const statusCode = err.statusCode || 500;
  const message = err.message || "Error interno del servidor";

  console.error(`[Error] ${req.method} ${req.originalUrl} -> ${message}`);

  res.status(statusCode).json({
    ok: false,
    error: message,
  });
};

module.exports = errorHandler;
