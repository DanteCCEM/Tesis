require("dotenv").config();

const BASE = "http://localhost:3000/api";

async function req(method, path, { token, body, formData } = {}) {
  const headers = token ? { Authorization: `Bearer ${token}` } : {};
  const init = { method, headers };
  if (formData) {
    init.body = formData;
  } else if (body) {
    headers["Content-Type"] = "application/json";
    init.headers = headers;
    init.body = JSON.stringify(body);
  }
  const res = await fetch(`${BASE}${path}`, init);
  const text = await res.text();
  let data;
  try {
    data = JSON.parse(text);
  } catch {
    data = { raw: text.slice(0, 500) };
  }
  return { status: res.status, data };
}

async function main() {
  console.log("=== Diagnóstico plan curricular ===\n");

  const login = await req("POST", "/auth/login", {
    body: { correo: "docente@demo.com", contrasena: "123456" },
  });
  if (login.status !== 200) {
    console.error("Login falló:", login.status, login.data);
    process.exit(1);
  }
  const token = login.data.token;
  console.log("Login docente OK");

  const cursos = await req("GET", "/cursos/mis-cursos", { token });
  const cursoId = cursos.data?.cursos?.[0]?.id;
  console.log("Curso id:", cursoId);

  const list = await req("GET", `/cursos/${cursoId}/plan-curricular`, { token });
  console.log("\nGET /cursos/:id/plan-curricular");
  console.log("  Status:", list.status);
  console.log("  Planes:", list.data?.planes?.length ?? "error");
  if (list.status !== 200) console.log("  Error:", list.data?.error || list.data);

  // Check if tables exist via prisma
  try {
    const prisma = require("../src/config/prisma");
    const count = await prisma.planCurricular.count();
    console.log("\nTabla PlanCurricular en BD: OK, registros:", count);
    await prisma.$disconnect();
  } catch (e) {
    console.log("\nTabla PlanCurricular en BD: FALLO");
    console.log(" ", e.message);
  }

  // Test route exists (404 vs 401)
  const noAuth = await req("GET", `/cursos/${cursoId}/plan-curricular`);
  console.log("\nSin token (debe 401):", noAuth.status);

  const badRoute = await req("GET", "/plan-curricular/99999", { token });
  console.log("GET plan inexistente:", badRoute.status, badRoute.data?.error || "");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
