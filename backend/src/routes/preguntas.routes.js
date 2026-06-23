const { Router } = require("express");
const preguntasController = require("../controllers/preguntas.controller");

const router = Router();

router.get("/", preguntasController.listar);

module.exports = router;
