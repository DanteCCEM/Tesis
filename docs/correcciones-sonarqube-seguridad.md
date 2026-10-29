# Correcciones de seguridad de SonarQube

## Alcance

- `frontend/src/routes/pages/docente/PlanCurricularCurso.jsx`
- `backend/Dockerfile`

## Cambios

El identificador temporal de unidades, temas y subtemas del editor curricular
usaba `Math.random()`. No interviene en autenticación, autorización, sesiones,
tokens ni nombres de archivos: únicamente se utiliza como clave local de React
antes de persistir la estructura. Se reemplazó por `crypto.randomUUID()`, una
API criptográficamente segura disponible en los navegadores compatibles con la
aplicación. El formato continúa con el prefijo `tmp-`, por lo que no cambia el
contrato interno del componente.

La imagen del backend ahora crea el usuario y grupo de sistema `evaluaia` y lo
selecciona con `USER evaluaia`. Después de instalar dependencias y generar el
cliente de Prisma, deja `/app` bajo propiedad de ese usuario y crea
`/app/uploads/planes-curriculares` con permisos de escritura. Así continúan
funcionando las migraciones de Prisma, Express y Multer (incluida la creación
de carpetas por curso), sin ejecutar la API como `root`.

## Verificaciones ejecutadas

- `npm.cmd run build` en `frontend`: correcto.
- Pruebas unitarias del backend: 45 correctas.
- `docker compose -f docker-compose.test.yml up --build --abort-on-container-exit
  --exit-code-from backend-test`: las 45 unitarias y las 20 pruebas de
  integración finalizaron correctamente en PostgreSQL aislado.
- Imagen de producción construida correctamente. En ella, `id` confirmó la
  ejecución como `uid=100(evaluaia)`, el directorio de uploads es escribible y
  `npx prisma --version` cargó Prisma Client 7.8.0 correctamente.

`npm.cmd run lint` no finaliza correctamente por dos reglas preexistentes de
`react-hooks/set-state-in-effect`: una en `CrearEvaluacion.jsx:293` y otra en
`PlanCurricularCurso.jsx:162`. Ninguna procede del cambio de `uid`; la
compilación del componente sí fue verificada con éxito.
