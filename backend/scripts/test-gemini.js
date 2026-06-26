require("dotenv").config();

const apiKey = process.env.GEMINI_API_KEY;
const model = process.env.GEMINI_MODEL || "gemini-2.0-flash-lite";
const fallbacks = process.env.GEMINI_FALLBACK_MODELS || "gemini-2.5-flash,gemini-2.0-flash";

async function main() {
  console.log("=== Prueba Gemini API (aiService) ===");
  console.log("Modelo principal:", model);
  console.log("Modelos fallback:", fallbacks);
  console.log("Reintentos:", process.env.GEMINI_RETRY_MAX ?? 3);
  console.log("API key presente:", Boolean(apiKey && String(apiKey).trim()));

  if (!apiKey || !String(apiKey).trim()) {
    console.error("ERROR: GEMINI_API_KEY no está definida en backend/.env");
    process.exit(1);
  }

  const aiService = require("../src/services/aiService");

  try {
    console.log("\n1) generarPreguntasBorrador...");
    const borrador = await aiService.generarPreguntasBorrador({
      curso: "Matemáticas",
      grado: "3° secundaria",
      tema: "Álgebra",
      subtema: "Ecuaciones lineales",
      dificultad: "BASICO",
      cantidadPreguntas: 1,
      tiposPregunta: ["VERDADERO_FALSO"],
    });
    console.log("   Preguntas generadas:", borrador.preguntas.length);

    console.log("\n2) generarRetroalimentacionPedagogica...");
    const retro = await aiService.generarRetroalimentacionPedagogica({
      resultadoEvaluacion: "Respondió 1 de 2 correctamente.",
      preguntasFalladas: [],
      temas: ["Álgebra"],
      subtemas: ["Ecuaciones lineales"],
      porcentajeObtenido: 50,
      nivelAdaptativo: "BASICO",
    });
    console.log("   Fortalezas:", retro.fortalezas.length);

    console.log("\n=== ÉXITO: Gemini funciona correctamente ===");
  } catch (error) {
    console.error("\n=== ERROR ===");
    console.error("Mensaje:", error.message);
    if (error.statusCode) console.error("Status code:", error.statusCode);
    process.exit(1);
  }
}

main();
