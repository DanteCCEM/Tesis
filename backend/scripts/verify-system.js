require("dotenv").config();

const BASE = process.env.API_BASE || "http://localhost:3000/api";

const resultados = [];
let fallos = 0;

const ok = (grupo, nombre, detalle = "") => {
  resultados.push({ estado: "OK", grupo, nombre, detalle });
  console.log(`  ✓ ${nombre}${detalle ? ` — ${detalle}` : ""}`);
};

const fail = (grupo, nombre, detalle = "") => {
  fallos += 1;
  resultados.push({ estado: "FAIL", grupo, nombre, detalle });
  console.log(`  ✗ ${nombre}${detalle ? ` — ${detalle}` : ""}`);
};

const skip = (grupo, nombre, detalle = "") => {
  resultados.push({ estado: "SKIP", grupo, nombre, detalle });
  console.log(`  ○ ${nombre}${detalle ? ` — ${detalle}` : ""}`);
};

async function request(method, path, { token, body } = {}) {
  const headers = { "Content-Type": "application/json" };
  if (token) headers.Authorization = `Bearer ${token}`;

  const response = await fetch(`${BASE}${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });

  let data = null;
  const text = await response.text();
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = { raw: text };
  }

  return { status: response.status, data };
}

async function login(correo, contrasena) {
  const { status, data } = await request("POST", "/auth/login", {
    body: { correo, contrasena },
  });
  if (status !== 200 || !data?.token) {
    throw new Error(data?.mensaje || data?.message || `Login falló (${status})`);
  }
  return data.token;
}

async function verificarInfraestructura() {
  console.log("\n=== Infraestructura ===");

  try {
    const { status, data } = await request("GET", "/health");
    if (status === 200 && data?.ok) ok("Infra", "Health check");
    else fail("Infra", "Health check", `status ${status}`);
  } catch (error) {
    fail("Infra", "Health check", error.message);
    throw error;
  }

  try {
    const prisma = require("../src/config/prisma");
    await prisma.$queryRaw`SELECT 1`;
    ok("Infra", "Base de datos PostgreSQL");
    await prisma.$disconnect();
  } catch (error) {
    fail("Infra", "Base de datos PostgreSQL", error.message);
  }

  const geminiKey = process.env.GEMINI_API_KEY?.trim();
  if (geminiKey) ok("Infra", "GEMINI_API_KEY configurada");
  else fail("Infra", "GEMINI_API_KEY configurada", "no definida en backend/.env");
}

async function verificarAuth() {
  console.log("\n=== Autenticación ===");

  try {
    const tokenDocente = await login("docente@demo.com", "123456");
    ok("Auth", "Login docente demo");
    const tokenEstudiante = await login("estudiante@demo.com", "123456");
    ok("Auth", "Login estudiante demo");
    return { tokenDocente, tokenEstudiante };
  } catch (error) {
    fail("Auth", "Login usuarios demo", error.message);
    return { tokenDocente: null, tokenEstudiante: null };
  }
}

async function verificarFlujosCore(tokens) {
  console.log("\n=== Flujos principales ===");
  const { tokenDocente, tokenEstudiante } = tokens;
  if (!tokenDocente || !tokenEstudiante) {
    skip("Core", "Resto de flujos", "sin tokens de autenticación");
    return { cursoId: null, evaluacionId: null };
  }

  let cursoId = null;
  let evaluacionId = null;

  const cursosDocente = await request("GET", "/cursos/mis-cursos", {
    token: tokenDocente,
  });
  if (cursosDocente.status === 200 && cursosDocente.data?.cursos?.length) {
    cursoId = cursosDocente.data.cursos[0].id;
    ok("Core", "Listar cursos docente", `${cursosDocente.data.cursos.length} curso(s)`);
  } else {
    fail("Core", "Listar cursos docente", `status ${cursosDocente.status}`);
  }

  const cursosEst = await request("GET", "/cursos/mis-cursos", {
    token: tokenEstudiante,
  });
  if (cursosEst.status === 200 && cursosEst.data?.cursos?.length) {
    ok("Core", "Listar cursos estudiante", `${cursosEst.data.cursos.length} curso(s)`);
  } else {
    fail("Core", "Listar cursos estudiante", `status ${cursosEst.status}`);
  }

  if (cursoId) {
    const plan = await request("GET", `/cursos/${cursoId}/plan-curricular`, {
      token: tokenDocente,
    });
    if (plan.status === 200) {
      ok(
        "Core",
        "Plan curricular por curso",
        `${plan.data?.planes?.length ?? 0} plan(es)`,
      );
    } else {
      fail("Core", "Plan curricular por curso", `status ${plan.status}`);
    }

    const planEst = await request("GET", `/cursos/${cursoId}/plan-curricular`, {
      token: tokenEstudiante,
    });
    if (planEst.status === 200) {
      const publicados = (planEst.data?.planes ?? []).filter(
        (p) => p.estado === "PUBLICADO",
      ).length;
      ok("Core", "Plan curricular estudiante (solo publicados)", `${publicados} publicado(s)`);
    } else {
      fail("Core", "Plan curricular estudiante", `status ${planEst.status}`);
    }

    const progreso = await request("GET", `/progreso/mi-progreso?cursoId=${cursoId}`, {
      token: tokenEstudiante,
    });
    if (progreso.status === 200 && progreso.data?.progreso) {
      ok(
        "Core",
        "Progreso por curso",
        `${progreso.data.progreso.evaluacionesRealizadas ?? 0} evaluación(es)`,
      );
    } else {
      fail("Core", "Progreso por curso", `status ${progreso.status}`);
    }

    const evals = await request("GET", `/evaluaciones/curso/${cursoId}`, {
      token: tokenEstudiante,
    });
    if (evals.status === 200) {
      const lista = evals.data?.evaluaciones ?? [];
      evaluacionId = lista[0]?.id ?? null;
      ok("Core", "Evaluaciones por curso", `${lista.length} evaluación(es)`);
    } else {
      fail("Core", "Evaluaciones por curso", `status ${evals.status}`);
    }
  }

  const progresoGlobal = await request("GET", "/progreso/mi-progreso", {
    token: tokenEstudiante,
  });
  if (progresoGlobal.status === 200) ok("Core", "Progreso global estudiante");
  else fail("Core", "Progreso global estudiante", `status ${progresoGlobal.status}`);

  return { cursoId, evaluacionId };
}

async function verificarIA(tokens, contexto) {
  console.log("\n=== Inteligencia artificial (Gemini) ===");

  if (!process.env.GEMINI_API_KEY?.trim()) {
    skip("IA", "Todas las pruebas IA", "GEMINI_API_KEY no configurada");
    return;
  }

  const aiService = require("../src/services/aiService");

  try {
    const borrador = await aiService.generarPreguntasBorrador({
      curso: "Matemáticas II",
      grado: "5to",
      tema: "Ecuaciones cuadráticas",
      subtema: "Fórmula general",
      dificultad: "BASICO",
      cantidadPreguntas: 2,
      tiposPregunta: ["VERDADERO_FALSO", "OPCION_MULTIPLE"],
    });
    if (borrador?.preguntas?.length >= 1) {
      ok("IA", "generarPreguntasBorrador", `${borrador.preguntas.length} pregunta(s)`);
    } else {
      fail("IA", "generarPreguntasBorrador", "sin preguntas en respuesta");
    }
  } catch (error) {
    fail("IA", "generarPreguntasBorrador", error.message);
  }

  try {
    const retro = await aiService.generarRetroalimentacionPedagogica({
      resultadoEvaluacion: "El estudiante respondió 2 de 3 correctamente.",
      preguntasFalladas: [
        {
          enunciado: "¿Cuál es la fórmula general?",
          respuestaEstudiante: "x = -b",
          respuestaCorrecta: "x = (-b ± √(b²-4ac)) / 2a",
        },
      ],
      temas: ["Ecuaciones cuadráticas"],
      subtemas: ["Fórmula general"],
      porcentajeObtenido: 66,
      nivelAdaptativo: "BASICO",
    });
    if (retro?.fortalezas && retro?.recomendacionEstudio) {
      ok("IA", "generarRetroalimentacionPedagogica");
    } else {
      fail("IA", "generarRetroalimentacionPedagogica", "estructura incompleta");
    }
  } catch (error) {
    fail("IA", "generarRetroalimentacionPedagogica", error.message);
  }

  try {
    const estructura = await aiService.extraerEstructuraCurricularDeTexto({
      textoPdf:
        "Unidad 1: Álgebra. Tema: Ecuaciones lineales. Subtema: Despeje de variables. Tema: Sistemas 2x2.",
      nombreArchivo: "plan-demo.txt",
      periodoActual: "BIMESTRE",
    });
    if (estructura?.unidades?.length >= 1) {
      ok("IA", "extraerEstructuraCurricularDeTexto", `${estructura.unidades.length} unidad(es)`);
    } else {
      fail("IA", "extraerEstructuraCurricularDeTexto", "sin unidades");
    }
  } catch (error) {
    fail("IA", "extraerEstructuraCurricularDeTexto", error.message);
  }

  const { tokenDocente, tokenEstudiante } = tokens;
  if (tokenDocente) {
    const apiIA = await request("POST", "/ia/generar-preguntas", {
      token: tokenDocente,
      body: {
        curso: "Matemáticas II",
        grado: "5to",
        tema: "Fracciones",
        subtema: "Suma de fracciones",
        dificultad: "BASICO",
        cantidadPreguntas: 1,
        tiposPregunta: ["VERDADERO_FALSO"],
      },
    });
    if (apiIA.status === 200 && apiIA.data?.preguntas?.length >= 1) {
      ok("IA", "POST /ia/generar-preguntas", `${apiIA.data.preguntas.length} pregunta(s)`);
    } else {
      fail(
        "IA",
        "POST /ia/generar-preguntas",
        apiIA.data?.mensaje || `status ${apiIA.status}`,
      );
    }
  }

  if (tokenEstudiante) {
    const practica = await request("POST", "/practicas-adaptativas/generar", {
      token: tokenEstudiante,
      body: contexto.cursoId ? { cursoId: contexto.cursoId } : {},
    });
    if ((practica.status === 200 || practica.status === 201) && practica.data?.evaluacionId) {
      ok("IA", "POST /practicas-adaptativas/generar", `evaluación ${practica.data.evaluacionId}`);
    } else if (practica.status === 400) {
      skip(
        "IA",
        "POST /practicas-adaptativas/generar",
        practica.data?.mensaje || "requiere evaluaciones previas",
      );
    } else {
      fail(
        "IA",
        "POST /practicas-adaptativas/generar",
        practica.data?.mensaje || `status ${practica.status}`,
      );
    }

    try {
      const prisma = require("../src/config/prisma");
      const intento = await prisma.intentoEvaluacion.findFirst({
        where: { estado: "FINALIZADO" },
        include: { evaluacion: { select: { tema: true, subtema: true } } },
      });

      if (intento) {
        const retroApi = await request("POST", "/ia/generar-retroalimentacion", {
          token: tokenEstudiante,
          body: {
            intentoId: intento.id,
            resultadoEvaluacion: `Obtuvo ${intento.porcentaje}% en la evaluación.`,
            preguntasFalladas: [],
            temas: [intento.evaluacion.tema],
            subtemas: intento.evaluacion.subtema ? [intento.evaluacion.subtema] : [],
            porcentajeObtenido: intento.porcentaje,
            nivelAdaptativo: intento.nivelObtenido || "BASICO",
          },
        });

        if (retroApi.status === 200 && retroApi.data?.retroalimentacion) {
          ok(
            "IA",
            "POST /ia/generar-retroalimentacion",
            retroApi.data.cached ? "desde caché" : "generada",
          );
        } else {
          fail(
            "IA",
            "POST /ia/generar-retroalimentacion",
            retroApi.data?.mensaje || `status ${retroApi.status}`,
          );
        }
      } else {
        skip("IA", "POST /ia/generar-retroalimentacion", "sin intentos finalizados");
      }

      await prisma.$disconnect();
    } catch (error) {
      fail("IA", "POST /ia/generar-retroalimentacion", error.message);
    }
  }
}

async function main() {
  console.log("EvaluaIA — verificación del sistema");
  console.log(`API: ${BASE}`);

  try {
    await verificarInfraestructura();
  } catch {
    console.log("\nEl backend no está activo. Inicia el servidor y vuelve a ejecutar.");
    process.exit(1);
  }

  const tokens = await verificarAuth();
  const contexto = await verificarFlujosCore(tokens);
  await verificarIA(tokens, contexto);

  const total = resultados.length;
  const okCount = resultados.filter((r) => r.estado === "OK").length;
  const skipCount = resultados.filter((r) => r.estado === "SKIP").length;

  console.log("\n=== Resumen ===");
  console.log(`OK: ${okCount} | SKIP: ${skipCount} | FAIL: ${fallos} | Total: ${total}`);

  process.exit(fallos > 0 ? 1 : 0);
}

main().catch((error) => {
  console.error("\nError fatal:", error.message);
  process.exit(1);
});
