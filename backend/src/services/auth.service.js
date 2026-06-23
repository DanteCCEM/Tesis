const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const prisma = require("../config/prisma");
const ApiError = require("../utils/ApiError");

const SALT_ROUNDS = 10;

// Elimina la contraseña (hash) antes de devolver el usuario al cliente.
const sanitizarUsuario = (usuario) => {
  const { contrasena, ...resto } = usuario;
  return resto;
};

// Genera un JWT con id, correo y rol del usuario.
const generarToken = (usuario) => {
  const payload = {
    id: usuario.id,
    correo: usuario.correo,
    rol: usuario.rol,
  };
  return jwt.sign(payload, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN || "1d",
  });
};

const authService = {
  async registrar({ nombres, correo, contrasena, rol }) {
    const existente = await prisma.usuario.findUnique({ where: { correo } });
    if (existente) {
      throw ApiError.conflict("El correo ya está registrado");
    }

    const hash = await bcrypt.hash(contrasena, SALT_ROUNDS);

    const usuario = await prisma.usuario.create({
      data: { nombres, correo, contrasena: hash, rol },
    });

    return sanitizarUsuario(usuario);
  },

  async login({ correo, contrasena }) {
    const usuario = await prisma.usuario.findUnique({ where: { correo } });
    // Mismo mensaje para usuario inexistente o contraseña incorrecta,
    // para no revelar qué correos están registrados.
    if (!usuario) {
      throw ApiError.unauthorized("Credenciales inválidas");
    }

    const coincide = await bcrypt.compare(contrasena, usuario.contrasena);
    if (!coincide) {
      throw ApiError.unauthorized("Credenciales inválidas");
    }

    const token = generarToken(usuario);
    return { token, usuario: sanitizarUsuario(usuario) };
  },

  async obtenerPerfil(id) {
    const usuario = await prisma.usuario.findUnique({ where: { id } });
    if (!usuario) {
      throw ApiError.notFound("Usuario no encontrado");
    }
    return sanitizarUsuario(usuario);
  },
};

module.exports = authService;
