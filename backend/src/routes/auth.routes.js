const { Router } = require("express");
const authController = require("../controllers/auth.controller");
const authMiddleware = require("../middlewares/auth.middleware");
const { validarRegistro, validarLogin } = require("../validators/auth.validator");

const router = Router();

router.post("/registro", validarRegistro, authController.registro);
router.post("/login", validarLogin, authController.login);
router.get("/perfil", authMiddleware, authController.perfil);

module.exports = router;
