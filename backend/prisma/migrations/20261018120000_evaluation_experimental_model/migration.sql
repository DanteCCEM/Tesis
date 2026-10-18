-- Tipos formales del modelo experimental de la tesis.
CREATE TYPE "TipoEvaluacion" AS ENUM (
  'REGULAR',
  'DIAGNOSTICA',
  'FORMATIVA_ADAPTATIVA',
  'FINAL',
  'PRACTICA_ADAPTATIVA'
);

ALTER TABLE "Evaluacion"
ADD COLUMN "tipoEvaluacion" "TipoEvaluacion" NOT NULL DEFAULT 'REGULAR',
ADD COLUMN "esAdaptativa" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN "configuracionAdaptativa" JSONB,
ADD COLUMN "anioAcademicoId" INTEGER;

-- Las prácticas ya existentes conservan su semántica específica.
UPDATE "Evaluacion"
SET "tipoEvaluacion" = 'PRACTICA_ADAPTATIVA',
    "esAdaptativa" = true
WHERE "esPracticaAdaptativa" = true;

-- Vincula evaluaciones existentes al año de su asignación, cuando existe.
UPDATE "Evaluacion" AS e
SET "anioAcademicoId" = ac."anioAcademicoId"
FROM "Curso" AS c
JOIN "AsignacionCurso" AS ac ON ac."id" = c."asignacionCursoId"
WHERE e."cursoId" = c."id";

ALTER TABLE "Evaluacion"
ADD CONSTRAINT "Evaluacion_anioAcademicoId_fkey"
FOREIGN KEY ("anioAcademicoId") REFERENCES "AnioAcademico"("id")
ON DELETE SET NULL ON UPDATE CASCADE;

CREATE INDEX "Evaluacion_cursoId_tipoEvaluacion_idx"
ON "Evaluacion"("cursoId", "tipoEvaluacion");

CREATE INDEX "Evaluacion_anioAcademicoId_tipoEvaluacion_idx"
ON "Evaluacion"("anioAcademicoId", "tipoEvaluacion");
