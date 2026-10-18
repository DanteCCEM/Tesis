# Modelo experimental de evaluaciones

El modelo distingue el propósito pedagógico de cada evaluación mediante
`Evaluacion.tipoEvaluacion`:

- `DIAGNOSTICA`: pretest común para toda la asignación. Al finalizar, actualiza
  el nivel y progreso del estudiante por tema mediante el flujo existente.
- `FORMATIVA_ADAPTATIVA`: evaluación con criterios y cantidades por nivel en
  `configuracionAdaptativa`. Al iniciar un intento se crea y persiste una
  variante según el nivel actual del estudiante en el tema.
- `FINAL`: postest común o equivalente para todos, sin adaptación automática.
- `PRACTICA_ADAPTATIVA`: práctica individual generada por el flujo de refuerzo.
- `REGULAR`: valor interno de compatibilidad para evaluaciones históricas y
  clientes anteriores que todavía no envían el nuevo campo.

## Reglas de datos

- Diagnósticas y finales siempre guardan `esAdaptativa=false` y no pueden tener
  un `estudianteObjetivoId`.
- Formativas adaptativas guardan `esAdaptativa=true` y pertenecen a toda la
  asignación; la selección personalizada se realiza dentro del intento.
- Las prácticas adaptativas mantienen `esPracticaAdaptativa=true` y un
  estudiante objetivo.
- `anioAcademicoId` se obtiene de la asignación vinculada al curso. Es opcional
  únicamente para conservar cursos históricos que aún no tengan asignación.

La configuración adaptativa versión 2 tiene esta forma:

```json
{
  "version": 2,
  "criterios": "Nivel previo por tema y porcentaje de dominio",
  "porNivel": {
    "BASICO": {
      "cantidadPreguntas": 10,
      "distribucion": { "BASICO": 7, "INTERMEDIO": 3, "AVANZADO": 0 }
    },
    "INTERMEDIO": {
      "cantidadPreguntas": 7,
      "distribucion": { "BASICO": 2, "INTERMEDIO": 4, "AVANZADO": 1 }
    },
    "AVANZADO": {
      "cantidadPreguntas": 5,
      "distribucion": { "BASICO": 0, "INTERMEDIO": 1, "AVANZADO": 4 }
    }
  },
  "transicion": {
    "evaluacionesRecientes": 1,
    "maxCambioNiveles": 1
  }
}
```

`AdaptiveEvaluationService` consulta el nivel por tema, toma la regla
correspondiente y fija en `IntentoEvaluacion` los identificadores de preguntas,
el nivel al rendir, la dificultad de variante y la cantidad. La mezcla es una
meta: si faltan preguntas de una dificultad, el motor completa la cantidad con
el banco disponible y registra tanto la distribución objetivo como la real.

El porcentaje siempre se calcula como `puntaje obtenido / puntaje máximo × 100`
y la nota se convierte a escala 0–20. Los reportes agrupan las formativas por
variante y no producen un promedio único entre variantes básicas, intermedias y
avanzadas.

Las transiciones utilizan una ventana configurable de evaluaciones recientes y
están limitadas a un nivel por actualización. Por ello, incluso con 100%, un
estudiante en `BASICO` pasa primero a `INTERMEDIO`, nunca directamente a
`AVANZADO`.

La migración conserva las evaluaciones normales existentes como `REGULAR`,
reclasifica las prácticas existentes como `PRACTICA_ADAPTATIVA` y completa el
año académico cuando el curso ya está enlazado a una asignación.
