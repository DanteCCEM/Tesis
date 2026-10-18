const { Router } = require("express");
const progresoController = require("../controllers/progreso.controller");
const authMiddleware = require("../middlewares/auth.middleware");
const autorizarRoles = require("../middlewares/role.middleware");

const router = Router();

// Todas las rutas de progreso requieren un JWT válido.
router.use(authMiddleware);

// Progreso del estudiante autenticado.
router.get(
  "/mi-progreso",
  autorizarRoles("ESTUDIANTE"),
  progresoController.miProgreso,
);

router.get(
  "/evolucion",
  autorizarRoles("ESTUDIANTE"),
  progresoController.miEvolucion,
);

router.get(
  "/docente/asignaciones/:asignacionCursoId/estudiantes/:estudianteId/evolucion",
  autorizarRoles("DOCENTE"),
  progresoController.evolucionDocente,
);

router.get(
  "/admin/estudiantes/:estudianteId/evolucion",
  autorizarRoles("ADMIN"),
  progresoController.evolucionAdmin,
);

module.exports = router;
