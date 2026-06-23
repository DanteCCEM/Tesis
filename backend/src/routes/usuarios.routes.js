const { Router } = require("express");
const perfilController = require("../controllers/perfil.controller");
const authMiddleware = require("../middlewares/auth.middleware");

const router = Router();

router.use(authMiddleware);

// Perfil público/acotado de un usuario (con reglas de autorización).
router.get("/:id/perfil", perfilController.obtenerPorId);

module.exports = router;
