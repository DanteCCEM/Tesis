const { Router } = require("express");
const adminController = require("../controllers/admin.controller");
const adminUsuariosController = require("../controllers/adminUsuarios.controller");
const asignacionesController = require("../controllers/asignaciones.controller");
const validarAsignacion = require("../validators/asignaciones.validator");
const adminEstudiantesExcelController = require("../controllers/adminEstudiantesExcel.controller");
const subirExcelEstudiantes = require("../middlewares/uploadExcel.middleware");
const autorizarRoles = require("../middlewares/role.middleware");
const {
  validarCrearUsuario,
  validarEstado,
} = require("../validators/admin.validator");
const {
  crearDocente,
  actualizarDocente,
  crearEstudiante,
  actualizarEstudiante,
  validarMatriculaAcademica,
} = require("../validators/adminUsuarios.validator");

const router = Router();
router.use(autorizarRoles("ADMIN"));
router.post("/usuarios", validarCrearUsuario, adminController.crearUsuario);
router.post("/usuarios/:id/restablecer-password", adminController.restablecerPassword);
router.patch("/usuarios/:id/estado", validarEstado, adminController.cambiarEstado);

router.get("/docentes", adminUsuariosController.docentes.listar);
router.post("/docentes", crearDocente, adminUsuariosController.docentes.crear);
router.put("/docentes/:id", actualizarDocente, adminUsuariosController.docentes.actualizar);
router.get("/docentes/:id/asignaciones", adminUsuariosController.docentes.asignaciones);

router.get("/estudiantes", adminUsuariosController.estudiantes.listar);
router.post("/estudiantes", crearEstudiante, adminUsuariosController.estudiantes.crear);
router.get("/estudiantes-importacion/plantilla", adminEstudiantesExcelController.plantilla);
router.post("/estudiantes-importacion", subirExcelEstudiantes, adminEstudiantesExcelController.importar);
router.put("/estudiantes/:id", actualizarEstudiante, adminUsuariosController.estudiantes.actualizar);
router.put(
  "/estudiantes/:id/matricula-academica",
  validarMatriculaAcademica,
  adminUsuariosController.estudiantes.matricula,
);
router.get("/estudiantes/:id/rendimiento", adminUsuariosController.estudiantes.rendimiento);

router.get("/asignaciones", asignacionesController.listar);
router.post("/asignaciones", validarAsignacion, asignacionesController.crear);
router.put("/asignaciones/:id", validarAsignacion, asignacionesController.actualizar);

module.exports = router;
