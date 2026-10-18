-- Conserva la respuesta más reciente si una carrera histórica produjo duplicados.
DELETE FROM "RespuestaEstudiante" anterior
USING "RespuestaEstudiante" reciente
WHERE anterior."intentoId" = reciente."intentoId"
  AND anterior."preguntaId" = reciente."preguntaId"
  AND anterior."id" < reciente."id";

CREATE UNIQUE INDEX "RespuestaEstudiante_intentoId_preguntaId_key"
ON "RespuestaEstudiante"("intentoId", "preguntaId");
