# Migración de la estructura académica institucional

## Modelo de convivencia

La primera etapa agrega `AnioAcademico`, `Grado`, `Seccion`, `AreaCurricular`,
`PerfilDocente`, `PerfilEstudiante`, `AsignacionCurso` y
`MatriculaAcademica`. No elimina ni modifica las relaciones obligatorias de
`Curso` y `Matricula`.

`Curso.asignacionCursoId` es nullable y unique. Una asignación institucional
puede vincularse con un único curso legado, mientras los cursos existentes
pueden permanecer sin vínculo. `Evaluacion`, `PlanCurricular`,
`ProgresoEstudiante` y `PracticaAdaptativa` continúan relacionados con
`Curso.id` durante esta etapa.

## Relaciones institucionales

- Un `Grado` contiene varias secciones.
- Una sección no puede repetir nombre dentro del mismo grado.
- Una `AsignacionCurso` une área, sección, docente y año académico.
- Solo puede existir una asignación para la misma área, sección y año.
- Una `MatriculaAcademica` ubica al estudiante en una sección y año.
- Un estudiante solo puede tener una matrícula académica por año.
- Los perfiles académico-personales tienen una relación uno a uno con
  `Usuario`.

`docenteId` y `estudianteId` apuntan a `Usuario`. Cuando se implementen los
endpoints de asignaciones y matrículas deberán validar respectivamente los
roles `DOCENTE` y `ESTUDIANTE`, además de exigir sus perfiles.

## Deuda de migración

1. Crear el catálogo institucional y los perfiles de los usuarios existentes.
2. Crear asignaciones a partir de cada combinación actual de `Curso.nombre`,
   `Curso.grado`, `Curso.seccion` y `Curso.docenteId`.
3. Completar `Curso.asignacionCursoId` después de resolver años o secciones
   ambiguos. No se automatiza porque el modelo anterior no almacena el año
   académico.
4. Crear `MatriculaAcademica` desde las matrículas actuales una vez conocido el
   año y la sección institucional de cada curso.
5. Adaptar las consultas del estudiante para derivar cursos desde su matrícula
   académica y las asignaciones de la sección.
6. Adaptar las consultas del docente para usar `AsignacionCurso.docenteId`.
7. Solo después de verificar equivalencia de datos se podrá retirar la creación
   libre de cursos, la matrícula por curso y los campos de texto `grado` y
   `seccion`.

La migración actual no intenta inferir el año académico ni fusionar cursos, por
lo que no borra ni transforma datos históricos.

## Aplicación

Con PostgreSQL disponible y `DATABASE_URL` configurado en el entorno del
backend:

```bash
npx prisma migrate deploy
npx prisma generate
```

## API administrativa de esta etapa

Todos los endpoints requieren una sesión `ADMIN`:

- `/api/admin/anios-academicos`
- `/api/admin/grados`
- `/api/admin/secciones`
- `/api/admin/areas-curriculares`

Cada recurso admite `GET` y `POST` en la colección, y `GET`, `PUT` y `DELETE`
en `/:id`. Las secciones pueden filtrarse con `?gradoId=<id>`. Las eliminaciones
con dependencias se rechazan con `409` para conservar la integridad académica.

Los endpoints de perfiles, asignaciones y matrículas académicas se incorporarán
en la etapa que migre los datos legados; exponerlos antes permitiría crear una
estructura paralela que todavía no alimentaría las pantallas actuales.
