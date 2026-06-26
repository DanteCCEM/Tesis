require("dotenv").config();

const { GoogleGenAI } = require("@google/genai");

const apiKey = process.env.GEMINI_API_KEY;
const model = process.env.GEMINI_MODEL || "gemini-2.5-flash";

async function main() {
  console.log("=== Prueba Gemini API ===");
  console.log("Modelo:", model);
  console.log("API key presente:", Boolean(apiKey && String(apiKey).trim()));
  console.log(
    "Formato key:",
    !apiKey
      ? "vacía"
      : String(apiKey).startsWith("AIza")
        ? "AIza... (Google AI Studio)"
        : String(apiKey).startsWith("AQ.")
          ? "AQ.... (no es formato AI Studio estándar)"
          : `prefijo "${String(apiKey).slice(0, 4)}..."`,
  );

  if (!apiKey || !String(apiKey).trim()) {
    console.error("ERROR: GEMINI_API_KEY no está definida en backend/.env");
    process.exit(1);
  }

  const ai = new GoogleGenAI({ apiKey: String(apiKey).trim() });

  try {
    console.log("\n1) Ping simple...");
    const ping = await ai.models.generateContent({
      model,
      contents: "Responde solo con la palabra OK",
    });
    console.log("   Respuesta:", ping.text?.trim());

    console.log("\n2) JSON estructurado (como generación de preguntas)...");
    const json = await ai.models.generateContent({
      model,
      contents: JSON.stringify({
        tarea: "Genera 1 pregunta de matemáticas nivel básico",
        esquema: { preguntas: [{ enunciado: "string", tipo: "VERDADERO_FALSO" }] },
      }),
      config: {
        systemInstruction:
          "Eres un asistente pedagógico. Responde ÚNICAMENTE con JSON válido.",
        responseMimeType: "application/json",
        temperature: 0.3,
      },
    });
    const parsed = JSON.parse(json.text);
    console.log("   JSON válido:", Array.isArray(parsed.preguntas));
    console.log("   Preguntas:", parsed.preguntas?.length ?? 0);

    console.log("\n3) aiService.generarPreguntasBorrador...");
    const aiService = require("../src/services/aiService");
    const borrador = await aiService.generarPreguntasBorrador({
      curso: "Matemáticas",
      grado: "3° secundaria",
      tema: "Álgebra",
      subtema: "Ecuaciones lineales",
      dificultad: "BASICO",
      cantidadPreguntas: 2,
      tiposPregunta: ["VERDADERO_FALSO", "OPCION_MULTIPLE"],
    });
    console.log("   Preguntas generadas:", borrador.preguntas.length);
    console.log("\n=== ÉXITO: Gemini funciona correctamente ===");
  } catch (error) {
    console.error("\n=== ERROR ===");
    console.error("Mensaje:", error.message);
    if (error.status) console.error("Status HTTP:", error.status);
    if (error.statusCode) console.error("Status code:", error.statusCode);
    if (error.errorDetails) console.error("Detalles:", JSON.stringify(error.errorDetails, null, 2));
    process.exit(1);
  }
}

main();
