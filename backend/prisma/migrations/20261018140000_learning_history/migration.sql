-- Historial inmutable de aprendizaje y ampliación del resumen por tema.
ALTER TABLE "ProgresoEstudiante"
RENAME COLUMN "updatedAt" TO "ultimaActualizacion";

ALTER TABLE "ProgresoEstudiante"
ADD COLUMN "asignacionCursoId" INTEGER,
ADD COLUMN "temaCurricularId" INTEGER,
ADD COLUMN "cantidadEvaluaciones" INTEGER NOT NULL DEFAULT 0;

UPDATE "ProgresoEstudiante" AS p
SET "asignacionCursoId" = c."asignacionCursoId"
FROM "Curso" AS c
WHERE p."cursoId" = c."id";

CREATE TABLE "HistorialProgreso" (
    "id" SERIAL NOT NULL,
    "tema" TEXT NOT NULL,
    "porcentaje" DOUBLE PRECISION NOT NULL,
    "nota" DOUBLE PRECISION NOT NULL,
    "nivelAntes" "NivelDificultad" NOT NULL,
    "nivelDespues" "NivelDificultad" NOT NULL,
    "dificultadEvaluacion" "NivelDificultad" NOT NULL,
    "cantidadPreguntas" INTEGER NOT NULL,
    "respuestasCorrectas" INTEGER NOT NULL,
    "respuestasIncorrectas" INTEGER NOT NULL,
    "fecha" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "estudianteId" INTEGER NOT NULL,
    "asignacionCursoId" INTEGER NOT NULL,
    "temaCurricularId" INTEGER,
    "subtemaCurricularId" INTEGER,
    "evaluacionId" INTEGER NOT NULL,
    "intentoId" INTEGER NOT NULL,
    CONSTRAINT "HistorialProgreso_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "HistorialProgreso_intentoId_tema_key"
ON "HistorialProgreso"("intentoId", "tema");
CREATE INDEX "HistorialProgreso_estudianteId_asignacionCursoId_tema_fecha_idx"
ON "HistorialProgreso"("estudianteId", "asignacionCursoId", "tema", "fecha");
CREATE INDEX "HistorialProgreso_evaluacionId_idx"
ON "HistorialProgreso"("evaluacionId");
CREATE INDEX "HistorialProgreso_temaCurricularId_fecha_idx"
ON "HistorialProgreso"("temaCurricularId", "fecha");
CREATE INDEX "ProgresoEstudiante_asignacionCursoId_estudianteId_idx"
ON "ProgresoEstudiante"("asignacionCursoId", "estudianteId");
CREATE INDEX "ProgresoEstudiante_temaCurricularId_idx"
ON "ProgresoEstudiante"("temaCurricularId");

ALTER TABLE "ProgresoEstudiante" ADD CONSTRAINT "ProgresoEstudiante_asignacionCursoId_fkey"
FOREIGN KEY ("asignacionCursoId") REFERENCES "AsignacionCurso"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ProgresoEstudiante" ADD CONSTRAINT "ProgresoEstudiante_temaCurricularId_fkey"
FOREIGN KEY ("temaCurricularId") REFERENCES "TemaCurricular"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "HistorialProgreso" ADD CONSTRAINT "HistorialProgreso_estudianteId_fkey"
FOREIGN KEY ("estudianteId") REFERENCES "Usuario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "HistorialProgreso" ADD CONSTRAINT "HistorialProgreso_asignacionCursoId_fkey"
FOREIGN KEY ("asignacionCursoId") REFERENCES "AsignacionCurso"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "HistorialProgreso" ADD CONSTRAINT "HistorialProgreso_temaCurricularId_fkey"
FOREIGN KEY ("temaCurricularId") REFERENCES "TemaCurricular"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "HistorialProgreso" ADD CONSTRAINT "HistorialProgreso_subtemaCurricularId_fkey"
FOREIGN KEY ("subtemaCurricularId") REFERENCES "SubtemaCurricular"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "HistorialProgreso" ADD CONSTRAINT "HistorialProgreso_evaluacionId_fkey"
FOREIGN KEY ("evaluacionId") REFERENCES "Evaluacion"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "HistorialProgreso" ADD CONSTRAINT "HistorialProgreso_intentoId_fkey"
FOREIGN KEY ("intentoId") REFERENCES "IntentoEvaluacion"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Reconstruye el historial de intentos ya finalizados para no iniciar la serie
-- temporal en cero al desplegar esta versión.
WITH resultados AS (
  SELECT
    i."id" AS "intentoId",
    i."estudianteId",
    e."id" AS "evaluacionId",
    c."asignacionCursoId",
    e."temaCurricularId",
    e."subtemaCurricularId",
    e."nivelDificultad" AS "dificultadEvaluacion",
    q."tema",
    COALESCE(i."fechaFin", i."fechaInicio") AS "fecha",
    COUNT(DISTINCT r."preguntaId")::INTEGER AS "cantidadPreguntas",
    (COUNT(DISTINCT r."preguntaId") FILTER (WHERE r."esCorrecta" = true))::INTEGER AS "respuestasCorrectas"
  FROM "IntentoEvaluacion" i
  JOIN "Evaluacion" e ON e."id" = i."evaluacionId"
  JOIN "Curso" c ON c."id" = e."cursoId"
  JOIN "RespuestaEstudiante" r ON r."intentoId" = i."id"
  JOIN "Pregunta" q ON q."id" = r."preguntaId"
  WHERE i."estado" = 'FINALIZADO'
    AND e."esPracticaAdaptativa" = false
    AND c."asignacionCursoId" IS NOT NULL
  GROUP BY i."id", i."estudianteId", e."id", c."asignacionCursoId",
    e."temaCurricularId", e."subtemaCurricularId", e."nivelDificultad",
    q."tema", i."fechaFin", i."fechaInicio"
), acumulados AS (
  SELECT resultados.*,
    SUM("cantidadPreguntas") OVER (
      PARTITION BY "estudianteId", "asignacionCursoId", "tema"
      ORDER BY "fecha", "intentoId" ROWS UNBOUNDED PRECEDING
    ) AS "preguntasAcumuladas",
    SUM("respuestasCorrectas") OVER (
      PARTITION BY "estudianteId", "asignacionCursoId", "tema"
      ORDER BY "fecha", "intentoId" ROWS UNBOUNDED PRECEDING
    ) AS "correctasAcumuladas"
  FROM resultados
), niveles AS (
  SELECT acumulados.*,
    (ROUND(("respuestasCorrectas" * 100.0 / NULLIF("cantidadPreguntas", 0))::numeric, 2))::double precision AS "porcentaje",
    (ROUND(("correctasAcumuladas" * 100.0 / NULLIF("preguntasAcumuladas", 0))::numeric, 2))::double precision AS "porcentajeAcumulado",
    CASE
      WHEN ("correctasAcumuladas" * 100.0 / NULLIF("preguntasAcumuladas", 0)) < 55 THEN 'BASICO'::"NivelDificultad"
      WHEN ("correctasAcumuladas" * 100.0 / NULLIF("preguntasAcumuladas", 0)) <= 80 THEN 'INTERMEDIO'::"NivelDificultad"
      ELSE 'AVANZADO'::"NivelDificultad"
    END AS "nivelDespues"
  FROM acumulados
), transiciones AS (
  SELECT niveles.*,
    LAG("nivelDespues", 1, 'BASICO'::"NivelDificultad") OVER (
      PARTITION BY "estudianteId", "asignacionCursoId", "tema"
      ORDER BY "fecha", "intentoId"
    ) AS "nivelAntes"
  FROM niveles
)
INSERT INTO "HistorialProgreso" (
  "tema", "porcentaje", "nota", "nivelAntes", "nivelDespues",
  "dificultadEvaluacion", "cantidadPreguntas", "respuestasCorrectas",
  "respuestasIncorrectas", "fecha", "estudianteId", "asignacionCursoId",
  "temaCurricularId", "subtemaCurricularId", "evaluacionId", "intentoId"
)
SELECT
  "tema", "porcentaje",
  (ROUND(("porcentaje" / 5.0)::numeric, 1))::double precision,
  "nivelAntes", "nivelDespues", "dificultadEvaluacion",
  "cantidadPreguntas", "respuestasCorrectas",
  "cantidadPreguntas" - "respuestasCorrectas", "fecha", "estudianteId",
  "asignacionCursoId", "temaCurricularId", "subtemaCurricularId",
  "evaluacionId", "intentoId"
FROM transiciones
ON CONFLICT ("intentoId", "tema") DO NOTHING;

-- Reconstruye el resumen acumulado con el historial disponible.
WITH acumulado AS (
  SELECT
    h."estudianteId", h."asignacionCursoId", h."tema",
    MAX(h."temaCurricularId") AS "temaCurricularId",
    SUM(h."cantidadPreguntas") AS "preguntas",
    SUM(h."respuestasCorrectas") AS "correctas",
    COUNT(*)::INTEGER AS "cantidadEvaluaciones",
    MAX(h."fecha") AS "ultimaActualizacion"
  FROM "HistorialProgreso" h
  GROUP BY h."estudianteId", h."asignacionCursoId", h."tema"
), resumen AS (
  SELECT acumulado.*, c."id" AS "cursoId",
    (ROUND(("correctas" * 100.0 / NULLIF("preguntas", 0))::numeric, 2))::double precision AS "porcentajeDominio"
  FROM acumulado
  JOIN "Curso" c ON c."asignacionCursoId" = acumulado."asignacionCursoId"
)
INSERT INTO "ProgresoEstudiante" (
  "tema", "nivelActual", "porcentajeDominio", "cantidadEvaluaciones",
  "recomendaciones", "ultimaActualizacion", "estudianteId", "cursoId",
  "asignacionCursoId", "temaCurricularId"
)
SELECT
  "tema",
  CASE
    WHEN "porcentajeDominio" < 55 THEN 'BASICO'::"NivelDificultad"
    WHEN "porcentajeDominio" <= 80 THEN 'INTERMEDIO'::"NivelDificultad"
    ELSE 'AVANZADO'::"NivelDificultad"
  END,
  "porcentajeDominio", "cantidadEvaluaciones", NULL,
  "ultimaActualizacion", "estudianteId", "cursoId", "asignacionCursoId",
  "temaCurricularId"
FROM resumen
ON CONFLICT ("estudianteId", "cursoId", "tema") DO UPDATE SET
  "nivelActual" = EXCLUDED."nivelActual",
  "porcentajeDominio" = EXCLUDED."porcentajeDominio",
  "cantidadEvaluaciones" = EXCLUDED."cantidadEvaluaciones",
  "ultimaActualizacion" = EXCLUDED."ultimaActualizacion",
  "asignacionCursoId" = EXCLUDED."asignacionCursoId",
  "temaCurricularId" = EXCLUDED."temaCurricularId";
