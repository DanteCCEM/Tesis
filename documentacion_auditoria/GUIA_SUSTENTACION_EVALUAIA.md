# Guía de sustentación de EvaluaIA

## A. Presentación de dos minutos

EvaluaIA es una plataforma web de evaluación educativa orientada a docentes y estudiantes de secundaria. El problema que aborda es que una evaluación tradicional suele terminar en una nota, pero ofrece poco seguimiento individual y demanda trabajo manual del docente.

En el sistema, el docente crea cursos, matricula estudiantes individualmente o mediante una plantilla Excel, registra un plan curricular desde PDF, crea preguntas manualmente o solicita un borrador a Gemini y publica evaluaciones. El estudiante accede solo a los cursos donde está matriculado, resuelve cada evaluación una vez y recibe su puntaje, nota, nivel y temas que debe reforzar.

La adaptación combina reglas transparentes con inteligencia artificial. El sistema calcula el porcentaje a partir del puntaje, clasifica el desempeño como básico, intermedio o avanzado y registra dominio por tema. Con esos resultados puede crear una práctica personal: básica por debajo de 55%, intermedia entre 55% y 80%, y avanzada por encima de 80%. Gemini genera las preguntas; si no está disponible, existe un fallback técnico de preguntas genéricas.

La arquitectura tiene un frontend React, una API Express y PostgreSQL con Prisma. JWT controla la sesión, bcrypt protege contraseñas y los servicios comprueban roles, propiedad y matrícula. El proyecto implementa el flujo académico principal, pero sigue siendo un prototipo de tesis: necesita más pruebas automatizadas, endurecimiento de seguridad, persistencia de archivos y validación pedagógica antes de un piloto real.

## B. Explicación técnica para el jurado

EvaluaIA es un monolito modular cliente-servidor. React 19 y React Router implementan una SPA por roles. Axios consume una API REST Express 5. El backend separa rutas, controladores, servicios, validadores y middleware. Prisma 7 utiliza el adaptador PostgreSQL; el esquema representa cursos, matrículas, evaluaciones, preguntas, intentos, respuestas, progreso, prácticas y jerarquía curricular.

La autenticación usa JWT Bearer firmado y bcrypt. La autorización combina middleware de rol con reglas de recurso en los servicios. El intento tiene clave única estudiante/evaluación. Antes de finalizar se ocultan `respuestaCorrecta` y `esCorrecta`; al finalizar se corrige en transacción.

El componente adaptativo principal es determinista y auditable: porcentaje ponderado por puntajes, reglas de nivel y dominio por tema. Gemini se usa como generador de contenido estructurado, no como fuente del puntaje. Sus respuestas JSON se validan antes de utilizarlas. Esta separación evita delegar la calificación objetiva al modelo y permite explicar las decisiones.

Docker Compose despliega PostgreSQL, API Node y SPA Nginx. La base persiste en volumen; la persistencia PDF aún requiere mejora. El sistema no tiene una suite automatizada, por lo que debe presentarse como implementación funcional con verificación pendiente, no como producto listo para producción.

## C. Guion de demostración (10–15 minutos)

### Preparación previa

- Usar datos ficticios y una base demo conocida.
- Confirmar que frontend, API, DB y Gemini están disponibles.
- Tener un PDF digital pequeño y un Excel válido.
- Tener evaluación ya preparada por si Gemini o red fallan.
- No mostrar `.env`, tokens, hashes ni claves.

### 1. Contexto y roles — 1 minuto

Mostrar inicio y explicar los dos roles. Aclarar que el docente administra recursos y el estudiante resuelve/consulta progreso.

### 2. Curso y estudiantes — 2 minutos

Entrar como docente, abrir “Mis cursos” y un curso. Mostrar estadísticas y tabla. Descargar plantilla Excel; explicar columnas sin enseñar contraseñas reales. Subir una plantilla preparada con alumnos ficticios o, si ya se importó, describir la validación atómica y duplicados.

### 3. Plan curricular — 2 minutos

Abrir plan del curso. Mostrar PDF cargado, unidades, temas y subtemas. Si se procesa en vivo, explicar que requiere texto seleccionable y Gemini; preferir mostrar una estructura ya generada para evitar latencia. Enseñar edición y publicación.

### 4. Evaluación docente — 3 minutos

Crear una evaluación vinculada a curso/tema. Mostrar opción de borrador Gemini y revisión humana. Incluir una pregunta de opción múltiple y otra de respuesta corta. Guardar y publicar. Recalcar que la IA propone; el docente revisa y publica.

### 5. Experiencia estudiante — 3 minutos

Iniciar como estudiante matriculado. Abrir curso/evaluación, responder y finalizar. Mostrar que no se revelan soluciones antes del cierre y que no puede repetir el intento.

### 6. Resultado y adaptación — 2 minutos

Mostrar nota 0–20, porcentaje, nivel, respuestas y temas por reforzar. Abrir progreso y, si hay evaluación formal finalizada, generar práctica adaptativa. Explicar umbrales y fallback.

### 7. Analítica docente y cierre — 1–2 minutos

Volver como docente y mostrar resultados: completados, pendientes, promedio, aprobación y preguntas/temas con dificultad. Cerrar con arquitectura y limitaciones honestas.

## D. Veinticinco preguntas del jurado

### 1. ¿Por qué eligió una arquitectura cliente-servidor?

Permite separar UI React de reglas y persistencia en Express/Prisma, aplicar autorización central y reemplazar clientes sin duplicar la lógica principal.

### 2. ¿Qué patrón usa el backend?

Una arquitectura por capas: rutas, middleware, controladores, servicios y acceso Prisma. No es Clean Architecture estricta porque los servicios dependen directamente de Prisma.

### 3. ¿Cómo protege las contraseñas?

Con bcryptjs y diez rondas. El hash se excluye antes de responder. No existe recuperación o cambio obligatorio, que es una mejora pendiente.

### 4. ¿Cómo autentica una solicitud?

El login emite JWT con id, correo y rol. Axios lo envía como Bearer y `auth.middleware` verifica firma y expiración.

### 5. ¿Cómo evita que un docente modifique cursos ajenos?

Los servicios comparan `curso.docenteId` con `req.usuario.id`. Se aplica en matrícula, evaluación, analítica y plan curricular.

### 6. ¿Existe algún problema de autorización conocido?

Sí. El detalle de curso para estudiantes no verifica matrícula y puede exponer datos de cursos ajenos. Está identificado como corrección crítica antes de usar datos reales.

### 7. ¿Cómo modeló la relación estudiante-curso?

Con `Matricula`, una entidad puente y restricción única `(estudianteId, cursoId)`, que evita duplicar la misma matrícula.

### 8. ¿Cómo evita repetir una evaluación?

`IntentoEvaluacion` tiene restricción única estudiante/evaluación. Si el intento está finalizado, iniciar de nuevo produce conflicto; si está en progreso, se reanuda.

### 9. ¿Cómo impide ver respuestas correctas antes de terminar?

El servicio elimina `respuestaCorrecta` y `esCorrecta` de la vista del estudiante. Solo devuelve soluciones si existe intento finalizado.

### 10. ¿Cómo calcula la nota?

Suma puntajes de preguntas correctas, divide entre puntaje máximo y multiplica por 100. La nota vigesimal es porcentaje/5, redondeada a un decimal.

### 11. ¿Hay puntaje parcial?

No. Cada pregunta recibe todo su puntaje o cero. Es una decisión actual que puede ampliarse según criterios pedagógicos.

### 12. ¿Cómo corrige una respuesta corta?

Compara con la respuesta correcta después de convertir a minúsculas, retirar tildes, recortar y normalizar espacios. No usa similitud semántica.

### 13. ¿Cuál es el algoritmo adaptativo?

Reglas explícitas: menos de 55 básico, 55 a 80 intermedio y más de 80 avanzado; 80 o más domina un tema. Los errores y progreso eligen el enfoque de una práctica.

### 14. ¿La inteligencia artificial decide la nota?

No. La nota se calcula determinísticamente. Gemini genera borradores de preguntas, retroalimentación y estructura curricular; las respuestas se validan.

### 15. ¿Qué ocurre si Gemini falla?

La generación directa de preguntas/feedback/PDF devuelve error controlado. Para prácticas adaptativas existe fallback local con preguntas genéricas, por lo que el flujo puede continuar con menor calidad pedagógica.

### 16. ¿Qué datos se envían a Gemini?

Según el flujo: curso/grado/tema, texto extraído del PDF o resultados, preguntas falladas, temas y porcentaje. No se observó envío intencional de nombre/correo, pero falta política formal de privacidad.

### 17. ¿Cómo controla respuestas mal formadas de la IA?

Solicita JSON, limpia cercos Markdown, parsea y valida estructura, tipos, alternativas, respuesta correcta, dificultad y puntajes. Si no cumple, falla de manera controlada.

### 18. ¿Cómo registra el progreso?

Al finalizar agrupa respuestas por tema y hace `upsert` de nivel, dominio y recomendación en una clave estudiante/curso/tema.

### 19. ¿El progreso es acumulativo?

El promedio global usa todos los intentos formales. El dominio por tema se sobrescribe con el último procesamiento del tema; no es una serie histórica acumulativa.

### 20. ¿Qué transacciones utiliza?

Corrección de respuestas/intento, actualización múltiple de progreso, sincronización curricular, práctica adaptativa e importación Excel. Hay que ampliar atomicidad entre finalización y progreso.

### 21. ¿Cómo funciona la importación Excel?

Genera una plantilla, valida encabezados/filas/duplicados y correos existentes, hashea contraseñas y crea usuarios más matrículas en una transacción; si una fila falla, no importa ninguna.

### 22. ¿Qué pruebas automatizadas tiene?

Actualmente no hay suite unitaria, integración o E2E. Hay scripts manuales y comandos lint/build. Es una limitación prioritaria y existe una matriz de pruebas propuesta.

### 23. ¿Cómo se despliega?

Docker Compose levanta PostgreSQL, backend Node y frontend Nginx. El backend aplica migraciones y opcionalmente seed. Faltan TLS, persistencia de PDF, backups y observabilidad para producción.

### 24. ¿Qué decisión técnica cambiaría antes de producción?

Corregiría autorización horizontal, controlaría alta de docentes, movería tokens a un mecanismo más seguro, añadiría restricciones de integridad, almacenamiento persistente y pruebas automatizadas.

### 25. ¿Puede afirmar que mejora el rendimiento académico?

No basándose solo en el código. El software instrumenta evaluación, seguimiento y recomendaciones; demostrar impacto exige diseño experimental, métricas y validación con participantes.

## E. Afirmaciones que no deben hacerse

- “El sistema está listo para producción” o “es completamente seguro”.
- “La IA siempre produce preguntas correctas o pedagógicamente válidas”.
- “Gemini nunca recibe datos educativos sensibles”.
- “La plataforma mejora el rendimiento académico” sin estudio experimental.
- “Todos los flujos tienen pruebas automatizadas”.
- “No se puede acceder a información de otros cursos”; existe un hallazgo.
- “El nivel siempre usa el mismo umbral”; existe diferencia 50/55.
- “El progreso representa todo el historial del tema”; se sobrescribe.
- “La fecha límite bloquea automáticamente”; no se observó esa regla.
- “Los archivos sobreviven cualquier reinicio”; PDF carece de volumen Compose.
- “Cada respuesta es única por pregunta bajo concurrencia”; falta restricción.
- “Las contraseñas nunca aparecen en texto claro”; la plantilla Excel las transporta.
- “El README describe exactamente el estado actual”; está desactualizado.
- “Existe OCR”; solo se acepta texto seleccionable.
- “Existe rol administrador, recuperación de contraseña o verificación de correo”.
- “Los resultados del seed o demo son evidencia científica”.

## F. Mensajes clave honestos

1. El valor técnico está en integrar evaluación, seguimiento, reglas transparentes e IA asistiva.
2. La calificación no depende de una decisión opaca del modelo.
3. El prototipo cubre el camino principal, pero la validación pedagógica y el endurecimiento productivo son trabajo futuro.
4. Las limitaciones conocidas están documentadas y priorizadas.
