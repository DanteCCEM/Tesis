ALTER TABLE "IntentoEvaluacion"
ADD COLUMN "nota" DOUBLE PRECISION NOT NULL DEFAULT 0,
ADD COLUMN "nivelAlRendir" "NivelDificultad",
ADD COLUMN "dificultadVariante" "NivelDificultad",
ADD COLUMN "cantidadPreguntas" INTEGER,
ADD COLUMN "especificacionAdaptativa" JSONB,
ADD COLUMN "preguntasAsignadas" JSONB;

-- Completa metadatos de intentos históricos. Las variantes anteriores se
-- consideran comunes porque aún no existía selección adaptativa persistida.
UPDATE "IntentoEvaluacion" AS i
SET "nota" = ROUND((i."porcentaje" / 5.0)::numeric, 1)::double precision,
    "nivelAlRendir" = COALESCE(
      (
        SELECT h."nivelAntes"
        FROM "HistorialProgreso" h
        WHERE h."intentoId" = i."id"
        ORDER BY h."id" ASC
        LIMIT 1
      ),
      'BASICO'::"NivelDificultad"
    ),
    "dificultadVariante" = e."nivelDificultad",
    "cantidadPreguntas" = (
      SELECT COUNT(*)::INTEGER FROM "Pregunta" p WHERE p."evaluacionId" = e."id"
    ),
    "preguntasAsignadas" = (
      SELECT COALESCE(jsonb_agg(p."id" ORDER BY p."id"), '[]'::jsonb)
      FROM "Pregunta" p WHERE p."evaluacionId" = e."id"
    ),
    "especificacionAdaptativa" = jsonb_build_object(
      'version', 1,
      'adaptativa', false,
      'migrado', true
    )
FROM "Evaluacion" e
WHERE e."id" = i."evaluacionId";

-- Completa solo evaluaciones sin configuración. Las configuraciones v1 se
-- conservan para no perder cantidades personalizadas; el normalizador del
-- dominio las interpreta y las convierte a v2 al editar/usar la evaluación.
UPDATE "Evaluacion"
SET "configuracionAdaptativa" = jsonb_build_object(
  'version', 2,
  'criterios', COALESCE("configuracionAdaptativa"->>'criterios', 'Nivel actual del estudiante por tema'),
  'porNivel', jsonb_build_object(
    'BASICO', jsonb_build_object(
      'cantidadPreguntas', 10,
      'distribucion', jsonb_build_object('BASICO', 7, 'INTERMEDIO', 3, 'AVANZADO', 0)
    ),
    'INTERMEDIO', jsonb_build_object(
      'cantidadPreguntas', 7,
      'distribucion', jsonb_build_object('BASICO', 2, 'INTERMEDIO', 4, 'AVANZADO', 1)
    ),
    'AVANZADO', jsonb_build_object(
      'cantidadPreguntas', 5,
      'distribucion', jsonb_build_object('BASICO', 0, 'INTERMEDIO', 1, 'AVANZADO', 4)
    )
  ),
  'transicion', jsonb_build_object(
    'evaluacionesRecientes', 1,
    'maxCambioNiveles', 1
  )
)
WHERE "tipoEvaluacion" = 'FORMATIVA_ADAPTATIVA'
  AND "configuracionAdaptativa" IS NULL;
