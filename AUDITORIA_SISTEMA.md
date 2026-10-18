# Auditoría integral del sistema EvaluaIA

Fecha de revisión: 18 de octubre de 2026  
Repositorio revisado: estado local de `C:\Users\Baguette\Documents\Proyectos\Tesis`

## 1. Resumen ejecutivo

EvaluaIA tiene un núcleo backend considerablemente avanzado: autenticación local,
estructura académica, tipos formales de evaluación, variantes adaptativas,
historial por tema, trazabilidad de calificaciones, estados de evaluación y
permisos por rol. El motor adaptativo está separado de Gemini y sus reglas se
encuentran centralizadas y probadas.

El sistema no debe considerarse todavía listo para uso institucional o para una
recolección definitiva de datos de tesis. Persisten riesgos de integridad
pedagógica, conservación de evidencia, seguridad operativa y funcionalidades de
interfaz incompletas. En particular:

1. Las prácticas adaptativas sustituyen fallos de Gemini con preguntas genéricas
   y luego las almacenan como evaluaciones válidas.
2. La interfaz marca preguntas IA como revisadas simplemente al guardarlas, sin
   una acción explícita de aprobación docente.
3. Varias relaciones Prisma conservan borrado en cascada hacia intentos y
   respuestas; el servicio evita algunos borrados, pero la base no protege por sí
   sola la evidencia académica.
4. No existen límites de intentos de login ni cuotas/rate limiting para endpoints
   de Gemini.
5. La configuración Docker admite secretos y credenciales por defecto inseguros.
6. La administración de estructura, calificaciones y auditoría está incompleta en
   frontend, aunque parte del backend sí existe.
7. El frontend compila, pero su lint falla y no dispone de pruebas automatizadas.

Conclusión: **apto como prototipo avanzado de tesis; no apto todavía para
producción ni para evidencia académica definitiva sin ejecutar el plan P0/P1**.

## 2. Alcance y método

Se inspeccionaron:

- Código React/Vite del frontend.
- API Express, servicios, validadores y middlewares del backend.
- Esquema Prisma y las 17 migraciones presentes.
- Dockerfiles, Compose de desarrollo y Compose de pruebas.
- Pruebas unitarias e integrales existentes.
- Estado y logs de los contenedores que ya estaban levantados.
- Dependencias mediante `npm audit` en imágenes aisladas.

No se ejecutaron seeds ni el script de verificación funcional que utiliza cuentas
reales. Tampoco se llamó a Gemini, para no consumir cuota ni transmitir datos. Por
ello, la disponibilidad real del modelo configurado y la validez de la clave no
se consideran verificadas.

### Incidencia durante la auditoría

Al intentar ejecutar `prisma migrate status` contra la base activa mediante la
imagen de producción, el `ENTRYPOINT` de
[`backend/scripts/docker-entrypoint.sh`](backend/scripts/docker-entrypoint.sh)
ejecutó primero `prisma migrate deploy`. Como consecuencia, se aplicó la migración
pendiente `20261018223000_unique_respuesta_intento_pregunta`.

- No se ejecutaron seeds.
- La migración elimina duplicados de respuesta conservando el registro más
  reciente y crea el índice único `(intentoId, preguntaId)`.
- No se intentó revertirla, porque eliminar el índice o reconstruir duplicados
  habría supuesto un riesgo adicional.
- Esta fue la única modificación accidental sobre la base activa durante la
  auditoría.

El entrypoint debería distinguir entre inicio normal y comandos administrativos
de solo lectura para evitar este comportamiento.

## 3. Resultado de verificaciones ejecutadas

| Verificación | Resultado | Evidencia / observación |
|---|---:|---|
| Configuración `docker compose` | Correcta | `docker compose config --quiet` terminó con código 0. |
| Contenedores existentes | Operativos | PostgreSQL saludable; backend y frontend activos. |
| Salud del backend | Correcta | `GET /api/health` devolvió HTTP 200 y `ok: true`. |
| Servicio frontend existente | Correcto | `GET http://localhost:8080` devolvió HTTP 200. |
| Build Docker backend desde código actual | Correcto | Imagen construida y Prisma Client generado. |
| Build Docker frontend desde código actual | Correcto | Vite generó la imagen Nginx. |
| Esquema y migraciones en PostgreSQL efímero | Correcto | Las 17 migraciones se aplicaron desde cero. |
| Pruebas unitarias backend | **45/45 aprobadas** | `node:test`. |
| Pruebas integrales backend | **20/20 aprobadas** | Vitest + Supertest + PostgreSQL efímero. |
| Total backend | **65/65 aprobadas** | Sin fallos. |
| Lint frontend | **Falló** | 2 errores `react-hooks/set-state-in-effect`. |
| Pruebas frontend | No implementadas | No existe script ni archivos de test. |
| E2E Playwright | No implementado | No existe dependencia ni configuración. |
| Gemini real | No ejecutado | Se evitó consumo de API; modelo/clave no verificados. |
| Seed | No ejecutado | Evitado expresamente para no alterar datos. |
| `npm audit` backend producción | **14 vulnerabilidades** | 1 crítica, 5 altas, 8 moderadas. |
| `npm audit` frontend producción | **3 vulnerabilidades altas** | Axios y React Router, con actualización disponible. |

El build exitoso demuestra que las imágenes pueden construirse. Los servicios ya
levantados respondieron correctamente. No se hizo un `down`/`up` completo del
Compose de desarrollo, porque habría reiniciado servicios reales y aplicado
migraciones automáticamente.

## 4. Matriz de funcionalidades

Estados utilizados: **Implementada**, **Parcial**, **No implementada** y **No
verificada externamente**.

| Área | Estado | Evidencia y límites |
|---|---|---|
| Login por username y contraseña | Implementada | JWT, bcrypt, estado de cuenta y `sessionVersion`; probado por integración. |
| Cuenta bloqueada | Implementada | Rechazo 401 probado. |
| Cambio obligatorio de contraseña | Implementada | Middleware global y redirección frontend; probado. |
| Reset de contraseña por admin | Implementada | Invalida sesiones y crea auditoría; probado. |
| Logout/invalidez central | Parcial | Logout es local; invalidación real solo mediante incremento de `sessionVersion`. |
| Gestión de docentes y estudiantes | Implementada | CRUD, matrícula, reset, estado e importación Excel. |
| Estructura académica | Parcial | Backend CRUD implementado; pantalla frontend es placeholder. |
| Asignaciones docentes | Implementada | Backend y UI disponibles; propiedad y rol validados. |
| Matrícula única por año | Implementada | Restricción Prisma y prueba integral. |
| Evaluación diagnóstica común | Implementada | Tipo, variante común, inicio y actualización de progreso disponibles. |
| Evaluación final común | Implementada | Tipo común, no adaptación automática. |
| Formativa adaptativa | Implementada en núcleo | Tres variantes, selección por nivel y fijación en intento. |
| Práctica adaptativa individual | Parcial/riesgosa | Existe, pero usa fallback pedagógico simulado si Gemini falla. |
| Variante fijada al iniciar | Implementada | `varianteEvaluacionId` y `nivelAlRendir`; probado. |
| Estudiante sin elección de nivel | Implementada | La selección ocurre en backend. |
| Estado BORRADOR/PUBLICADA/CERRADA/ARCHIVADA | Implementada en backend | Reglas centralizadas; UI no ofrece gestión completa de cierre/archivo/edición. |
| Fecha límite | Implementada | Bloquea inicio vencido y permite continuar intentos ya iniciados. |
| Historial por estudiante y tema | Implementada | Entidad inmutable, resumen acumulado y endpoints por rol. |
| Niveles independientes por tema | Implementada | Probado con temas separados. |
| Motor 10/7/5 y distribución | Implementada | Configuración central y pruebas de límites. |
| Máximo cambio de un nivel | Implementada | Regla central y pruebas de subida/bajada. |
| Ventana de evidencias recientes | Preparada | Configurable y probada; valor por defecto 1. |
| Generación Gemini de tres variantes | Implementada, no verificada externamente | Prompt estructurado, generación secuencial, fallback de modelo configurable y validación parcial. |
| Validación estricta IA | Parcial | Cantidad, distribución, tipo, opciones, correcta y puntaje; no compara tema/subtema devueltos con los solicitados. |
| Revisión docente previa a publicación | Parcial | Backend bloquea preguntas IA no revisadas, pero frontend las envía ya revisadas al guardar. |
| Publicación automática por IA | No | La publicación requiere acción docente. |
| Fallback con banco validado | No implementada | No existe banco formal de preguntas validado. |
| Calificación automática | Implementada | Puntaje, porcentaje y nota preservados. |
| Revisión docente de nota | Implementada | Motivo, autor, fecha y auditoría `GRADE_CHANGED`. |
| Bloqueo de cambio en cerradas | Implementada | Servicio rechaza modificación en estado CERRADA. |
| Reporte docente por evaluación | Implementada | Analítica, variante, nivel y revisión de nota. |
| Seguimiento docente por tema | Implementada | Resumen por tema y perfil cronológico del estudiante. |
| Dashboard estudiante | Implementada | Nivel por tema, historial, fortalezas y refuerzo. |
| Dashboard admin académico | Parcial | Resumen global real; páginas de calificaciones/auditoría son placeholders. |
| Privacidad entre estudiantes | Implementada en rutas revisadas | Perfil ajeno rechazado y DTO sin compañeros; probado. |
| Auditoría consultable por admin | No implementada en UI/API general | Se escriben eventos, pero no hay listado administrativo completo. |
| Pruebas backend | Implementada | 65 pruebas aprobadas. |
| Pruebas frontend/E2E | No implementada | Sin Vitest de componentes ni Playwright. |

## 5. Hallazgos por severidad

### Críticos

#### C-01 — Prácticas IA inválidas sustituidas por contenido genérico

- Archivo: [`backend/src/services/practicasAdaptativas.service.js`](backend/src/services/practicasAdaptativas.service.js)
- Causa: `obtenerPreguntasPractica` captura cualquier fallo de Gemini y llama a
  `generarPreguntasPlantilla`, creando enunciados como “Selecciona la respuesta
  correcta sobre...”.
- Impacto: contenido sin validez pedagógica puede presentarse y calificarse como
  práctica real. Contamina resultados y contradice la política de no simular
  preguntas válidas ante un fallo de IA.
- Solución: eliminar ese fallback; devolver un error controlado o usar únicamente
  un banco versionado y revisado. Registrar fuente y versión de cada pregunta.

#### C-02 — Dependencia de producción con vulnerabilidad crítica

- Archivos: [`backend/package.json`](backend/package.json) y
  [`backend/package-lock.json`](backend/package-lock.json)
- Causa: `npm audit --omit=dev` reportó vulnerabilidad crítica transitiva en
  `proxy-addr`, además de otras 13 vulnerabilidades.
- Impacto: superficie de ataque conocida en el backend desplegado. El impacto
  exacto depende de la ruta de dependencia y configuración, pero no debe aceptarse
  sin análisis antes de producción.
- Solución: generar árbol de dependencia y actualizar versiones compatibles;
  ejecutar pruebas completas después. No usar `npm audit fix --force` sin revisión.

### Altos

#### A-01 — La “revisión docente” de contenido IA no es una aprobación explícita

- Archivos: [`frontend/src/routes/pages/docente/CrearEvaluacion.jsx`](frontend/src/routes/pages/docente/CrearEvaluacion.jsx),
  [`backend/src/services/evaluaciones.service.js`](backend/src/services/evaluaciones.service.js)
- Causa: `buildQuestionPayload` envía `revisadaPorDocente: true` para toda pregunta
  generada por IA al guardarla. No hay checkbox/acción individual o de variante que
  represente una revisión verificable.
- Impacto: una generación puede publicarse inmediatamente y quedar registrada como
  revisada, debilitando la trazabilidad exigida por la tesis.
- Solución: persistir primero como no revisada; implementar acción de aprobación
  por variante/pregunta y registrar fecha, docente y versión del contenido aprobado.

#### A-02 — Cascadas de base de datos pueden destruir evidencia académica

- Archivo: [`backend/prisma/schema.prisma`](backend/prisma/schema.prisma)
- Causa: `Evaluacion -> IntentoEvaluacion`, `Curso -> Evaluacion`,
  `IntentoEvaluacion -> RespuestaEstudiante` y otras relaciones relevantes usan
  `onDelete: Cascade`.
- Impacto: aunque el servicio archiva evaluaciones con intentos, una operación
  administrativa, script o acceso directo puede eliminar intentos y respuestas.
- Solución: usar `Restrict`/`NoAction` para evidencia académica, archivado lógico y
  pruebas de integridad en base de datos. Preparar migración con análisis previo.

#### A-03 — Sin rate limiting para autenticación ni consumo de Gemini

- Archivos: [`backend/src/routes/auth.routes.js`](backend/src/routes/auth.routes.js),
  [`backend/src/routes/ia.routes.js`](backend/src/routes/ia.routes.js)
- Causa: no existe middleware de rate limiting, bloqueo progresivo o cuota por
  usuario/asignación.
- Impacto: fuerza bruta de contraseñas, agotamiento de cuota, coste inesperado y
  denegación de servicio.
- Solución: límites diferenciados para login e IA, contadores por usuario/IP,
  cooldown, métricas y límites diarios configurables.

#### A-04 — Configuración Docker insegura por defecto

- Archivo: [`docker-compose.yml`](docker-compose.yml)
- Causa: JWT con fallback público `cambiar-este-secreto-en-produccion`, PostgreSQL
  `postgres/postgres` y puerto 5432 expuesto.
- Impacto: sesiones falsificables y acceso a base de datos si se despliega sin
  sustituir valores.
- Solución: hacer obligatorios los secretos (`${JWT_SECRET:?required}`), usar
  secrets de Docker, credenciales no predeterminadas y no publicar PostgreSQL en
  producción.

#### A-05 — Retroalimentación IA persiste datos suministrados por el cliente

- Archivos: [`backend/src/validators/ia.validator.js`](backend/src/validators/ia.validator.js),
  [`backend/src/services/ia.service.js`](backend/src/services/ia.service.js)
- Causa: tras validar propiedad del intento, el servicio usa porcentaje, temas,
  preguntas falladas y nivel enviados por el navegador, en vez de reconstruirlos
  desde el intento almacenado.
- Impacto: un estudiante puede generar y persistir retroalimentación falsa o
  inconsistente para un intento propio.
- Solución: recibir solo `intentoId`; derivar todo el contexto desde respuestas,
  evaluación, variante y progreso del servidor.

#### A-06 — La validación IA no exige coincidencia real de tema/subtema

- Archivo: [`backend/src/services/aiService.js`](backend/src/services/aiService.js)
- Causa: se comprueba que `tema` y `subtema` sean textos, pero no que coincidan con
  la especificación solicitada. La generación no adaptativa tampoco exige cantidad
  exacta: acepta menos elementos tras `slice` si el arreglo no está vacío.
- Impacto: preguntas fuera del currículo pueden superar validación y publicarse.
- Solución: normalizar y comparar tema/subtema, exigir cantidad exacta en todos los
  modos y validar tipos solicitados además de tipos globalmente permitidos.

#### A-07 — Archivos PDF no tienen persistencia Docker

- Archivos: [`backend/src/config/upload.js`](backend/src/config/upload.js),
  [`docker-compose.yml`](docker-compose.yml)
- Causa: los PDF se guardan en `uploads/planes-curriculares` dentro del contenedor,
  sin volumen persistente.
- Impacto: al recrear el backend se pierden archivos requeridos para reprocesar o
  auditar planes curriculares.
- Solución: volumen dedicado u object storage; checksum, retención y política de
  eliminación segura.

#### A-08 — Módulos administrativos visibles pero no implementados

- Archivo: [`frontend/src/routes/index.jsx`](frontend/src/routes/index.jsx)
- Causa: estructura académica, calificaciones, auditoría y configuración apuntan a
  `AdminPlaceholder`.
- Impacto: el flujo ADMIN prometido no puede completarse desde la aplicación.
- Solución: implementar las pantallas sobre los endpoints existentes y añadir el
  endpoint/listado de auditoría faltante.

#### A-09 — Desfase entre contenedor activo, código fuente y migraciones

- Archivos: [`backend/Dockerfile`](backend/Dockerfile),
  [`backend/scripts/docker-entrypoint.sh`](backend/scripts/docker-entrypoint.sh)
- Causa: al inicio de la auditoría el contenedor activo conocía 16 migraciones,
  mientras el repositorio contenía 17. El contenedor sigue ejecutando una imagen
  anterior hasta que sea reconstruido.
- Impacto: la base ya tiene la unicidad nueva, pero el proceso activo anterior puede
  seguir usando el patrón no atómico `find/create`, provocando conflictos de
  concurrencia hasta reconstruirlo.
- Solución: despliegue versionado y atómico; comprobar hash de imagen, migraciones y
  versión de aplicación en healthcheck. Reconstruir en una ventana controlada.

### Medios

#### M-01 — Frontend sin pruebas y con lint fallido

- Archivos: [`frontend/src/routes/pages/docente/CrearEvaluacion.jsx`](frontend/src/routes/pages/docente/CrearEvaluacion.jsx),
  [`frontend/src/routes/pages/docente/PlanCurricularCurso.jsx`](frontend/src/routes/pages/docente/PlanCurricularCurso.jsx)
- Causa: dos infracciones `react-hooks/set-state-in-effect`; no hay Vitest ni
  Playwright.
- Impacto: regresiones de flujo no detectadas, especialmente en creación y plan
  curricular.
- Solución: corregir efectos, añadir pruebas de componentes y E2E con Gemini
  simulado.

#### M-02 — Conteo de estudiantes incorrecto en dashboard docente

- Archivos: [`backend/src/services/cursos.service.js`](backend/src/services/cursos.service.js),
  [`frontend/src/routes/pages/docente/Dashboard.jsx`](frontend/src/routes/pages/docente/Dashboard.jsx)
- Causa: backend entrega `cantidadEstudiantes`; frontend suma
  `course._count.matriculas`.
- Impacto: dashboard muestra cero o un dato incorrecto.
- Solución: unificar DTO y cubrirlo con prueba de contrato.

#### M-03 — Operación completa de estados no disponible en UI

- Archivos: [`frontend/src/services/evaluacionesService.js`](frontend/src/services/evaluacionesService.js),
  [`frontend/src/routes/pages/docente/CrearEvaluacion.jsx`](frontend/src/routes/pages/docente/CrearEvaluacion.jsx)
- Causa: el backend tiene cerrar, archivar, actualizar y eliminar/archivar, pero el
  cliente solo expone crear, agregar preguntas y publicar.
- Impacto: evaluaciones no pueden administrarse completamente desde la interfaz.
- Solución: pantalla de detalle/edición con acciones según estado y bloqueo visual
  de campos estructurales.

#### M-04 — Tokens JWT persistidos en `localStorage`

- Archivos: [`frontend/src/services/api.js`](frontend/src/services/api.js),
  [`frontend/src/services/authService.js`](frontend/src/services/authService.js)
- Causa: bearer token legible por JavaScript.
- Impacto: una vulnerabilidad XSS permitiría extraer sesiones.
- Solución: evaluar cookie `HttpOnly`, `Secure`, `SameSite`, CSP estricta y tokens
  de corta duración. Si se mantiene localStorage, endurecer CSP y sanitización.

#### M-05 — Carga de archivos valida metadatos, no contenido

- Archivos: [`backend/src/config/upload.js`](backend/src/config/upload.js),
  [`backend/src/middlewares/uploadExcel.middleware.js`](backend/src/middlewares/uploadExcel.middleware.js)
- Causa: PDF por MIME/extensión y Excel por extensión.
- Impacto: archivos manipulados pueden alcanzar parsers de terceros.
- Solución: verificar firma mágica, aislar parsing, limitar complejidad y eliminar
  archivos fallidos.

#### M-06 — Dependencias frontend con tres alertas altas

- Archivo: [`frontend/package.json`](frontend/package.json)
- Causa: auditoría reporta avisos altos en Axios y React Router.
- Impacto: exposición a vulnerabilidades conocidas según uso concreto.
- Solución: actualizar lockfile de forma controlada y repetir build, lint y E2E.

#### M-07 — Regla de frontera potencialmente confusa

- Archivo: [`backend/src/config/learningRules.js`](backend/src/config/learningRules.js)
- Causa: 80% sigue siendo INTERMEDIO (`<= 80`), mientras un tema se considera
  dominado desde 80% (`>= 80`).
- Impacto: un tema puede aparecer “dominado” con nivel INTERMEDIO.
- Solución: documentarlo como decisión metodológica o alinear ambos límites antes
  de recolectar datos.

#### M-08 — El entrypoint aplica migraciones incluso para comandos auxiliares

- Archivo: [`backend/scripts/docker-entrypoint.sh`](backend/scripts/docker-entrypoint.sh)
- Causa: `prisma migrate deploy` se ejecuta antes de comprobar si se proporcionó
  un comando explícito.
- Impacto: comandos de diagnóstico pueden mutar la base, como ocurrió en esta
  auditoría.
- Solución: aplicar migraciones solo en modo servidor o con una variable explícita;
  separar imagen/comando de migración.

### Bajos

#### B-01 — Código muerto y comprobación duplicada

- Archivos: [`backend/src/services/intentos.service.js`](backend/src/services/intentos.service.js),
  [`backend/src/services/evaluaciones.service.js`](backend/src/services/evaluaciones.service.js)
- Causa: existe `else if (false)` y una segunda comprobación inalcanzable de
  `registrosHistoricos > 0`.
- Impacto: confusión de mantenimiento y riesgo de futuras regresiones.
- Solución: eliminar ramas muertas y ampliar pruebas de política.

#### B-02 — Servicios residuales no implementados

- Archivos: [`backend/src/services/preguntas.service.js`](backend/src/services/preguntas.service.js),
  [`backend/src/services/usuarios.service.js`](backend/src/services/usuarios.service.js)
- Causa: conservan TODO y devuelven arreglos vacíos. `/preguntas` está montado.
- Impacto: endpoint aparentemente válido pero funcionalmente engañoso.
- Solución: eliminar rutas residuales o implementar contratos y permisos claros.

#### B-03 — Semilla demo usa contraseña débil y no fuerza cambio

- Archivo: [`backend/prisma/seed.js`](backend/prisma/seed.js)
- Causa: cuentas demo usan `12345678` y `debeCambiarPassword: false`.
- Impacto: riesgo si `RUN_SEED=true` se activa fuera de un entorno local.
- Solución: bloquear seed en producción y generar credenciales aleatorias con
  cambio obligatorio.

#### B-04 — Mensajes y configuraciones de modelo inconsistentes

- Archivos: [`backend/src/server.js`](backend/src/server.js),
  [`backend/src/services/aiService.js`](backend/src/services/aiService.js),
  [`docker-compose.yml`](docker-compose.yml)
- Causa: el fallback mostrado por `server.js` es `gemini-2.5-flash-lite`, mientras
  servicio y Compose usan `gemini-3.5-flash-lite`.
- Impacto: diagnóstico engañoso y mayor dificultad operativa.
- Solución: una sola constante/configuración validada al arrancar.

## 6. Consistencia de datos y permisos

### Fortalezas verificadas

- `MatriculaAcademica` impone unicidad por estudiante y año.
- `AsignacionCurso` impone unicidad de área, sección y año.
- `IntentoEvaluacion` impone un intento por estudiante/evaluación.
- `RespuestaEstudiante` impone unicidad por intento/pregunta y el servicio usa
  `upsert`.
- `HistorialProgreso` evita duplicar tema dentro de un intento.
- El nivel de variante se fija en el intento y no cambia al reanudar.
- Los accesos docente/estudiante se resuelven contra asignación, sección y año.
- ADMIN no puede modificar notas mediante la ruta docente.
- Las respuestas correctas se ocultan antes de finalizar.

### Riesgos restantes

- Parte del modelo conserva relaciones legacy (`Matricula`, campos texto en
  `Curso`) junto con la nueva arquitectura. Es útil para migración, pero aumenta
  posibilidades de inconsistencia.
- La integridad histórica depende demasiado de servicios y no suficientemente de
  restricciones `Restrict` en base de datos.
- No hay política de retención, anonimización o exportación para datos de menores.
- No hay consentimiento, seudonimización ni separación explícita entre datos
  operativos y datos destinados a investigación.

## 7. Evaluación de flujos por rol

### Administrador

Funciona: login, gestión de usuarios, estados, reset, matrícula, importación Excel,
asignaciones y resumen académico global. Incompleto: CRUD visual de estructura,
consulta dedicada de calificaciones, visor de auditoría y configuración.

### Docente

Funciona: cursos asignados, plan curricular, creación de diagnóstica/final/
adaptativa, generación IA, publicación, analítica, progreso por tema y revisión de
nota. Incompleto o riesgoso: aprobación IA explícita, edición posterior, cierre y
archivo desde UI, protección contra cuota y validación curricular estricta.

### Estudiante

Funciona: cursos propios, inicio/reanudación, variante automática, respuestas,
finalización, resultado, progreso por tema y privacidad frente a compañeros.
Riesgoso: práctica adaptativa con fallback simulado y retroalimentación IA basada
en datos manipulables del cliente.

## 8. Plan de corrección priorizado

### P0 — Antes de cualquier piloto con estudiantes

1. Eliminar preguntas plantilla de prácticas adaptativas.
2. Actualizar dependencias críticas y altas; repetir las 65 pruebas.
3. Reemplazar secretos por defecto y cerrar PostgreSQL al exterior.
4. Añadir rate limiting de login y Gemini.
5. Hacer que la retroalimentación se construya exclusivamente desde datos del
   servidor.
6. Cambiar cascadas de evidencia a `Restrict` mediante una migración cuidadosamente
   ensayada.
7. Reconstruir/desplegar backend actual de forma controlada para alinear código,
   Prisma Client y esquema.

### P1 — Antes de recolección formal para la tesis

1. Implementar aprobación explícita de preguntas/variantes IA.
2. Validar coincidencia de tema, subtema, cantidad y tipos solicitados.
3. Persistir PDF en volumen/object storage y registrar checksum.
4. Completar UI ADMIN y gestión de estados docente.
5. Definir formalmente la frontera de 80% y congelar versión de reglas por estudio.
6. Añadir política de privacidad, seudonimización, exportación y retención.
7. Añadir pruebas integrales para notas revisadas, auditoría, cierre/archivo y
   retroalimentación IA con proveedor simulado.

### P2 — Antes de producción institucional

1. Vitest/Testing Library para frontend y Playwright E2E por rol.
2. Observabilidad: logs estructurados, métricas, trazas y alertas de cuota.
3. Backups y simulacro documentado de restauración PostgreSQL.
4. CSP, cabeceras con Helmet, estrategia segura de sesión y revisión XSS.
5. Versionado de reglas adaptativas, prompts y modelos por intento.
6. Pipeline CI que ejecute build, lint, pruebas, auditoría y migraciones desde cero.

## 9. Veredicto

El diseño central es defendible para una tesis: Gemini redacta contenido y las
reglas deterministas deciden nivel, variante y transición. El historial por tema y
la fijación de variante ofrecen buena trazabilidad. Sin embargo, los hallazgos C-01,
C-02 y A-01 a A-09 impiden afirmar que el sistema esté listo para producción o que
toda evidencia generada sea todavía confiable para análisis académico formal.

La recomendación es completar P0, congelar una versión metodológica y ejecutar un
piloto controlado con Gemini simulado/monitorizado antes de usar datos reales.
