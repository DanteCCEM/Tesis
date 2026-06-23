const { Router } = require("express");
const evaluacionesController = require("../controllers/evaluaciones.controller");
const authMiddleware = require("../middlewares/auth.middleware");
const autorizarRoles = require("../middlewares/role.middleware");
const {
  validarCrearEvaluacion,
  validarActualizarEvaluacion,
  validarPregunta,
} = require("../validators/evaluaciones.validator");

const router = Router();

// Todas las rutas de evaluaciones requieren un JWT válido.
router.use(authMiddleware);

// Crear evaluación (solo DOCENTE).
router.post(
  "/",
  autorizarRoles("DOCENTE"),
  validarCrearEvaluacion,
  evaluacionesController.crear,
);

// Listar evaluaciones de un curso (DOCENTE o ESTUDIANTE, según permisos).
router.get("/curso/:cursoId", evaluacionesController.listarPorCurso);

// Agregar pregunta a una evaluación (solo DOCENTE propietario).
router.post(
  "/:id/preguntas",
  autorizarRoles("DOCENTE"),
  validarPregunta,
  evaluacionesController.agregarPregunta,
);

// Iniciar (o reanudar) un intento de la evaluación (solo ESTUDIANTE matriculado).
router.post(
  "/:id/iniciar",
  autorizarRoles("ESTUDIANTE"),
  evaluacionesController.iniciar,
);

// Publicar evaluación (solo DOCENTE propietario).
router.put(
  "/:id/publicar",
  autorizarRoles("DOCENTE"),
  evaluacionesController.publicar,
);

// Analítica del aula por evaluación (solo DOCENTE propietario).
router.get(
  "/:id/analitica",
  autorizarRoles("DOCENTE"),
  evaluacionesController.analitica,
);

// Detalle de una evaluación con preguntas.
router.get("/:id", evaluacionesController.detalle);

// Editar evaluación (solo DOCENTE propietario).
router.put(
  "/:id",
  autorizarRoles("DOCENTE"),
  validarActualizarEvaluacion,
  evaluacionesController.actualizar,
);

// Eliminar evaluación (solo DOCENTE propietario).
router.delete("/:id", autorizarRoles("DOCENTE"), evaluacionesController.eliminar);

module.exports = router;
