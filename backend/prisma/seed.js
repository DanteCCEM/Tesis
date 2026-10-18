// Script de datos de prueba (seed).
// Uso:  node prisma/seed.js   (desde la carpeta backend)
//
// Crea (de forma idempotente):
//   - 1 docente:     docente.demo    / 12345678
//   - 1 estudiante:  estudiante.demo / 12345678
//   - 1 curso del docente con el estudiante matriculado
//   - 1 evaluación PUBLICADA con 3 preguntas (opción múltiple,
//     verdadero/falso y respuesta corta)
//
// Después puedes iniciar sesión en el frontend como estudiante y resolver
// la evaluación desde "Mis cursos".

require("dotenv").config();
const bcrypt = require("bcryptjs");
const prisma = require("../src/config/prisma");

const SALT_ROUNDS = 10;

async function upsertUsuario({
  username,
  nombres,
  correo,
  contrasena,
  rol,
  debeCambiarPassword = false,
}) {
  const usernameNormalizado = String(username).trim().toLowerCase();
  const correoNormalizado = correo ? String(correo).trim().toLowerCase() : null;
  const [porUsername, porCorreo] = await Promise.all([
    prisma.usuario.findUnique({ where: { username: usernameNormalizado } }),
    correoNormalizado
      ? prisma.usuario.findUnique({ where: { correo: correoNormalizado } })
      : null,
  ]);

  if (porUsername && porCorreo && porUsername.id !== porCorreo.id) {
    throw new Error(
      `Conflicto de seed: username "${usernameNormalizado}" y correo "${correoNormalizado}" pertenecen a usuarios diferentes (ids ${porUsername.id} y ${porCorreo.id}).`,
    );
  }

  // El seed nunca actualiza cuentas existentes: así no cambia contraseñas,
  // roles, estado ni datos personales en cada reinicio.
  if (porUsername || porCorreo) return porUsername || porCorreo;

  const hash = await bcrypt.hash(contrasena, SALT_ROUNDS);
  return prisma.usuario.create({
    data: {
      username: usernameNormalizado,
      nombres,
      correo: correoNormalizado,
      contrasena: hash,
      rol,
      debeCambiarPassword,
    },
  });
}

async function main() {
  // 1) Usuarios
  const docente = await upsertUsuario({
    username: "docente.demo",
    nombres: "Docente Demo",
    correo: "docente@demo.com",
    contrasena: "12345678",
    rol: "DOCENTE",
  });
  const estudiante = await upsertUsuario({
    username: "estudiante.demo",
    nombres: "Estudiante Demo",
    correo: "estudiante@demo.com",
    contrasena: "12345678",
    rol: "ESTUDIANTE",
  });

  // Crea un administrador inicial solo cuando sus credenciales se proporcionan
  // explícitamente mediante variables de entorno.
  if (process.env.ADMIN_USERNAME && process.env.ADMIN_PASSWORD) {
    await upsertUsuario({
      username: process.env.ADMIN_USERNAME.trim().toLowerCase(),
      nombres: process.env.ADMIN_NOMBRES || "Administrador",
      correo: process.env.ADMIN_CORREO?.trim().toLowerCase() || null,
      contrasena: process.env.ADMIN_PASSWORD,
      rol: "ADMIN",
      debeCambiarPassword: true,
    });
  }

  // 2) Curso del docente
  let curso = await prisma.curso.findFirst({
    where: { docenteId: docente.id, nombre: "Matemáticas II" },
  });
  if (!curso) {
    curso = await prisma.curso.create({
      data: {
        nombre: "Matemáticas II",
        grado: "5to",
        seccion: "A",
        descripcion: "Curso de demostración",
        docenteId: docente.id,
      },
    });
  }

  // 3) Vincula el demo con la arquitectura académica nueva para que el
  // docente pueda seleccionar una asignación y usar generación adaptativa.
  const anioAcademico = await prisma.anioAcademico.upsert({
    where: { anio: new Date().getFullYear() },
    update: { estado: "ACTIVO" },
    create: { anio: new Date().getFullYear(), estado: "ACTIVO" },
  });
  const grado = await prisma.grado.upsert({
    where: { nombre: "5to de secundaria" },
    update: {},
    create: { nombre: "5to de secundaria", orden: 5 },
  });
  const seccion = await prisma.seccion.upsert({
    where: { gradoId_nombre: { gradoId: grado.id, nombre: "A" } },
    update: { estado: "ACTIVO" },
    create: { gradoId: grado.id, nombre: "A", estado: "ACTIVO" },
  });
  const areaCurricular = await prisma.areaCurricular.upsert({
    where: { nombre: "Matemáticas II" },
    update: { estado: "ACTIVO" },
    create: {
      nombre: "Matemáticas II",
      descripcion: "Área curricular de demostración",
      estado: "ACTIVO",
    },
  });
  let asignacion = await prisma.asignacionCurso.findFirst({
    where: {
      areaCurricularId: areaCurricular.id,
      seccionId: seccion.id,
      anioAcademicoId: anioAcademico.id,
    },
  });
  if (!asignacion) {
    asignacion = await prisma.asignacionCurso.create({
      data: {
        areaCurricularId: areaCurricular.id,
        seccionId: seccion.id,
        docenteId: docente.id,
        anioAcademicoId: anioAcademico.id,
        estado: "ACTIVO",
      },
    });
  }
  if (curso.asignacionCursoId !== asignacion.id) {
    curso = await prisma.curso.update({
      where: { id: curso.id },
      data: {
        asignacionCursoId: asignacion.id,
        nombre: areaCurricular.nombre,
        grado: grado.nombre,
        seccion: seccion.nombre,
      },
    });
  }
  await prisma.matriculaAcademica.upsert({
    where: {
      estudianteId_anioAcademicoId: {
        estudianteId: estudiante.id,
        anioAcademicoId: anioAcademico.id,
      },
    },
    update: { seccionId: seccion.id, estado: "ACTIVO" },
    create: {
      estudianteId: estudiante.id,
      seccionId: seccion.id,
      anioAcademicoId: anioAcademico.id,
      estado: "ACTIVO",
    },
  });

  // 4) Matrícula del estudiante en el curso legacy (compatibilidad)
  await prisma.matricula.upsert({
    where: {
      estudianteId_cursoId: { estudianteId: estudiante.id, cursoId: curso.id },
    },
    update: {},
    create: { estudianteId: estudiante.id, cursoId: curso.id },
  });

  // 4) Evaluación PUBLICADA con preguntas (solo si no existe)
  const tituloEval = "Examen parcial · Álgebra";
  let evaluacion = await prisma.evaluacion.findFirst({
    where: { cursoId: curso.id, titulo: tituloEval },
  });

  if (!evaluacion) {
    evaluacion = await prisma.evaluacion.create({
      data: {
        titulo: tituloEval,
        tema: "Ecuaciones cuadráticas",
        subtema: "Forma general",
        nivelDificultad: "INTERMEDIO",
        estado: "PUBLICADA",
        cursoId: curso.id,
        docenteId: docente.id,
      },
    });

    // Pregunta 1: opción múltiple
    await prisma.pregunta.create({
      data: {
        enunciado: "¿Cuál es la forma general de una ecuación cuadrática?",
        tipo: "OPCION_MULTIPLE",
        dificultad: "BASICO",
        tema: "Forma general",
        puntaje: 1,
        evaluacionId: evaluacion.id,
        alternativas: {
          create: [
            { texto: "ax² + bx + c = 0", esCorrecta: true },
            { texto: "ax + b = 0", esCorrecta: false },
            { texto: "a/x + b = c", esCorrecta: false },
            { texto: "ax³ + bx² + c = 0", esCorrecta: false },
          ],
        },
      },
    });

    // Pregunta 2: verdadero/falso
    await prisma.pregunta.create({
      data: {
        enunciado:
          "El discriminante b² − 4ac permite saber cuántas soluciones reales tiene la ecuación.",
        tipo: "VERDADERO_FALSO",
        dificultad: "INTERMEDIO",
        tema: "Discriminante",
        respuestaCorrecta: "VERDADERO",
        puntaje: 1,
        evaluacionId: evaluacion.id,
        alternativas: {
          create: [
            { texto: "Verdadero", esCorrecta: true },
            { texto: "Falso", esCorrecta: false },
          ],
        },
      },
    });

    // Pregunta 3: respuesta corta
    await prisma.pregunta.create({
      data: {
        enunciado:
          "Escribe la fórmula general para resolver una ecuación cuadrática.",
        tipo: "RESPUESTA_CORTA",
        dificultad: "AVANZADO",
        tema: "Fórmula general",
        respuestaCorrecta: "(-b ± √(b²-4ac)) / 2a",
        puntaje: 1,
        evaluacionId: evaluacion.id,
      },
    });
  }

  console.log("Datos de prueba listos:");
  console.log(`  Docente:     ${docente.username}`);
  console.log(`  Estudiante:  ${estudiante.username}`);
  console.log("  Las contraseñas existentes se conservan; no se imprimen ni se sobrescriben.");
  console.log(`  Curso:       ${curso.nombre} (id ${curso.id})`);
  console.log(`  Evaluación:  ${tituloEval} (id ${evaluacion.id}) [PUBLICADA]`);
}

if (require.main === module) {
  main()
    .catch((error) => {
      console.error("Error al sembrar datos:", error.message || error);
      process.exitCode = 1;
    })
    .finally(async () => {
      await prisma.$disconnect();
    });
}

module.exports = { main, upsertUsuario };
