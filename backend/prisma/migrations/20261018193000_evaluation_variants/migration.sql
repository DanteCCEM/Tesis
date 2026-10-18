-- CreateEnum
CREATE TYPE "NivelVarianteEvaluacion" AS ENUM ('COMUN', 'BASICO', 'INTERMEDIO', 'AVANZADO');

-- CreateEnum
CREATE TYPE "EstadoVarianteEvaluacion" AS ENUM ('BORRADOR', 'APROBADA', 'PUBLICADA', 'NO_DISPONIBLE');

-- CreateTable
CREATE TABLE "VarianteEvaluacion" (
    "id" SERIAL NOT NULL,
    "evaluacionId" INTEGER NOT NULL,
    "nivelObjetivo" "NivelVarianteEvaluacion" NOT NULL,
    "cantidadPreguntas" INTEGER NOT NULL,
    "dificultadPredominante" "NivelDificultad",
    "estado" "EstadoVarianteEvaluacion" NOT NULL DEFAULT 'BORRADOR',
    "fechaAprobacion" TIMESTAMP(3),
    "docenteAprobadorId" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "VarianteEvaluacion_pkey" PRIMARY KEY ("id")
);

-- AlterTable
ALTER TABLE "Pregunta" ADD COLUMN "nivelVariante" "NivelVarianteEvaluacion",
ADD COLUMN "varianteEvaluacionId" INTEGER;

ALTER TABLE "IntentoEvaluacion" ADD COLUMN "varianteEvaluacionId" INTEGER;

-- CreateIndex
CREATE UNIQUE INDEX "VarianteEvaluacion_evaluacionId_nivelObjetivo_key" ON "VarianteEvaluacion"("evaluacionId", "nivelObjetivo");
CREATE INDEX "VarianteEvaluacion_evaluacionId_estado_idx" ON "VarianteEvaluacion"("evaluacionId", "estado");
CREATE INDEX "IntentoEvaluacion_varianteEvaluacionId_idx" ON "IntentoEvaluacion"("varianteEvaluacionId");

-- AddForeignKey
ALTER TABLE "VarianteEvaluacion" ADD CONSTRAINT "VarianteEvaluacion_evaluacionId_fkey" FOREIGN KEY ("evaluacionId") REFERENCES "Evaluacion"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "VarianteEvaluacion" ADD CONSTRAINT "VarianteEvaluacion_docenteAprobadorId_fkey" FOREIGN KEY ("docenteAprobadorId") REFERENCES "Usuario"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Pregunta" ADD CONSTRAINT "Pregunta_varianteEvaluacionId_fkey" FOREIGN KEY ("varianteEvaluacionId") REFERENCES "VarianteEvaluacion"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "IntentoEvaluacion" ADD CONSTRAINT "IntentoEvaluacion_varianteEvaluacionId_fkey" FOREIGN KEY ("varianteEvaluacionId") REFERENCES "VarianteEvaluacion"("id") ON DELETE SET NULL ON UPDATE CASCADE;
