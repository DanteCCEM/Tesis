const { Router } = require("express");
const perfilController = require("../controllers/perfil.controller");
const authMiddleware = require("../middlewares/auth.middleware");
const { validarActualizarPerfil } = require("../validators/perfil.validator");

const router = Router();

router.use(authMiddleware);

// Perfil del usuario autenticado.
router.get("/", perfilController.obtener);
router.put("/", validarActualizarPerfil, perfilController.actualizar);

module.exports = router;
