// Envuelve controladores async para reenviar cualquier error al middleware
// centralizado de errores sin tener que escribir try/catch en cada handler.
const asyncHandler = (fn) => (req, res, next) =>
  Promise.resolve(fn(req, res, next)).catch(next);

module.exports = asyncHandler;
