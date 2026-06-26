require("dotenv").config();

const express = require("express");
const cors = require("cors");

const apiRoutes = require("./routes");
const notFoundHandler = require("./middlewares/notFoundHandler");
const errorHandler = require("./middlewares/errorHandler");

const app = express();

// CORS: en Docker usa CORS_ORIGIN; en desarrollo local, Vite (:5173).
const corsOrigin = process.env.CORS_ORIGIN || "http://localhost:5173";
app.use(cors({ origin: corsOrigin.split(",").map((origin) => origin.trim()) }));

// Parseo de JSON en el cuerpo de las peticiones.
app.use(express.json());

// Todas las rutas del dominio cuelgan de /api.
app.use("/api", apiRoutes);

// Manejo de rutas inexistentes y errores (siempre al final).
app.use(notFoundHandler);
app.use(errorHandler);

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(`Servidor activo en http://localhost:${PORT}`);
});
