#!/bin/sh
set -e

echo "Aplicando migraciones de Prisma..."
npx prisma migrate deploy

if [ "$RUN_SEED" = "true" ]; then
  echo "Ejecutando seed de datos demo..."
  npm run seed
fi

echo "Iniciando API en el puerto ${PORT:-3000}..."
exec node src/server.js
