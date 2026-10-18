const test = require("node:test");
const assert = require("node:assert/strict");

const cargarServicio = () => {
  const historiales = [];
  const resumenes = new Map();
  const claveResumen = ({ estudianteId, cursoId, tema }) =>
    `${estudianteId}:${cursoId}:${tema}`;

  const tx = {
    historialProgreso: {
      findUnique: async ({ where }) =>
        historiales.find(
          (item) =>
            item.intentoId === where.intentoId_tema.intentoId &&
            item.tema === where.intentoId_tema.tema,
        ) ?? null,
      findMany: async ({ where, take }) =>
        historiales
          .filter(
            (item) =>
              item.estudianteId === where.estudianteId &&
              item.asignacionCursoId === where.asignacionCursoId &&
              item.tema === where.tema,
          )
          .sort((a, b) => b.id - a.id)
          .slice(0, take)
          .map((item) => ({ porcentaje: item.porcentaje })),
      aggregate: async ({ where }) => {
        const items = historiales.filter(
          (item) =>
            item.estudianteId === where.estudianteId &&
            item.asignacionCursoId === where.asignacionCursoId &&
            item.tema === where.tema,
        );
        return {
          _sum: {
            cantidadPreguntas: items.reduce((total, item) => total + item.cantidadPreguntas, 0),
            respuestasCorrectas: items.reduce((total, item) => total + item.respuestasCorrectas, 0),
          },
          _count: { _all: items.length },
        };
      },
      create: async ({ data }) => {
        const registro = { id: historiales.length + 1, ...data };
        historiales.push(registro);
        return registro;
      },
    },
    progresoEstudiante: {
      findUnique: async ({ where }) => {
        const key = claveResumen(where.estudianteId_cursoId_tema);
        return resumenes.get(key) ?? null;
      },
      upsert: async ({ where, update, create }) => {
        const key = claveResumen(where.estudianteId_cursoId_tema);
        const anterior = resumenes.get(key);
        const resumen = anterior
          ? { ...anterior, ...update, ultimaActualizacion: new Date() }
          : { id: resumenes.size + 1, ...create, ultimaActualizacion: new Date() };
        resumenes.set(key, resumen);
        return resumen;
      },
    },
  };

  const prismaPath = require.resolve("../src/config/prisma");
  const servicePath = require.resolve("../src/services/adaptiveLearningService");
  require.cache[prismaPath] = {
    id: prismaPath,
    filename: prismaPath,
    loaded: true,
    exports: { $transaction: async (callback) => callback(tx) },
    children: [],
    paths: [],
  };
  delete require.cache[servicePath];
  return { service: require(servicePath), historiales, resumenes };
};

test("registra historial y resumen independiente para cada tema", async () => {
  const { service, historiales, resumenes } = cargarServicio();
  const datos = {
    estudianteId: 5,
    cursoId: 8,
    asignacionCursoId: 12,
    evaluacionId: 20,
    intentoId: 30,
    dificultadEvaluacion: "INTERMEDIO",
    porcentaje: 66.67,
    respuestas: [
      { preguntaId: 1, tema: "Fracciones", esCorrecta: true },
      { preguntaId: 2, tema: "Fracciones", esCorrecta: false },
      { preguntaId: 3, tema: "Ecuaciones", esCorrecta: true },
    ],
  };

  await service.procesarIntento(datos);

  assert.equal(historiales.length, 2);
  assert.equal(historiales.find((item) => item.tema === "Fracciones").nivelDespues, "BASICO");
  assert.equal(
    historiales.find((item) => item.tema === "Ecuaciones").nivelDespues,
    "INTERMEDIO",
    "un resultado perfecto no salta directamente de básico a avanzado",
  );
  assert.equal(resumenes.get("5:8:Fracciones").porcentajeDominio, 50);
  assert.equal(resumenes.get("5:8:Ecuaciones").porcentajeDominio, 100);
  assert.equal(resumenes.get("5:8:Ecuaciones").nivelActual, "INTERMEDIO");

  await service.procesarIntento(datos);
  assert.equal(historiales.length, 2, "un reintento no duplica el historial");

  await service.procesarIntento({
    ...datos,
    evaluacionId: 21,
    intentoId: 31,
    porcentaje: 100,
    respuestas: [
      { preguntaId: 4, tema: "Fracciones", esCorrecta: true },
      { preguntaId: 5, tema: "Fracciones", esCorrecta: true },
      { preguntaId: 6, tema: "Fracciones", esCorrecta: true },
    ],
  });

  const segundoRegistro = historiales.find((item) => item.intentoId === 31);
  assert.equal(segundoRegistro.nivelAntes, "BASICO");
  assert.equal(segundoRegistro.nivelDespues, "INTERMEDIO");
  assert.equal(resumenes.get("5:8:Fracciones").porcentajeDominio, 80);
  assert.equal(resumenes.get("5:8:Fracciones").cantidadEvaluaciones, 2);
});
