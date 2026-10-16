-- Etapa de convivencia: se crean las entidades institucionales y se conserva
-- Curso/Matricula. El vínculo con Curso es opcional para no alterar datos existentes.
CREATE TYPE "EstadoAnioAcademico" AS ENUM ('ACTIVO', 'CERRADO');
CREATE TYPE "EstadoRegistroAcademico" AS ENUM ('ACTIVO', 'INACTIVO');

CREATE TABLE "AnioAcademico" (
    "id" SERIAL NOT NULL,
    "anio" INTEGER NOT NULL,
    "estado" "EstadoAnioAcademico" NOT NULL DEFAULT 'ACTIVO',
    "fechaInicio" TIMESTAMP(3),
    "fechaFin" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "AnioAcademico_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Grado" (
    "id" SERIAL NOT NULL,
    "nombre" TEXT NOT NULL,
    "orden" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Grado_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Seccion" (
    "id" SERIAL NOT NULL,
    "gradoId" INTEGER NOT NULL,
    "nombre" TEXT NOT NULL,
    "estado" "EstadoRegistroAcademico" NOT NULL DEFAULT 'ACTIVO',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Seccion_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "AreaCurricular" (
    "id" SERIAL NOT NULL,
    "nombre" TEXT NOT NULL,
    "descripcion" TEXT,
    "estado" "EstadoRegistroAcademico" NOT NULL DEFAULT 'ACTIVO',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "AreaCurricular_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "PerfilDocente" (
    "id" SERIAL NOT NULL,
    "usuarioId" INTEGER NOT NULL,
    "dni" TEXT NOT NULL,
    "nombres" TEXT NOT NULL,
    "apellidoPaterno" TEXT NOT NULL,
    "apellidoMaterno" TEXT NOT NULL,
    "telefono" TEXT,
    "especialidad" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "PerfilDocente_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "PerfilEstudiante" (
    "id" SERIAL NOT NULL,
    "usuarioId" INTEGER NOT NULL,
    "codigoEstudiante" TEXT,
    "dni" TEXT NOT NULL,
    "nombres" TEXT NOT NULL,
    "apellidoPaterno" TEXT NOT NULL,
    "apellidoMaterno" TEXT NOT NULL,
    "telefono" TEXT,
    "fechaNacimiento" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "PerfilEstudiante_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "AsignacionCurso" (
    "id" SERIAL NOT NULL,
    "areaCurricularId" INTEGER NOT NULL,
    "seccionId" INTEGER NOT NULL,
    "docenteId" INTEGER NOT NULL,
    "anioAcademicoId" INTEGER NOT NULL,
    "estado" "EstadoRegistroAcademico" NOT NULL DEFAULT 'ACTIVO',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "AsignacionCurso_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "MatriculaAcademica" (
    "id" SERIAL NOT NULL,
    "estudianteId" INTEGER NOT NULL,
    "seccionId" INTEGER NOT NULL,
    "anioAcademicoId" INTEGER NOT NULL,
    "estado" "EstadoRegistroAcademico" NOT NULL DEFAULT 'ACTIVO',
    "fechaMatricula" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "MatriculaAcademica_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "Curso" ADD COLUMN "asignacionCursoId" INTEGER;

CREATE UNIQUE INDEX "AnioAcademico_anio_key" ON "AnioAcademico"("anio");
CREATE UNIQUE INDEX "Grado_nombre_key" ON "Grado"("nombre");
CREATE INDEX "Grado_orden_idx" ON "Grado"("orden");
CREATE UNIQUE INDEX "Seccion_gradoId_nombre_key" ON "Seccion"("gradoId", "nombre");
CREATE UNIQUE INDEX "AreaCurricular_nombre_key" ON "AreaCurricular"("nombre");
CREATE UNIQUE INDEX "PerfilDocente_usuarioId_key" ON "PerfilDocente"("usuarioId");
CREATE UNIQUE INDEX "PerfilDocente_dni_key" ON "PerfilDocente"("dni");
CREATE UNIQUE INDEX "PerfilEstudiante_usuarioId_key" ON "PerfilEstudiante"("usuarioId");
CREATE UNIQUE INDEX "PerfilEstudiante_codigoEstudiante_key" ON "PerfilEstudiante"("codigoEstudiante");
CREATE UNIQUE INDEX "PerfilEstudiante_dni_key" ON "PerfilEstudiante"("dni");
CREATE UNIQUE INDEX "AsignacionCurso_areaCurricularId_seccionId_anioAcademicoId_key"
ON "AsignacionCurso"("areaCurricularId", "seccionId", "anioAcademicoId");
CREATE INDEX "AsignacionCurso_docenteId_anioAcademicoId_idx"
ON "AsignacionCurso"("docenteId", "anioAcademicoId");
CREATE UNIQUE INDEX "MatriculaAcademica_estudianteId_anioAcademicoId_key"
ON "MatriculaAcademica"("estudianteId", "anioAcademicoId");
CREATE INDEX "MatriculaAcademica_seccionId_anioAcademicoId_idx"
ON "MatriculaAcademica"("seccionId", "anioAcademicoId");
CREATE UNIQUE INDEX "Curso_asignacionCursoId_key" ON "Curso"("asignacionCursoId");

ALTER TABLE "Seccion" ADD CONSTRAINT "Seccion_gradoId_fkey"
FOREIGN KEY ("gradoId") REFERENCES "Grado"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "PerfilDocente" ADD CONSTRAINT "PerfilDocente_usuarioId_fkey"
FOREIGN KEY ("usuarioId") REFERENCES "Usuario"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PerfilEstudiante" ADD CONSTRAINT "PerfilEstudiante_usuarioId_fkey"
FOREIGN KEY ("usuarioId") REFERENCES "Usuario"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AsignacionCurso" ADD CONSTRAINT "AsignacionCurso_areaCurricularId_fkey"
FOREIGN KEY ("areaCurricularId") REFERENCES "AreaCurricular"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "AsignacionCurso" ADD CONSTRAINT "AsignacionCurso_seccionId_fkey"
FOREIGN KEY ("seccionId") REFERENCES "Seccion"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "AsignacionCurso" ADD CONSTRAINT "AsignacionCurso_docenteId_fkey"
FOREIGN KEY ("docenteId") REFERENCES "Usuario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "AsignacionCurso" ADD CONSTRAINT "AsignacionCurso_anioAcademicoId_fkey"
FOREIGN KEY ("anioAcademicoId") REFERENCES "AnioAcademico"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "MatriculaAcademica" ADD CONSTRAINT "MatriculaAcademica_estudianteId_fkey"
FOREIGN KEY ("estudianteId") REFERENCES "Usuario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "MatriculaAcademica" ADD CONSTRAINT "MatriculaAcademica_seccionId_fkey"
FOREIGN KEY ("seccionId") REFERENCES "Seccion"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "MatriculaAcademica" ADD CONSTRAINT "MatriculaAcademica_anioAcademicoId_fkey"
FOREIGN KEY ("anioAcademicoId") REFERENCES "AnioAcademico"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Curso" ADD CONSTRAINT "Curso_asignacionCursoId_fkey"
FOREIGN KEY ("asignacionCursoId") REFERENCES "AsignacionCurso"("id") ON DELETE SET NULL ON UPDATE CASCADE;
