const { Router } = require("express");

const authRoutes = require("./auth.routes");
const usuariosRoutes = require("./usuarios.routes");
const cursosRoutes = require("./cursos.routes");
const matriculasRoutes = require("./matriculas.routes");
const evaluacionesRoutes = require("./evaluaciones.routes");
const preguntasRoutes = require("./preguntas.routes");
const intentosRoutes = require("./intentos.routes");
const progresoRoutes = require("./progreso.routes");
const perfilRoutes = require("./perfil.routes");
const iaRoutes = require("./ia.routes");
const practicasAdaptativasRoutes = require("./practicasAdaptativas.routes");

const router = Router();

// Estado del servicio.
router.get("/health", (req, res) => {
  res.status(200).json({
    ok: true,
    mensaje: "API del sistema de evaluación operativa",
    timestamp: new Date().toISOString(),
  });
});

// Recursos del dominio.
router.use("/auth", authRoutes);
router.use("/usuarios", usuariosRoutes);
router.use("/cursos", cursosRoutes);
router.use("/matriculas", matriculasRoutes);
router.use("/evaluaciones", evaluacionesRoutes);
router.use("/preguntas", preguntasRoutes);
router.use("/intentos", intentosRoutes);
router.use("/progreso", progresoRoutes);
router.use("/perfil", perfilRoutes);
router.use("/ia", iaRoutes);
router.use("/practicas-adaptativas", practicasAdaptativasRoutes);

module.exports = router;
