const { Router } = require("express");
const planCurricularController = require("../controllers/planCurricular.controller");
const authMiddleware = require("../middlewares/auth.middleware");
const autorizarRoles = require("../middlewares/role.middleware");
const {
  validarActualizarUnidad,
  validarTema,
  validarActualizarTema,
  validarSubtema,
  validarActualizarSubtema,
} = require("../validators/planCurricular.validator");

const unidadesRouter = Router();
const temasRouter = Router();
const subtemasRouter = Router();

unidadesRouter.use(authMiddleware);

unidadesRouter.put(
  "/:unidadId",
  autorizarRoles("DOCENTE"),
  validarActualizarUnidad,
  planCurricularController.actualizarUnidad,
);

unidadesRouter.delete(
  "/:unidadId",
  autorizarRoles("DOCENTE"),
  planCurricularController.eliminarUnidad,
);

unidadesRouter.post(
  "/:unidadId/temas",
  autorizarRoles("DOCENTE"),
  validarTema,
  planCurricularController.crearTema,
);

temasRouter.use(authMiddleware);

temasRouter.put(
  "/:temaId",
  autorizarRoles("DOCENTE"),
  validarActualizarTema,
  planCurricularController.actualizarTema,
);

temasRouter.delete(
  "/:temaId",
  autorizarRoles("DOCENTE"),
  planCurricularController.eliminarTema,
);

temasRouter.post(
  "/:temaId/subtemas",
  autorizarRoles("DOCENTE"),
  validarSubtema,
  planCurricularController.crearSubtema,
);

subtemasRouter.use(authMiddleware);

subtemasRouter.put(
  "/:subtemaId",
  autorizarRoles("DOCENTE"),
  validarActualizarSubtema,
  planCurricularController.actualizarSubtema,
);

subtemasRouter.delete(
  "/:subtemaId",
  autorizarRoles("DOCENTE"),
  planCurricularController.eliminarSubtema,
);

module.exports = {
  unidadesRouter,
  temasRouter,
  subtemasRouter,
};
