const request = require("supertest");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");

const app = require("../../src/app");
const prisma = require("../../src/config/prisma");
const adaptiveLearningService = require("../../src/services/adaptiveLearningService");

const PASSWORD = "EvaluaIA.Test.2026";
const fixture = { users: {}, tokens: {}, evaluations: {}, questions: {}, variants: {} };

const auth = (token) => ({ Authorization: `Bearer ${token}` });

const login = async (username, password = PASSWORD) => {
  const response = await request(app).post("/api/auth/login").send({ username, contrasena: password });
  return response;
};

const createQuestion = async ({ evaluacionId, varianteEvaluacionId = null, dificultad, index }) =>
  prisma.pregunta.create({
    data: {
      evaluacionId,
      varianteEvaluacionId,
      enunciado: `Pregunta ${dificultad} ${index}`,
      tipo: "RESPUESTA_CORTA",
      dificultad,
      tema: "Fracciones",
      respuestaCorrecta: "correcta",
      puntaje: 1,
      revisadaPorDocente: true,
    },
  });

const createVariantQuestions = async (evaluacionId, nivelObjetivo, distribution) => {
  const cantidad = Object.values(distribution).reduce((sum, value) => sum + value, 0);
  const variante = await prisma.varianteEvaluacion.create({
    data: {
      evaluacionId,
      nivelObjetivo,
      cantidadPreguntas: cantidad,
      dificultadPredominante: nivelObjetivo,
      estado: "PUBLICADA",
      fechaAprobacion: new Date(),
      docenteAprobadorId: fixture.users.docente.id,
    },
  });
  let index = 0;
  for (const [dificultad, count] of Object.entries(distribution)) {
    for (let i = 0; i < count; i += 1) {
      index += 1;
      await createQuestion({ evaluacionId, varianteEvaluacionId: variante.id, dificultad, index });
    }
  }
  fixture.variants[nivelObjetivo] = variante;
};

beforeAll(async () => {
  if (!String(process.env.DATABASE_URL).includes("evaluacion_ia_test")) {
    throw new Error("Las pruebas de integración solo pueden ejecutarse contra evaluacion_ia_test");
  }
  await prisma.$executeRawUnsafe('TRUNCATE TABLE "Usuario" RESTART IDENTITY CASCADE');

  const hash = await bcrypt.hash(PASSWORD, 4);
  const users = [
    ["admin", "ADMIN", "ACTIVO", false],
    ["docente", "DOCENTE", "ACTIVO", false],
    ["docente2", "DOCENTE", "ACTIVO", false],
    ["estudiante", "ESTUDIANTE", "ACTIVO", false],
    ["estudiante2", "ESTUDIANTE", "ACTIVO", false],
    ["bloqueado", "ESTUDIANTE", "BLOQUEADO", false],
    ["cambio", "ESTUDIANTE", "ACTIVO", true],
    ["sesion", "ESTUDIANTE", "ACTIVO", false],
  ];
  for (const [username, rol, estado, debeCambiarPassword] of users) {
    fixture.users[username] = await prisma.usuario.create({
      data: { username, nombres: username, contrasena: hash, rol, estado, debeCambiarPassword },
    });
  }

  for (const username of ["admin", "docente", "docente2", "estudiante", "estudiante2", "cambio", "sesion"]) {
    const response = await login(username);
    expect(response.status).toBe(200);
    fixture.tokens[username] = response.body.token;
  }

  fixture.year = await prisma.anioAcademico.create({ data: { anio: 2026 } });
  fixture.grade = await prisma.grado.create({ data: { nombre: "Primero", orden: 1 } });
  fixture.section = await prisma.seccion.create({ data: { gradoId: fixture.grade.id, nombre: "A" } });
  fixture.section2 = await prisma.seccion.create({ data: { gradoId: fixture.grade.id, nombre: "B" } });
  fixture.area = await prisma.areaCurricular.create({ data: { nombre: "Matemática" } });
  fixture.assignment = await prisma.asignacionCurso.create({
    data: {
      areaCurricularId: fixture.area.id,
      seccionId: fixture.section.id,
      docenteId: fixture.users.docente.id,
      anioAcademicoId: fixture.year.id,
    },
  });
  fixture.course = await prisma.curso.create({
    data: {
      nombre: "Matemática", grado: "Primero", seccion: "A",
      docenteId: fixture.users.docente.id, asignacionCursoId: fixture.assignment.id,
    },
  });
  await prisma.matriculaAcademica.create({
    data: {
      estudianteId: fixture.users.estudiante.id,
      seccionId: fixture.section.id,
      anioAcademicoId: fixture.year.id,
    },
  });
  await prisma.matriculaAcademica.create({
    data: {
      estudianteId: fixture.users.estudiante2.id,
      seccionId: fixture.section2.id,
      anioAcademicoId: fixture.year.id,
    },
  });

  const evaluationBase = {
    tema: "Fracciones", nivelDificultad: "BASICO", cursoId: fixture.course.id,
    docenteId: fixture.users.docente.id, anioAcademicoId: fixture.year.id, estado: "PUBLICADA",
  };
  fixture.evaluations.diagnostic = await prisma.evaluacion.create({
    data: { ...evaluationBase, titulo: "Diagnóstico", tipoEvaluacion: "DIAGNOSTICA" },
  });
  fixture.questions.diagnostic = await createQuestion({
    evaluacionId: fixture.evaluations.diagnostic.id, dificultad: "BASICO", index: 1,
  });
  fixture.evaluations.final = await prisma.evaluacion.create({
    data: { ...evaluationBase, titulo: "Final", tipoEvaluacion: "FINAL", nivelDificultad: "INTERMEDIO" },
  });
  await createQuestion({ evaluacionId: fixture.evaluations.final.id, dificultad: "INTERMEDIO", index: 1 });
  fixture.evaluations.closed = await prisma.evaluacion.create({
    data: { ...evaluationBase, titulo: "Cerrada", tipoEvaluacion: "DIAGNOSTICA", estado: "CERRADA" },
  });
  await createQuestion({ evaluacionId: fixture.evaluations.closed.id, dificultad: "BASICO", index: 1 });
  fixture.evaluations.adaptive = await prisma.evaluacion.create({
    data: {
      ...evaluationBase, titulo: "Formativa", tipoEvaluacion: "FORMATIVA_ADAPTATIVA",
      esAdaptativa: true,
    },
  });
  await createVariantQuestions(fixture.evaluations.adaptive.id, "BASICO", { BASICO: 7, INTERMEDIO: 3, AVANZADO: 0 });
  await createVariantQuestions(fixture.evaluations.adaptive.id, "INTERMEDIO", { BASICO: 2, INTERMEDIO: 4, AVANZADO: 1 });
  await createVariantQuestions(fixture.evaluations.adaptive.id, "AVANZADO", { BASICO: 0, INTERMEDIO: 1, AVANZADO: 4 });

  await prisma.progresoEstudiante.createMany({ data: [
    {
      estudianteId: fixture.users.estudiante.id, cursoId: fixture.course.id,
      asignacionCursoId: fixture.assignment.id, tema: "Fracciones",
      nivelActual: "INTERMEDIO", porcentajeDominio: 65, cantidadEvaluaciones: 1,
    },
    {
      estudianteId: fixture.users.estudiante.id, cursoId: fixture.course.id,
      asignacionCursoId: fixture.assignment.id, tema: "Porcentajes",
      nivelActual: "BASICO", porcentajeDominio: 35, cantidadEvaluaciones: 1,
    },
  ] });
});

afterAll(async () => {
  await prisma.$disconnect();
});

describe("AUTH", () => {
  it("inicia sesión mediante username sin exponer credenciales", async () => {
    const response = await login("admin");
    expect(response.status).toBe(200);
    expect(response.body.usuario.username).toBe("admin");
    expect(response.body.usuario).not.toHaveProperty("contrasena");
    expect(response.body.usuario).not.toHaveProperty("sessionVersion");
  });

  it("rechaza una cuenta bloqueada", async () => {
    expect((await login("bloqueado")).status).toBe(401);
  });

  it("rechaza JWT con sessionVersion inválida", async () => {
    await prisma.usuario.update({ where: { id: fixture.users.sesion.id }, data: { sessionVersion: 1 } });
    const response = await request(app).get("/api/auth/perfil").set(auth(fixture.tokens.sesion));
    expect(response.status).toBe(401);
  });

  it("obliga a cambiar contraseña antes de acceder al dominio", async () => {
    const response = await request(app).get("/api/cursos/mis-cursos").set(auth(fixture.tokens.cambio));
    expect(response.status).toBe(403);
    expect(response.body.code).toBe("PASSWORD_CHANGE_REQUIRED");
  });

  it("el reset por admin invalida la sesión y deja trazabilidad", async () => {
    const target = fixture.users.cambio;
    const previousVersion = target.sessionVersion;
    const response = await request(app)
      .post(`/api/admin/usuarios/${target.id}/restablecer-password`)
      .set(auth(fixture.tokens.admin));
    expect(response.status).toBe(200);
    expect(response.body.contrasenaTemporal).toBeTruthy();
    const updated = await prisma.usuario.findUnique({ where: { id: target.id } });
    expect(updated.sessionVersion).toBe(previousVersion + 1);
    expect(updated.debeCambiarPassword).toBe(true);
    expect(await prisma.auditoria.count({ where: { accion: "PASSWORD_RESET", usuarioObjetivoId: target.id } })).toBe(1);
  });
});

describe("PERMISOS Y SEGURIDAD", () => {
  it("impide al estudiante acceder a un curso ajeno", async () => {
    const response = await request(app).get(`/api/cursos/${fixture.course.id}`).set(auth(fixture.tokens.estudiante2));
    expect(response.status).toBe(403);
  });

  it("impide al docente modificar asignaciones desde endpoints ADMIN", async () => {
    const response = await request(app)
      .put(`/api/admin/asignaciones/${fixture.assignment.id}`)
      .set(auth(fixture.tokens.docente2))
      .send({ estado: "INACTIVO" });
    expect(response.status).toBe(403);
  });

  it("permite gestión de usuarios al ADMIN y bloquea el endpoint a otros roles", async () => {
    expect((await request(app).get("/api/admin/estudiantes").set(auth(fixture.tokens.admin))).status).toBe(200);
    expect((await request(app).get("/api/admin/estudiantes").set(auth(fixture.tokens.docente))).status).toBe(403);
    expect((await request(app).get("/api/admin/estudiantes").set(auth(fixture.tokens.estudiante))).status).toBe(403);
  });

  it("un estudiante no consulta perfiles ajenos", async () => {
    const response = await request(app)
      .get(`/api/usuarios/${fixture.users.estudiante2.id}/perfil`)
      .set(auth(fixture.tokens.estudiante));
    expect(response.status).toBe(403);
  });
});

describe("ESTRUCTURA ACADÉMICA", () => {
  it("impone matrícula única por estudiante y año", async () => {
    await expect(prisma.matriculaAcademica.create({ data: {
      estudianteId: fixture.users.estudiante.id,
      seccionId: fixture.section2.id,
      anioAcademicoId: fixture.year.id,
    } })).rejects.toMatchObject({ code: "P2002" });
  });

  it("rechaza una asignación cuyo docente no tiene rol DOCENTE", async () => {
    const response = await request(app).post("/api/admin/asignaciones")
      .set(auth(fixture.tokens.admin))
      .send({
        areaCurricularId: fixture.area.id, seccionId: fixture.section2.id,
        docenteId: fixture.users.estudiante.id, anioAcademicoId: fixture.year.id,
      });
    expect(response.status).toBe(400);
  });
});

describe("EVALUACIONES Y ASIGNACIÓN DE VARIANTES", () => {
  it("diagnóstica y final usan preguntas comunes", async () => {
    for (const evaluation of [fixture.evaluations.diagnostic, fixture.evaluations.final]) {
      const response = await request(app).post(`/api/evaluaciones/${evaluation.id}/iniciar`)
        .set(auth(fixture.tokens.estudiante));
      expect(response.status).toBe(200);
      expect(response.body.intento.variante).toBeNull();
      expect(response.body.intento.especificacionAdaptativa.adaptativa).toBe(false);
    }
  });

  it("selecciona y fija la variante del nivel actual sin revelar otras variantes", async () => {
    const response = await request(app).post(`/api/evaluaciones/${fixture.evaluations.adaptive.id}/iniciar`)
      .set(auth(fixture.tokens.estudiante));
    expect(response.status).toBe(200);
    expect(response.body.intento.nivelAlIniciar).toBe("INTERMEDIO");
    expect(response.body.intento.variante.id).toBe(fixture.variants.INTERMEDIO.id);
    expect(response.body.intento.cantidadPreguntas).toBe(7);
    expect(response.body.evaluacion.preguntas).toHaveLength(7);
    expect(response.body.evaluacion).not.toHaveProperty("variantesEvaluacion");
    expect(response.body.evaluacion.preguntas.every(
      (pregunta) => pregunta.varianteEvaluacionId === fixture.variants.INTERMEDIO.id,
    )).toBe(true);

    await prisma.progresoEstudiante.update({
      where: { estudianteId_cursoId_tema: {
        estudianteId: fixture.users.estudiante.id, cursoId: fixture.course.id, tema: "Fracciones",
      } },
      data: { nivelActual: "AVANZADO" },
    });
    const resumed = await request(app).post(`/api/evaluaciones/${fixture.evaluations.adaptive.id}/iniciar`)
      .set(auth(fixture.tokens.estudiante));
    expect(resumed.body.intento.variante.id).toBe(fixture.variants.INTERMEDIO.id);
    expect(resumed.body.intento.nivelAlIniciar).toBe("INTERMEDIO");
  });

  it("una evaluación cerrada no admite intentos", async () => {
    const response = await request(app).post(`/api/evaluaciones/${fixture.evaluations.closed.id}/iniciar`)
      .set(auth(fixture.tokens.estudiante));
    expect(response.status).toBe(403);
  });
});

describe("RESPUESTAS", () => {
  it("usa upsert y conserva una sola respuesta aun con escrituras concurrentes", async () => {
    const start = await request(app).post(`/api/evaluaciones/${fixture.evaluations.diagnostic.id}/iniciar`)
      .set(auth(fixture.tokens.estudiante));
    const intentoId = start.body.intento.id;
    const writes = await Promise.all(Array.from({ length: 8 }, (_, index) =>
      request(app).post(`/api/intentos/${intentoId}/respuestas`)
        .set(auth(fixture.tokens.estudiante))
        .send({ preguntaId: fixture.questions.diagnostic.id, respuestaTexto: `respuesta-${index}` })));
    expect(writes.every((response) => response.status === 200)).toBe(true);
    expect(await prisma.respuestaEstudiante.count({
      where: { intentoId, preguntaId: fixture.questions.diagnostic.id },
    })).toBe(1);
  });
});

describe("PROGRESO HISTÓRICO POR TEMA", () => {
  it("agrega historial, actualiza resumen y conserva temas independientes", async () => {
    const makeEvidence = async (title, topic, correct) => {
      const evaluation = await prisma.evaluacion.create({ data: {
        titulo: title, tema: topic, nivelDificultad: "BASICO", estado: "CERRADA",
        tipoEvaluacion: "DIAGNOSTICA", cursoId: fixture.course.id,
        docenteId: fixture.users.docente.id, anioAcademicoId: fixture.year.id,
      } });
      const attempt = await prisma.intentoEvaluacion.create({ data: {
        evaluacionId: evaluation.id, estudianteId: fixture.users.estudiante.id,
        estado: "FINALIZADO", porcentaje: correct ? 100 : 0, nota: correct ? 20 : 0,
      } });
      await adaptiveLearningService.procesarIntento({
        estudianteId: fixture.users.estudiante.id, cursoId: fixture.course.id,
        asignacionCursoId: fixture.assignment.id, evaluacionId: evaluation.id,
        intentoId: attempt.id, dificultadEvaluacion: "BASICO", nivelAlRendir: "BASICO",
        porcentaje: correct ? 100 : 0,
        respuestas: [{ preguntaId: attempt.id * 100, tema: topic, subtema: topic, esCorrecta: correct }],
      });
    };
    await makeEvidence("Evidencia 1", "Decimales", true);
    await makeEvidence("Evidencia 2", "Decimales", false);

    const history = await prisma.historialProgreso.findMany({ where: {
      estudianteId: fixture.users.estudiante.id, tema: "Decimales",
    } });
    const summary = await prisma.progresoEstudiante.findUnique({ where: {
      estudianteId_cursoId_tema: {
        estudianteId: fixture.users.estudiante.id, cursoId: fixture.course.id, tema: "Decimales",
      },
    } });
    const percentages = await prisma.progresoEstudiante.findUnique({ where: {
      estudianteId_cursoId_tema: {
        estudianteId: fixture.users.estudiante.id, cursoId: fixture.course.id, tema: "Porcentajes",
      },
    } });
    expect(history).toHaveLength(2);
    expect(summary.cantidadEvaluaciones).toBe(2);
    expect(summary.porcentajeDominio).toBe(50);
    expect(percentages.nivelActual).toBe("BASICO");
  });
});
