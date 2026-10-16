# Gestión institucional de cursos y estudiantes

## Resolución académica

`MatriculaAcademica` determina la sección de un estudiante durante un año. `AsignacionCurso` determina el área curricular y el docente de esa misma sección y año. El modelo `Curso` se conserva como enlace de compatibilidad para evaluaciones, planes curriculares, intentos, progreso y prácticas adaptativas mediante `Curso.asignacionCursoId`.

La autorización usa siempre esta cadena:

1. Se obtiene el `Curso` y su `AsignacionCurso`.
2. Para un docente, se exige que `AsignacionCurso.docenteId` sea su usuario.
3. Para un estudiante, se exige una `MatriculaAcademica` activa con el mismo `seccionId` y `anioAcademicoId`.
4. Los estudiantes de la vista docente se consultan desde la sección y año de la asignación.

Los DTO son distintos. El detalle docente incluye la lista académica de su sección. El DTO del estudiante contiene únicamente el curso, sección, año, docente y conteos propios del curso; no incluye compañeros, usernames ni correos.

## Endpoints ADMIN

- `GET /api/admin/asignaciones`
- `POST /api/admin/asignaciones`
- `PUT /api/admin/asignaciones/:id`
- `GET /api/admin/estudiantes-importacion/plantilla`
- `POST /api/admin/estudiantes-importacion`

La importación recibe multipart con `archivo`, `anioAcademicoId` y `seccionId`. La plantilla no transporta contraseñas. El backend genera y cifra una contraseña temporal por cuenta, y solo devuelve las credenciales una vez.

## Endpoints retirados

- `POST /api/cursos`
- `POST /api/cursos/:id/matriculas`
- `DELETE /api/cursos/:id/matriculas/:estudianteId`
- `GET /api/cursos/:id/estudiantes/plantilla`
- `POST /api/cursos/:id/estudiantes/importar`
- `/api/matriculas`

## Compatibilidad y migración pendiente

Las asignaciones creadas por el nuevo servicio generan su `Curso` de compatibilidad en la misma transacción. Los cursos históricos que todavía no tengan `asignacionCursoId` quedan inaccesibles por el flujo institucional hasta que se vinculen a un área, sección, docente y año. No se eliminan ni se transforman automáticamente porque una inferencia equivocada podría asociar historial académico a otra sección.
