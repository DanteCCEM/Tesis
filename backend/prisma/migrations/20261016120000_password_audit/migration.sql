CREATE TABLE "Auditoria" (
    "id" SERIAL NOT NULL,
    "usuarioActorId" INTEGER NOT NULL,
    "usuarioObjetivoId" INTEGER,
    "accion" TEXT NOT NULL,
    "datos" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Auditoria_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "Auditoria_usuarioActorId_createdAt_idx"
ON "Auditoria"("usuarioActorId", "createdAt");

CREATE INDEX "Auditoria_usuarioObjetivoId_createdAt_idx"
ON "Auditoria"("usuarioObjetivoId", "createdAt");

CREATE INDEX "Auditoria_accion_createdAt_idx"
ON "Auditoria"("accion", "createdAt");

ALTER TABLE "Auditoria"
ADD CONSTRAINT "Auditoria_usuarioActorId_fkey"
FOREIGN KEY ("usuarioActorId") REFERENCES "Usuario"("id")
ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "Auditoria"
ADD CONSTRAINT "Auditoria_usuarioObjetivoId_fkey"
FOREIGN KEY ("usuarioObjetivoId") REFERENCES "Usuario"("id")
ON DELETE SET NULL ON UPDATE CASCADE;
