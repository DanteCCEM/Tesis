const { Router } = require("express");
const matriculasController = require("../controllers/matriculas.controller");

const router = Router();

router.get("/", matriculasController.listar);

module.exports = router;
