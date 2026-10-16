const bcrypt = require("bcryptjs");
const prisma = require("../config/prisma");
const ApiError = require("../utils/ApiError");
const { generarPasswordTemporal } = require("../utils/password");

const SALT_ROUNDS = 10;
const sanitizar = ({ contrasena, sessionVersion, ...usuario }) => usuario;

const parseId = (valor) => {
  const id = Number(valor);
  if (!Number.isInteger(id) || id <= 0) throw ApiError.badRequest("id de usuario inválido");
  return id;
};

const accionPorCambioEstado = (anterior, nuevo) => {
  if (nuevo === "BLOQUEADO") return "USER_BLOCKED";
  if (nuevo === "INACTIVO") return "USER_DEACTIVATED";
  if (nuevo === "ACTIVO" && anterior !== "ACTIVO") return "USER_UNBLOCKED";
  return null;
};

const adminService = {
  async crearUsuario({ username, nombres, correo, contrasenaTemporal, rol }) {
    const usernameNormalizado = String(username).trim().toLowerCase();
    const correoNormalizado = correo ? String(correo).trim().toLowerCase() : null;
    const [usernameExistente, correoExistente] = await Promise.all([
      prisma.usuario.findUnique({ where: { username: usernameNormalizado } }),
      correoNormalizado
        ? prisma.usuario.findUnique({ where: { correo: correoNormalizado } })
        : null,
    ]);
    if (usernameExistente) throw ApiError.conflict("El username ya está en uso");
    if (correoExistente) throw ApiError.conflict("El correo ya está registrado");

    const contrasena = await bcrypt.hash(contrasenaTemporal, SALT_ROUNDS);
    const usuario = await prisma.usuario.create({
      data: {
        username: usernameNormalizado,
        nombres: String(nombres).trim(),
        correo: correoNormalizado,
        contrasena,
        rol,
        estado: "ACTIVO",
        debeCambiarPassword: true,
      },
    });
    return sanitizar(usuario);
  },

  async restablecerPassword(usuarioId, administradorId) {
    const id = parseId(usuarioId);
    const usuario = await prisma.usuario.findUnique({
      where: { id },
      select: { id: true },
    });
    if (!usuario) throw ApiError.notFound("Usuario no encontrado");

    const contrasenaTemporal = generarPasswordTemporal();
    const contrasena = await bcrypt.hash(contrasenaTemporal, SALT_ROUNDS);
    const actualizado = await prisma.$transaction(async (tx) => {
      const resultado = await tx.usuario.update({
        where: { id },
        data: {
          contrasena,
          debeCambiarPassword: true,
          sessionVersion: { increment: 1 },
        },
      });
      await tx.auditoria.create({
        data: {
          usuarioActorId: administradorId,
          usuarioObjetivoId: id,
          accion: "PASSWORD_RESET",
          datos: { origen: "ADMIN_API" },
        },
      });
      return resultado;
    });

    return { usuario: sanitizar(actualizado), contrasenaTemporal };
  },

  async cambiarEstado(usuarioId, estado, administradorId) {
    const id = parseId(usuarioId);
    try {
      return await prisma.$transaction(
        async (tx) => {
          const usuario = await tx.usuario.findUnique({ where: { id } });
          if (!usuario) throw ApiError.notFound("Usuario no encontrado");
          if (usuario.estado === estado) return sanitizar(usuario);

          if (usuario.rol === "ADMIN" && usuario.estado === "ACTIVO" && estado !== "ACTIVO") {
            const administradoresActivos = await tx.usuario.count({
              where: { rol: "ADMIN", estado: "ACTIVO" },
            });
            if (administradoresActivos <= 1) {
              throw ApiError.conflict("Debe permanecer al menos un administrador activo");
            }
          }

          const actualizado = await tx.usuario.update({
            where: { id },
            data: {
              estado,
              ...(estado !== "ACTIVO" ? { sessionVersion: { increment: 1 } } : {}),
            },
          });
          const accion = accionPorCambioEstado(usuario.estado, estado);
          if (accion) {
            await tx.auditoria.createMany({
              data: [{
                usuarioActorId: administradorId,
                usuarioObjetivoId: id,
                accion,
                datos: { estadoAnterior: usuario.estado, estadoNuevo: estado },
              }, {
                usuarioActorId: administradorId,
                usuarioObjetivoId: id,
                accion: "USER_STATUS_CHANGED",
                datos: { estadoAnterior: usuario.estado, estadoNuevo: estado },
              }],
            });
          }
          return sanitizar(actualizado);
        },
        { isolationLevel: "Serializable" },
      );
    } catch (error) {
      if (error?.code === "P2034") {
        throw ApiError.conflict("La cuenta cambió durante la operación; inténtalo nuevamente");
      }
      throw error;
    }
  },
};

module.exports = adminService;
