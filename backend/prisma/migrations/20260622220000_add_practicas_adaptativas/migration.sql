-- CreateEnum
CREATE TYPE "EstadoPracticaAdaptativa" AS ENUM ('PENDIENTE', 'EN_CURSO', 'COMPLETADA');

-- AlterTable
ALTER TABLE "Evaluacion" ADD COLUMN "esPracticaAdaptativa" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Evaluacion" ADD COLUMN "estudianteObjetivoId" INTEGER;

-- CreateTable
CREATE TABLE "PracticaAdaptativa" (
    "id" SERIAL NOT NULL,
    "tema" TEXT NOT NULL,
    "dificultad" "NivelDificultad" NOT NULL,
    "estado" "EstadoPracticaAdaptativa" NOT NULL DEFAULT 'PENDIENTE',
    "motivoResumen" JSONB NOT NULL,
    "cantidadPreguntas" INTEGER NOT NULL DEFAULT 5,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "estudianteId" INTEGER NOT NULL,
    "cursoId" INTEGER NOT NULL,
    "evaluacionId" INTEGER NOT NULL,

    CONSTRAINT "PracticaAdaptativa_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "PracticaAdaptativa_evaluacionId_key" ON "PracticaAdaptativa"("evaluacionId");

-- AddForeignKey
ALTER TABLE "Evaluacion" ADD CONSTRAINT "Evaluacion_estudianteObjetivoId_fkey" FOREIGN KEY ("estudianteObjetivoId") REFERENCES "Usuario"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "PracticaAdaptativa" ADD CONSTRAINT "PracticaAdaptativa_estudianteId_fkey" FOREIGN KEY ("estudianteId") REFERENCES "Usuario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "PracticaAdaptativa" ADD CONSTRAINT "PracticaAdaptativa_cursoId_fkey" FOREIGN KEY ("cursoId") REFERENCES "Curso"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "PracticaAdaptativa" ADD CONSTRAINT "PracticaAdaptativa_evaluacionId_fkey" FOREIGN KEY ("evaluacionId") REFERENCES "Evaluacion"("id") ON DELETE CASCADE ON UPDATE CASCADE;
