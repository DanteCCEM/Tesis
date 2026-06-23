const { Router } = require("express");
const practicasAdaptativasController = require("../controllers/practicasAdaptativas.controller");
const authMiddleware = require("../middlewares/auth.middleware");
const autorizarRoles = require("../middlewares/role.middleware");
const { validarGenerarPractica } = require("../validators/practicasAdaptativas.validator");

const router = Router();

router.use(authMiddleware);

router.post(
  "/generar",
  autorizarRoles("ESTUDIANTE"),
  validarGenerarPractica,
  practicasAdaptativasController.generar,
);

module.exports = router;
