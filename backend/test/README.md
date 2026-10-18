# Pruebas de EvaluaIA

## Ejecución recomendada

Desde la raíz del repositorio:

```sh
docker compose -f docker-compose.test.yml up --build --abort-on-container-exit --exit-code-from backend-test
```

El compose crea PostgreSQL en memoria (`tmpfs`), aplica las migraciones y ejecuta
las pruebas unitarias e integrales. La suite integral contiene una protección que
rechaza cualquier base cuyo nombre no incluya `evaluacion_ia_test`.

## Alcance

- `test/*.test.js`: reglas y servicios aislados con `node:test`.
- `test/integration/*.test.js`: API real con Vitest, Supertest y PostgreSQL.
- La concurrencia de respuestas se verifica con ocho escrituras simultáneas.

## Decisiones y reglas observadas

- Se conserva la regla funcional vigente: 55 inicia INTERMEDIO, 80 todavía es
  INTERMEDIO y un valor mayor que 80 inicia AVANZADO. El dominio de un tema sí
  se considera alcanzado desde 80. Esta diferencia semántica queda probada y no
  fue modificada para acomodar la suite.
- No se añadió Playwright en esta iteración. El flujo crítico del backend se
  valida con Supertest y una base real; automatizar el navegador completo exige
  estabilizar datos/seed de UI y desacoplar la generación Gemini para no consumir
  API ni volver el E2E no determinista.
