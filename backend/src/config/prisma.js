const { PrismaClient } = require("../generated/prisma");
const { PrismaPg } = require("@prisma/adapter-pg");

// Prisma 7 requiere un driver adapter. Usamos el de PostgreSQL (node-postgres)
// con la cadena de conexión definida en DATABASE_URL (.env).
const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });

// Reutilizamos una única instancia para evitar abrir múltiples pools de
// conexiones durante el hot-reload de nodemon en desarrollo.
const prisma = globalThis.__prismaClient ?? new PrismaClient({ adapter });

if (process.env.NODE_ENV !== "production") {
  globalThis.__prismaClient = prisma;
}

module.exports = prisma;
