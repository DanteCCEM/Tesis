require("dotenv/config");

const bcrypt = require("bcryptjs");
const prisma = require("../src/config/prisma");
const { generarPasswordTemporal } = require("../src/utils/password");

const SALT_ROUNDS = 10;

const ejecutar = async () => {
  const username = String(process.argv[2] ?? "").trim().toLowerCase();
  if (!username) {
    throw new Error("Uso: npm run admin:reset -- <username>");
  }

  const administrador = await prisma.usuario.findUnique({ where: { username } });
  if (!administrador || administrador.rol !== "ADMIN") {
    throw new Error("No existe un ADMIN con ese username");
  }

  const contrasenaTemporal = generarPasswordTemporal();
  const contrasena = await bcrypt.hash(contrasenaTemporal, SALT_ROUNDS);
  await prisma.$transaction(async (tx) => {
    await tx.usuario.update({
      where: { id: administrador.id },
      data: {
        contrasena,
        estado: "ACTIVO",
        debeCambiarPassword: true,
        sessionVersion: { increment: 1 },
      },
    });
    await tx.auditoria.create({
      data: {
        usuarioActorId: administrador.id,
        usuarioObjetivoId: administrador.id,
        accion: "PASSWORD_RESET",
        datos: { origen: "EMERGENCY_CLI" },
      },
    });
  });

  process.stdout.write(`Contraseña temporal para ${username}: ${contrasenaTemporal}\n`);
  process.stdout.write("Cópiala ahora: no se almacena y no podrá consultarse después.\n");
};

ejecutar()
  .catch((error) => {
    process.stderr.write(`${error.message}\n`);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
