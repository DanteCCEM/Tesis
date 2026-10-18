const app = require("./app");

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(`Servidor activo en http://localhost:${PORT}`);
  if (!process.env.GEMINI_API_KEY || !String(process.env.GEMINI_API_KEY).trim()) {
    console.warn(
      "[IA] GEMINI_API_KEY no está configurada. Colócala en el archivo .env de la raíz (Docker) o en backend/.env (local).",
    );
  } else {
    const modelo = process.env.GEMINI_MODEL || "gemini-2.5-flash-lite";
    console.log(`[IA] Gemini listo. Modelo principal: ${modelo}`);
  }
});
