-- Elimina intentos duplicados conservando el más relevante por estudiante/evaluación.
WITH ranked AS (
  SELECT
    id,
    ROW_NUMBER() OVER (
      PARTITION BY "estudianteId", "evaluacionId"
      ORDER BY
        CASE WHEN estado = 'FINALIZADO' THEN 0 ELSE 1 END,
        "fechaFin" DESC NULLS LAST,
        id DESC
    ) AS rn
  FROM "IntentoEvaluacion"
)
DELETE FROM "IntentoEvaluacion"
WHERE id IN (SELECT id FROM ranked WHERE rn > 1);

-- CreateIndex
CREATE UNIQUE INDEX "IntentoEvaluacion_estudianteId_evaluacionId_key"
ON "IntentoEvaluacion"("estudianteId", "evaluacionId");
