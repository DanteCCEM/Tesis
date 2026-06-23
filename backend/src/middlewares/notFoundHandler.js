// Captura cualquier petición que no coincida con una ruta registrada.
const notFoundHandler = (req, res) => {
  res.status(404).json({
    ok: false,
    error: `Ruta no encontrada: ${req.method} ${req.originalUrl}`,
  });
};

module.exports = notFoundHandler;
