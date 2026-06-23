// Script de datos de prueba (seed).
// Uso:  node prisma/seed.js   (desde la carpeta backend)
//
// Crea (de forma idempotente):
//   - 1 docente:     docente@demo.com    / 123456
//   - 1 estudiante:  estudiante@demo.com / 123456
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

async function upsertUsuario({ nombres, correo, contrasena, rol }) {
  const existente = await prisma.usuario.findUnique({ where: { correo } });
  if (existente) return existente;
  const hash = await bcrypt.hash(contrasena, SALT_ROUNDS);
  return prisma.usuario.create({
    data: { nombres, correo, contrasena: hash, rol },
  });
}

async function main() {
  // 1) Usuarios
  const docente = await upsertUsuario({
    nombres: "Docente Demo",
    correo: "docente@demo.com",
    contrasena: "123456",
    rol: "DOCENTE",
  });
  const estudiante = await upsertUsuario({
    nombres: "Estudiante Demo",
    correo: "estudiante@demo.com",
    contrasena: "123456",
    rol: "ESTUDIANTE",
  });

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

  // 3) Matrícula del estudiante en el curso
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
  console.log("  Docente:     docente@demo.com / 123456");
  console.log("  Estudiante:  estudiante@demo.com / 123456");
  console.log(`  Curso:       ${curso.nombre} (id ${curso.id})`);
  console.log(`  Evaluación:  ${tituloEval} (id ${evaluacion.id}) [PUBLICADA]`);
}

main()
  .catch((error) => {
    console.error("Error al sembrar datos:", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
