require("dotenv").config();

const express = require("express");
const cors = require("cors");

const apiRoutes = require("./routes");
const notFoundHandler = require("./middlewares/notFoundHandler");
const errorHandler = require("./middlewares/errorHandler");

const app = express();

// CORS limitado al frontend de desarrollo (Vite).
app.use(cors({ origin: "http://localhost:5173" }));

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
