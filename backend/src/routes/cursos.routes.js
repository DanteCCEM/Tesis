const { Router } = require("express");
const cursosController = require("../controllers/cursos.controller");
const authMiddleware = require("../middlewares/auth.middleware");
const autorizarRoles = require("../middlewares/role.middleware");
const {
  validarCrearCurso,
  validarMatricula,
} = require("../validators/cursos.validator");

const router = Router();

// Todas las rutas de cursos requieren un JWT válido.
router.use(authMiddleware);

// Crear curso (solo DOCENTE).
router.post("/", autorizarRoles("DOCENTE"), validarCrearCurso, cursosController.crear);

// Mis cursos (según el rol del usuario autenticado).
// Debe declararse antes de "/:id" para no colisionar con la ruta dinámica.
router.get("/mis-cursos", cursosController.misCursos);

// Resumen académico de estudiantes (solo DOCENTE propietario).
router.get(
  "/:id/resumen-estudiantes",
  autorizarRoles("DOCENTE"),
  cursosController.resumenEstudiantes,
);

// Detalle de un curso.
router.get("/:id", cursosController.detalle);

// Matricular un estudiante en el curso (solo DOCENTE propietario).
router.post(
  "/:id/matriculas",
  autorizarRoles("DOCENTE"),
  validarMatricula,
  cursosController.matricular,
);

// Eliminar la matrícula de un estudiante (solo DOCENTE propietario).
router.delete(
  "/:id/matriculas/:estudianteId",
  autorizarRoles("DOCENTE"),
  cursosController.eliminarMatricula,
);

module.exports = router;
