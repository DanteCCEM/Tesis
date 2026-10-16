# Seguridad, pruebas y calidad de EvaluaIA

## 1. Alcance

Revisión estática, sin explotación, llamadas externas, migraciones ni modificación de datos. “Confirmado” significa que el camino inseguro se observa directamente en código; no significa que haya sido explotado.

## 2. Hallazgos

### S-01. Acceso horizontal a detalle de curso — crítica, confirmada estáticamente

**Evidencia:** `cursos.controller.detalle` usa `obtenerDetalleDocente` para DOCENTE y `obtenerDetalle(cursoId)` para cualquier otro rol. `obtenerDetalle` no recibe usuario ni comprueba matrícula y devuelve docente, estudiantes (incluido correo) y evaluaciones.

**Condición:** disponer de JWT ESTUDIANTE y conocer/adivinar un ID de curso.  
**Impacto:** exposición de datos personales y borradores/metadatos de cursos ajenos.  
**Solución:** verificar matrícula y construir DTO mínimo para estudiante; probar enumeración de IDs.

### S-02. Autorregistro público como docente — alta, confirmada

`POST /auth/registro` acepta ambos roles. Cualquier visitante puede obtener rol docente y crear recursos. No permite apropiarse de cursos ajenos, pero rompe el control institucional esperado.

**Solución:** registro público solo ESTUDIANTE; docentes por invitación/aprobación.

### S-03. Endpoints simulados públicos — alta, confirmada

`GET /api/matriculas` y `/api/preguntas` carecen de JWT. Hoy devuelven vacío, pero son un precedente peligroso si se implementa la consulta sin revisar la ruta.

**Solución:** retirar rutas o protegerlas antes de añadir datos.

### S-04. Duplicación concurrente de respuestas — alta, riesgo confirmado por diseño

`guardarRespuesta` hace `findFirst` y luego `create/update`; `RespuestaEstudiante` no tiene unicidad por intento/pregunta. Dos solicitudes concurrentes pueden crear filas duplicadas y alterar corrección/resultado.

**Solución:** migración `@@unique([intentoId,preguntaId])`, `upsert` y prueba concurrente.

### S-05. Defaults sensibles de despliegue — alta

Compose proporciona contraseña PostgreSQL y fallback JWT de desarrollo, y habilita seed por defecto. Si se publica sin variables seguras, los valores son predecibles.

**Solución:** eliminar fallback de secretos, usar secret manager y `RUN_SEED=false` fuera de demo.

### S-06. Archivos PDF no persistentes y huérfanos — alta

El backend escribe bajo su filesystem y Compose no monta volumen de uploads. La ruta absoluta queda en DB. Además Multer escribe antes de comprobaciones finales; ciertos fallos pueden dejar archivos sin registro.

**Solución:** objeto externo o volumen, transacción compensatoria, hashes, limpieza y política de retención.

### S-07. Token en localStorage — media

Facilita persistencia, pero un XSS puede leerlo. No se observó HTML inseguro directo, aunque la aplicación procesa contenido generado/ingresado.

**Solución:** cookie HttpOnly/Secure/SameSite o CSP estricta, sanitización y token corto.

### S-08. JWT no revalida usuario/rol — media

El middleware confía en claims hasta expiración. Cambios de rol o baja de usuario no invalidan token.

**Solución:** tokens cortos, versión/revocación y verificación de estado en operaciones sensibles.

### S-09. Sin controles antiabuso — media

No hay rate limiting en login, registro, IA ni uploads. Un usuario autenticado puede consumir cuota Gemini o CPU de PDF/Excel repetidamente.

**Solución:** cuotas por usuario/IP, límites, métricas y colas.

### S-10. Mensaje interno en error 500 — media

`errorHandler` devuelve `err.message`. Errores Prisma/SDK podrían revelar detalles internos.

**Solución:** mensaje genérico en 500, ID de correlación y log seguro.

### S-11. Fecha límite no impuesta — media, funcional

`fechaLimite` se almacena y muestra, pero `iniciar/finalizar` no la compara. Una evaluación publicada puede resolverse después de vencer.

### S-12. Mutabilidad/destrucción de evaluación con historial — alta, integridad

El docente puede editar/eliminar una evaluación propia sin bloqueo por estado o intentos. Cascadas pueden borrar intentos y respuestas.

**Solución:** prohibir cambios estructurales al publicar o versionar; archivar en vez de borrar.

### S-13. Inconsistencia de nivel — alta, validez académica

`intentos.service` clasifica intermedio desde 50%; `adaptiveLearningService` desde 55%. Un 52% produce etiquetas contradictorias.

### S-14. Importación de contraseñas en Excel — media, privacidad

La plantilla exige contraseña en texto claro. Aunque se hashea al guardar, puede permanecer en equipos, correo o nube.

**Solución:** generar invitaciones/contraseñas temporales, cambio obligatorio y no transportar secretos en hojas.

### S-15. IA y datos educativos — alta, cumplimiento por confirmar

Se envían resultados, preguntas falladas, temas y porcentajes a proveedor externo. No se encontró consentimiento, minimización formal, retención o aviso de privacidad.

### S-16. CORS y Nginx — media

CORS acepta lista configurada y no habilita credenciales, razonable para Bearer. Nginx no define CSP, HSTS, `X-Content-Type-Options` ni TLS. Requiere reverse proxy seguro en producción.

## 3. Controles positivos

- Contraseñas con bcrypt y respuestas sin hash excluidas de la API.
- Mensaje uniforme para usuario inexistente/contraseña errónea.
- JWT con expiración configurable.
- Comprobaciones de propietario en cursos, evaluaciones y jerarquía curricular.
- Comprobación de matrícula para evaluaciones/planes/progreso.
- Soluciones ocultas antes de finalizar.
- Intento único en DB.
- Validación de alternativa perteneciente a pregunta.
- Límite de tamaño y tipo en PDF/Excel.
- Transacciones para calificación, estructura curricular, práctica e importación.
- Importación Excel rechaza duplicados antes de crear datos.

## 4. Calidad y pruebas existentes

### Automatización encontrada

- Frontend: `npm run lint`, `npm run build`, `npm run dev`, `npm run preview`.
- Backend: `npm run dev`, `npm start`, `npm run seed`.
- Scripts manuales: `verify-system.js`, `test-plan-curricular.js`, `test-gemini.js`.
- ESLint: reglas JS/React Hooks/React Refresh.

No hay runner de pruebas ni archivos unitarios/integración/E2E reconocibles. No hay cobertura, CI o contrato OpenAPI. Los scripts manuales pueden alterar datos o usar servicios, por lo que no se ejecutaron.

### Comandos ejecutados durante esta auditoría

Solo comandos de lectura (`Get-Content`, `rg`, listado y `git status/diff` de lectura). No se ejecutaron build, lint, scripts, servidor, DB, Docker o IA debido a las restricciones del encargo. Los resultados de una conversación anterior no se presentan como ejecución de esta auditoría.

## 5. Matriz de pruebas recomendada

| ID | Nivel | Entrada/precondición | Acción | Resultado esperado | Finalidad |
|---|---|---|---|---|---|
| T01 | Integración | Correo nuevo, rol estudiante | Registro | 201, hash en DB, sin contraseña en respuesta | Identidad |
| T02 | Seguridad | Correo inexistente/existente, clave mala | Login | Ambos 401 mismo mensaje | Anti-enumeración |
| T03 | Seguridad | Estudiante A, curso sin matrícula | GET detalle curso | 403, ningún dato | Corregir S-01 |
| T04 | Seguridad | Docente A, curso B | Mutar curso/evaluación/plan | 403 | Propiedad horizontal |
| T05 | Integración | Estudiante ya matriculado | Matricular | 409, una fila | Unicidad |
| T06 | Integración | Excel válido 3 filas | Importar | 3 usuarios+matrículas | Flujo Excel |
| T07 | Integración | Excel con correo repetido | Importar | 400 y cero creaciones | Atomicidad |
| T08 | Concurrencia | Dos imports con mismo correo | Enviar simultáneo | Uno gana; otro 409; sin parciales | Carrera |
| T09 | Seguridad | Archivo renombrado a `.xlsx` | Importar | Rechazo sin agotamiento | Upload |
| T10 | Integración | Evaluación borrador | Estudiante inicia | 403 | Publicación |
| T11 | Integración | Publicada, no matriculado | Iniciar | 403 | Matrícula |
| T12 | Integración | Publicada, matriculado | Iniciar dos veces | Mismo intento en progreso | Reanudación |
| T13 | Concurrencia | Dos respuestas misma pregunta | Enviar simultáneo | Una respuesta final | S-04 |
| T14 | Unidad | Texto con tildes/espacios/caso | Corregir corta | Igualdad normalizada | Algoritmo |
| T15 | Unidad | Puntajes 2,1,2; 4 obtenidos | Finalizar | 80%, 16/20 | Fórmula |
| T16 | Unidad | 54.99,55,80,80.01 | Nivel | B,I,I,A | Límites adaptativos |
| T17 | Integración | Intento finalizado | Reiniciar/finalizar | Conflicto/error; sin cambios | Único intento |
| T18 | Integración | Fecha pasada | Iniciar | Resultado según política definida | Regla faltante |
| T19 | Integración | Fallo al guardar progreso | Finalizar | Estado consistente/reintento idempotente | Atomicidad extendida |
| T20 | Integración | PDF digital válido | Procesar | Jerarquía borrador coherente | PDF/IA |
| T21 | Integración | PDF escaneado | Procesar | 400 indicando OCR | Límite |
| T22 | Integración | Estructura existente sin confirmación | Procesar | 409, no reemplaza | Protección |
| T23 | Contrato IA | JSON con Markdown/inválido | Parsear | Limpieza o 503 controlado | Robustez |
| T24 | Resiliencia | Gemini no disponible | Práctica | Fallback local rotulado | Continuidad |
| T25 | Seguridad | Alumno A consulta intento B | Resultados | 403 | Privacidad |
| T26 | Seguridad | Docente ajeno consulta analítica | GET | 403 | Privacidad |
| T27 | Integración | Borrar evaluación con intentos | DELETE | Debe seguir política definida | Conservación |
| T28 | Rendimiento | 500 alumnos/import y reportes | Medir | Tiempo/memoria dentro de objetivo | Escala |
| T29 | E2E | Docente crea/publica; estudiante responde | Flujo completo | Resultado/progreso correctos | Camino crítico |
| T30 | E2E | Reinicio contenedor con PDF | Consultar/procesar | Archivo persiste | Infraestructura |

## 6. Estrategia sugerida

1. Unitarias: normalización, niveles, fórmulas, validadores y parseo IA.
2. Integración con PostgreSQL aislado: auth, propiedad, matrícula, intento, importación, cascadas.
3. Contrato Gemini simulado: respuestas válidas/inválidas, cuotas y timeouts.
4. E2E Playwright: caminos docente y estudiante.
5. Concurrencia: respuesta, inicio e importación.
6. Carga: reportes y PDF/Excel máximos.
7. Seguridad: autorización horizontal, rate limits, headers y dependencias.

## 7. Correcciones por etapa

**Demo:** S-01, S-03, S-13, prueba T29 y README actualizado.  
**Piloto real:** además S-02, S-04, S-05, S-06, S-09, S-12, S-14, S-15 y backups.  
**Producción:** todas las anteriores más sesiones endurecidas, observabilidad, TLS/headers, CI/CD, carga, accesibilidad y gobierno de IA.
