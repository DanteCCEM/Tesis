const { Router } = require("express");
const planCurricularController = require("../controllers/planCurricular.controller");
const authMiddleware = require("../middlewares/auth.middleware");
const autorizarRoles = require("../middlewares/role.middleware");
const {
  validarActualizarPlan,
  validarUnidad,
  validarProcesarPdf,
} = require("../validators/planCurricular.validator");

const router = Router();

router.use(authMiddleware);

router.get("/:planId", planCurricularController.detalle);

router.put(
  "/:planId",
  autorizarRoles("DOCENTE"),
  validarActualizarPlan,
  planCurricularController.actualizar,
);

router.put(
  "/:planId/publicar",
  autorizarRoles("DOCENTE"),
  planCurricularController.publicar,
);

router.post(
  "/:planId/procesar-pdf",
  autorizarRoles("DOCENTE"),
  validarProcesarPdf,
  planCurricularController.procesarPdf,
);

router.post(
  "/:planId/unidades",
  autorizarRoles("DOCENTE"),
  validarUnidad,
  planCurricularController.crearUnidad,
);

module.exports = router;
