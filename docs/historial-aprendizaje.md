# Historial de aprendizaje por tema

El seguimiento utiliza dos capas:

- `HistorialProgreso` es una serie temporal inmutable. Registra un resultado por
  tema e intento, con la transición `nivelAntes → nivelDespues`.
- `ProgresoEstudiante` es la proyección actual acumulada por estudiante, curso y
  tema. Se conserva para consultas rápidas y compatibilidad con la interfaz.

El dominio acumulado se pondera por cantidad de preguntas:

```text
porcentajeDominio = total de respuestas correctas históricas
                    / total de preguntas históricas × 100
```

Esto evita que una evaluación de dos preguntas tenga el mismo peso que una de
diez. Los temas se calculan de manera independiente; un estudiante puede ser
`BASICO` en Fracciones, `INTERMEDIO` en Porcentajes y `AVANZADO` en Ecuaciones.
La columna `nota` representa el porcentaje del tema convertido a escala
vigesimal (0 a 20).

Las reglas se encuentran únicamente en
`backend/src/config/learningRules.js`: básico por debajo de 55%, intermedio de
55% a 80% inclusive y avanzado por encima de 80%.

La transición de nivel y las cantidades/mezclas de una formativa se centralizan
en `backend/src/config/adaptiveEvaluationRules.js`. La decisión puede considerar
varias evidencias recientes y limita cualquier subida o bajada a un solo nivel.

## Evaluaciones relevantes

Las evaluaciones `REGULAR`, `DIAGNOSTICA`, `FORMATIVA_ADAPTATIVA` y `FINAL`
actualizan el historial. `PRACTICA_ADAPTATIVA` no modifica el perfil formal de
aprendizaje.

La migración reconstruye registros históricos a partir de intentos finalizados
y respuestas existentes. A partir de entonces, finalizar nuevamente una
solicitud ya procesada es idempotente y no duplica filas.

## Endpoints de consulta

Todos permiten `temaCurricularId`, `desde`, `hasta` y `limite` como filtros.
El límite máximo es 500 registros.

- Estudiante: `GET /api/progreso/evolucion?asignacionCursoId=:id`
- Docente: `GET /api/progreso/docente/asignaciones/:asignacionCursoId/estudiantes/:estudianteId/evolucion`
- Administrador: `GET /api/progreso/admin/estudiantes/:estudianteId/evolucion?asignacionCursoId=:id`

El docente solo puede consultar estudiantes matriculados en la sección y año
de una asignación propia. El administrador dispone únicamente de lectura en
estas rutas.

Las evaluaciones que ya tienen historial no pueden eliminarse, porque hacerlo
rompería la trazabilidad experimental.
