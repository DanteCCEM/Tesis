-- Añade cuentas institucionales sin eliminar usuarios ni correos existentes.
ALTER TYPE "Rol" ADD VALUE IF NOT EXISTS 'ADMIN';

CREATE TYPE "EstadoUsuario" AS ENUM ('ACTIVO', 'BLOQUEADO', 'INACTIVO');

ALTER TABLE "Usuario"
  ADD COLUMN "username" TEXT,
  ADD COLUMN "estado" "EstadoUsuario" NOT NULL DEFAULT 'ACTIVO',
  ADD COLUMN "debeCambiarPassword" BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN "sessionVersion" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "ultimoAcceso" TIMESTAMP(3),
  ADD COLUMN "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- Los usernames heredados son deterministas y únicos. Se usa la parte local
-- saneada del correo como pista legible y el id como sufijo anti-colisión.
UPDATE "Usuario"
SET "username" = CONCAT(
  COALESCE(
    NULLIF(
      LOWER(REGEXP_REPLACE(SPLIT_PART(COALESCE("correo", ''), '@', 1), '[^a-zA-Z0-9._-]', '', 'g')),
      ''
    ),
    'usuario'
  ),
  '_',
  "id"
);

ALTER TABLE "Usuario"
  ALTER COLUMN "username" SET NOT NULL,
  ALTER COLUMN "correo" DROP NOT NULL;

CREATE UNIQUE INDEX "Usuario_username_key" ON "Usuario"("username");
