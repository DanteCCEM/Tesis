ALTER TABLE "Pregunta"
ADD COLUMN "generadaPorIA" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN "fechaGeneracion" TIMESTAMP(3),
ADD COLUMN "modeloGeneracion" TEXT,
ADD COLUMN "revisadaPorDocente" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN "fechaRevision" TIMESTAMP(3);
