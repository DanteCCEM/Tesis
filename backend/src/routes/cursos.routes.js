const { Router } = require("express");
const cursosController = require("../controllers/cursos.controller");
const planCurricularController = require("../controllers/planCurricular.controller");
const authMiddleware = require("../middlewares/auth.middleware");
const autorizarRoles = require("../middlewares/role.middleware");
const subirPdfPlan = require("../middlewares/uploadPdf.middleware");
const { validarCrearPlan } = require("../validators/planCurricular.validator");

const router = Router();
router.use(authMiddleware);

router.get("/mis-cursos", autorizarRoles("DOCENTE", "ESTUDIANTE"), cursosController.misCursos);
router.get(
  "/:id/resumen-estudiantes",
  autorizarRoles("DOCENTE"),
  cursosController.resumenEstudiantes,
);
router.post(
  "/:id/plan-curricular",
  autorizarRoles("DOCENTE"),
  subirPdfPlan,
  validarCrearPlan,
  planCurricularController.crearPorCurso,
);
router.get("/:id/plan-curricular", planCurricularController.listarPorCurso);
router.get("/:id", autorizarRoles("DOCENTE", "ESTUDIANTE"), cursosController.detalle);

module.exports = router;
