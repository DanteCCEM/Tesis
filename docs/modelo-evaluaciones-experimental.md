# Modelo experimental de evaluaciones

El modelo distingue el propósito pedagógico de cada evaluación mediante
`Evaluacion.tipoEvaluacion`:

- `DIAGNOSTICA`: pretest común para toda la asignación. Al finalizar, actualiza
  el nivel y progreso del estudiante por tema mediante el flujo existente.
- `FORMATIVA_ADAPTATIVA`: evaluación con criterios y cantidades por nivel en
  `configuracionAdaptativa`. En esta etapa se persiste la configuración, pero
  todavía no se seleccionan preguntas personalizadas al iniciar el intento.
- `FINAL`: postest común o equivalente para todos, sin adaptación automática.
- `PRACTICA_ADAPTATIVA`: práctica individual generada por el flujo de refuerzo.
- `REGULAR`: valor interno de compatibilidad para evaluaciones históricas y
  clientes anteriores que todavía no envían el nuevo campo.

## Reglas de datos

- Diagnósticas y finales siempre guardan `esAdaptativa=false` y no pueden tener
  un `estudianteObjetivoId`.
- Formativas adaptativas guardan `esAdaptativa=true`, pero pertenecen a toda la
  asignación; su personalización futura ocurrirá dentro del intento.
- Las prácticas adaptativas mantienen `esPracticaAdaptativa=true` y un
  estudiante objetivo.
- `anioAcademicoId` se obtiene de la asignación vinculada al curso. Es opcional
  únicamente para conservar cursos históricos que aún no tengan asignación.

La configuración adaptativa versión 1 tiene esta forma:

```json
{
  "version": 1,
  "criterios": "Nivel previo por tema y porcentaje de dominio",
  "cantidadPorNivel": {
    "BASICO": 5,
    "INTERMEDIO": 7,
    "AVANZADO": 10
  }
}
```

La migración conserva las evaluaciones normales existentes como `REGULAR`,
reclasifica las prácticas existentes como `PRACTICA_ADAPTATIVA` y completa el
año académico cuando el curso ya está enlazado a una asignación.
