const { Router } = require("express");
const intentosController = require("../controllers/intentos.controller");
const authMiddleware = require("../middlewares/auth.middleware");
const autorizarRoles = require("../middlewares/role.middleware");
const { validarRespuesta } = require("../validators/intentos.validator");

const router = Router();

// Todas las rutas de intentos requieren un JWT válido.
router.use(authMiddleware);

// Guardar/actualizar una respuesta (solo ESTUDIANTE dueño del intento).
router.post(
  "/:intentoId/respuestas",
  autorizarRoles("ESTUDIANTE"),
  validarRespuesta,
  intentosController.guardarRespuesta,
);

// Finalizar y corregir el intento (solo ESTUDIANTE dueño del intento).
router.post(
  "/:intentoId/finalizar",
  autorizarRoles("ESTUDIANTE"),
  intentosController.finalizar,
);

// Resultados del intento (estudiante dueño o docente propietario del curso).
router.get("/:intentoId/resultados", intentosController.resultados);

module.exports = router;
