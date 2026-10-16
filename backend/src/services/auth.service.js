const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const prisma = require("../config/prisma");
const ApiError = require("../utils/ApiError");

const SALT_ROUNDS = 10;

const sanitizarUsuario = (usuario) => {
  const { contrasena, sessionVersion, ...resto } = usuario;
  return resto;
};

const generarToken = (usuario) =>
  jwt.sign(
    {
      id: usuario.id,
      username: usuario.username,
      rol: usuario.rol,
      sessionVersion: usuario.sessionVersion,
    },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRES_IN || "1d" },
  );

const authService = {
  async login({ username, contrasena }) {
    const usuario = await prisma.usuario.findUnique({
      where: { username: String(username).trim().toLowerCase() },
    });
    if (!usuario) throw ApiError.unauthorized("Credenciales inválidas");

    const coincide = await bcrypt.compare(contrasena, usuario.contrasena);
    if (!coincide) throw ApiError.unauthorized("Credenciales inválidas");
    if (usuario.estado !== "ACTIVO") {
      throw ApiError.unauthorized("La cuenta no está activa");
    }

    const actualizado = await prisma.usuario.update({
      where: { id: usuario.id },
      data: { ultimoAcceso: new Date() },
    });
    return {
      token: generarToken(actualizado),
      usuario: sanitizarUsuario(actualizado),
    };
  },

  async obtenerPerfil(id) {
    const usuario = await prisma.usuario.findUnique({ where: { id } });
    if (!usuario) throw ApiError.notFound("Usuario no encontrado");
    return sanitizarUsuario(usuario);
  },

  async cambiarPasswordPropio(usuarioId, { contrasenaActual, nuevaContrasena }) {
    const usuario = await prisma.usuario.findUnique({ where: { id: usuarioId } });
    if (!usuario) throw ApiError.unauthorized("La sesión ya no es válida");

    const coincide = await bcrypt.compare(contrasenaActual, usuario.contrasena);
    if (!coincide) throw ApiError.badRequest("La contraseña actual es incorrecta");
    if (await bcrypt.compare(nuevaContrasena, usuario.contrasena)) {
      throw ApiError.badRequest("La nueva contraseña debe ser diferente a la actual");
    }

    const contrasena = await bcrypt.hash(nuevaContrasena, SALT_ROUNDS);
    const actualizado = await prisma.$transaction(async (tx) => {
      const resultado = await tx.usuario.update({
        where: { id: usuarioId },
        data: {
          contrasena,
          debeCambiarPassword: false,
          sessionVersion: { increment: 1 },
        },
      });
      await tx.auditoria.create({
        data: {
          usuarioActorId: usuarioId,
          usuarioObjetivoId: usuarioId,
          accion: "PASSWORD_CHANGE",
        },
      });
      return resultado;
    });
    return {
      token: generarToken(actualizado),
      usuario: sanitizarUsuario(actualizado),
    };
  },
};

module.exports = authService;
