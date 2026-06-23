const { Router } = require("express");
const iaController = require("../controllers/ia.controller");
const authMiddleware = require("../middlewares/auth.middleware");
const autorizarRoles = require("../middlewares/role.middleware");
const {
  validarGenerarPreguntas,
  validarGenerarRetroalimentacion,
} = require("../validators/ia.validator");

const router = Router();

router.use(authMiddleware);

router.post(
  "/generar-preguntas",
  autorizarRoles("DOCENTE"),
  validarGenerarPreguntas,
  iaController.generarPreguntas,
);

router.post(
  "/generar-retroalimentacion",
  autorizarRoles("DOCENTE", "ESTUDIANTE"),
  validarGenerarRetroalimentacion,
  iaController.generarRetroalimentacion,
);

module.exports = router;
