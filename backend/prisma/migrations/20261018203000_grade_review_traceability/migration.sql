ALTER TABLE "IntentoEvaluacion"
ADD COLUMN "puntajeAutomatico" DOUBLE PRECISION NOT NULL DEFAULT 0,
ADD COLUMN "porcentajeAutomatico" DOUBLE PRECISION NOT NULL DEFAULT 0,
ADD COLUMN "notaAutomatica" DOUBLE PRECISION NOT NULL DEFAULT 0,
ADD COLUMN "notaFinal" DOUBLE PRECISION NOT NULL DEFAULT 0,
ADD COLUMN "modificadaPorDocente" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN "docenteIdModificacion" INTEGER,
ADD COLUMN "motivoModificacion" TEXT,
ADD COLUMN "fechaModificacion" TIMESTAMP(3);

UPDATE "IntentoEvaluacion"
SET "puntajeAutomatico" = "puntajeTotal",
    "porcentajeAutomatico" = "porcentaje",
    "notaAutomatica" = "nota",
    "notaFinal" = "nota";

ALTER TABLE "IntentoEvaluacion"
ADD CONSTRAINT "IntentoEvaluacion_docenteIdModificacion_fkey"
FOREIGN KEY ("docenteIdModificacion") REFERENCES "Usuario"("id") ON DELETE SET NULL ON UPDATE CASCADE;
