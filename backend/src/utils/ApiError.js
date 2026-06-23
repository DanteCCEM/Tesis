// Error operacional con código HTTP, para distinguir errores esperados
// (validación, no encontrado, etc.) de errores inesperados del servidor.
class ApiError extends Error {
  constructor(statusCode, message) {
    super(message);
    this.statusCode = statusCode;
    this.name = "ApiError";
  }

  static badRequest(message = "Solicitud inválida") {
    return new ApiError(400, message);
  }

  static unauthorized(message = "No autorizado") {
    return new ApiError(401, message);
  }

  static forbidden(message = "Acceso denegado") {
    return new ApiError(403, message);
  }

  static notFound(message = "Recurso no encontrado") {
    return new ApiError(404, message);
  }

  static conflict(message = "Conflicto con el estado actual del recurso") {
    return new ApiError(409, message);
  }

  static tooManyRequests(message = "Demasiadas solicitudes") {
    return new ApiError(429, message);
  }

  static serviceUnavailable(message = "Servicio no disponible") {
    return new ApiError(503, message);
  }
}

module.exports = ApiError;
