const { Router } = require("express");
const controller = require("../controllers/estructuraAcademica.controller");
const autorizarRoles = require("../middlewares/role.middleware");
const {
  validarAnio,
  validarGrado,
  validarSeccion,
  validarArea,
} = require("../validators/estructuraAcademica.validator");

const router = Router();
router.use(autorizarRoles("ADMIN"));

const registrarCrud = (ruta, handlers, validator) => {
  router.get(ruta, handlers.listar);
  router.post(ruta, validator, handlers.crear);
  router.get(`${ruta}/:id`, handlers.obtener);
  router.put(`${ruta}/:id`, validator, handlers.actualizar);
  router.delete(`${ruta}/:id`, handlers.eliminar);
};

registrarCrud("/anios-academicos", controller.anios, validarAnio);
registrarCrud("/grados", controller.grados, validarGrado);
registrarCrud("/secciones", controller.secciones, validarSeccion);
registrarCrud("/areas-curriculares", controller.areas, validarArea);

module.exports = router;
