const jwt = require("jsonwebtoken");
const prisma = require("../config/prisma");
const ApiError = require("../utils/ApiError");

const authMiddleware = async (req, _res, next) => {
  if (req.usuario) return next();

  const [esquema, token] = (req.headers.authorization || "").split(" ");
  if (esquema !== "Bearer" || !token) {
    return next(ApiError.unauthorized("Token no proporcionado"));
  }

  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET);
    const usuario = await prisma.usuario.findUnique({
      where: { id: Number(payload.id) },
      select: {
        id: true,
        username: true,
        rol: true,
        estado: true,
        debeCambiarPassword: true,
        sessionVersion: true,
      },
    });
    if (
      !usuario ||
      usuario.estado !== "ACTIVO" ||
      usuario.sessionVersion !== payload.sessionVersion
    ) {
      return next(ApiError.unauthorized("La sesión ya no es válida"));
    }

    req.usuario = usuario;
    return next();
  } catch (error) {
    if (error instanceof ApiError) return next(error);
    return next(ApiError.unauthorized("Token inválido o expirado"));
  }
};

module.exports = authMiddleware;
