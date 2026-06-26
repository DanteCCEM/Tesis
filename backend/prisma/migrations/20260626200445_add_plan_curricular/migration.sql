-- CreateEnum
CREATE TYPE "PeriodoCurricular" AS ENUM ('SEMESTRE', 'BIMESTRE', 'TRIMESTRE');

-- CreateEnum
CREATE TYPE "EstadoPlanCurricular" AS ENUM ('BORRADOR', 'PUBLICADO');

-- CreateEnum
CREATE TYPE "EstadoTemaCurricular" AS ENUM ('PENDIENTE', 'EN_PROCESO', 'COMPLETADO');

-- AlterTable
ALTER TABLE "Evaluacion" ADD COLUMN     "subtemaCurricularId" INTEGER,
ADD COLUMN     "temaCurricularId" INTEGER;

-- CreateTable
CREATE TABLE "PlanCurricular" (
    "id" SERIAL NOT NULL,
    "nombreArchivo" TEXT NOT NULL,
    "rutaArchivo" TEXT NOT NULL,
    "periodo" "PeriodoCurricular" NOT NULL,
    "estado" "EstadoPlanCurricular" NOT NULL DEFAULT 'BORRADOR',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "cursoId" INTEGER NOT NULL,

    CONSTRAINT "PlanCurricular_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UnidadCurricular" (
    "id" SERIAL NOT NULL,
    "titulo" TEXT NOT NULL,
    "descripcion" TEXT,
    "orden" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "planCurricularId" INTEGER NOT NULL,

    CONSTRAINT "UnidadCurricular_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TemaCurricular" (
    "id" SERIAL NOT NULL,
    "titulo" TEXT NOT NULL,
    "descripcion" TEXT,
    "orden" INTEGER NOT NULL,
    "estado" "EstadoTemaCurricular" NOT NULL DEFAULT 'PENDIENTE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "unidadCurricularId" INTEGER NOT NULL,

    CONSTRAINT "TemaCurricular_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SubtemaCurricular" (
    "id" SERIAL NOT NULL,
    "titulo" TEXT NOT NULL,
    "descripcion" TEXT,
    "orden" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "temaCurricularId" INTEGER NOT NULL,

    CONSTRAINT "SubtemaCurricular_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "Evaluacion" ADD CONSTRAINT "Evaluacion_temaCurricularId_fkey" FOREIGN KEY ("temaCurricularId") REFERENCES "TemaCurricular"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Evaluacion" ADD CONSTRAINT "Evaluacion_subtemaCurricularId_fkey" FOREIGN KEY ("subtemaCurricularId") REFERENCES "SubtemaCurricular"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PlanCurricular" ADD CONSTRAINT "PlanCurricular_cursoId_fkey" FOREIGN KEY ("cursoId") REFERENCES "Curso"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UnidadCurricular" ADD CONSTRAINT "UnidadCurricular_planCurricularId_fkey" FOREIGN KEY ("planCurricularId") REFERENCES "PlanCurricular"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TemaCurricular" ADD CONSTRAINT "TemaCurricular_unidadCurricularId_fkey" FOREIGN KEY ("unidadCurricularId") REFERENCES "UnidadCurricular"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SubtemaCurricular" ADD CONSTRAINT "SubtemaCurricular_temaCurricularId_fkey" FOREIGN KEY ("temaCurricularId") REFERENCES "TemaCurricular"("id") ON DELETE CASCADE ON UPDATE CASCADE;
