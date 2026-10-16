const { Router } = require("express");
const authController = require("../controllers/auth.controller");
const authMiddleware = require("../middlewares/auth.middleware");
const {
  validarLogin,
  validarCambioPassword,
} = require("../validators/auth.validator");

const router = Router();

router.post("/login", validarLogin, authController.login);
router.get("/perfil", authMiddleware, authController.perfil);
router.post(
  "/cambiar-password",
  authMiddleware,
  validarCambioPassword,
  authController.cambiarPassword,
);

module.exports = router;
