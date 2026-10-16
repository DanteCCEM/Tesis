const asyncHandler = require("../utils/asyncHandler");
const ApiError = require("../utils/ApiError");
const cursosService = require("../services/cursos.service");
const estudiantesExcelService = require("../services/estudiantesExcel.service");

// Convierte un parámetro de ruta en un entero positivo o lanza 400.
const parseId = (valor, nombre) => {
  const num = Number(valor);
  if (!Number.isInteger(num) || num <= 0) {
    throw ApiError.badRequest(`${nombre} inválido`);
  }
  return num;
};

const cursosController = {
  // POST /api/cursos (solo DOCENTE)
  crear: asyncHandler(async (req, res) => {
    const curso = await cursosService.crear(req.body, req.usuario.id);
    res.status(201).json({ ok: true, curso });
  }),

  // GET /api/cursos/mis-cursos (DOCENTE o ESTUDIANTE)
  misCursos: asyncHandler(async (req, res) => {
    const cursos = await cursosService.listarMisCursos(req.usuario);
    res.status(200).json({ ok: true, cursos });
  }),

  // GET /api/cursos/:id
  detalle: asyncHandler(async (req, res) => {
    const cursoId = parseId(req.params.id, "id del curso");
    if (req.usuario.rol === "DOCENTE") {
      const curso = await cursosService.obtenerDetalleDocente(
        cursoId,
        req.usuario.id,
      );
      return res.status(200).json({ ok: true, curso });
    }
    const curso = await cursosService.obtenerDetalle(cursoId);
    res.status(200).json({ ok: true, curso });
  }),

  // POST /api/cursos/:id/matriculas (solo DOCENTE propietario)
  matricular: asyncHandler(async (req, res) => {
    const cursoId = parseId(req.params.id, "id del curso");
    const matricula = await cursosService.matricular(
      cursoId,
      req.usuario.id,
      req.body,
    );
    res.status(201).json({ ok: true, matricula });
  }),

  descargarPlantillaEstudiantes: asyncHandler(async (req, res) => {
    const cursoId = parseId(req.params.id, "id del curso");
    await cursosService.obtenerDetalleDocente(cursoId, req.usuario.id);
    const buffer = await estudiantesExcelService.crearPlantilla();
    res.setHeader(
      "Content-Type",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    );
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="plantilla-estudiantes-curso-${cursoId}.xlsx"`,
    );
    res.send(Buffer.from(buffer));
  }),

  importarEstudiantes: asyncHandler(async (req, res) => {
    const cursoId = parseId(req.params.id, "id del curso");
    const resultado = await estudiantesExcelService.importar(
      cursoId,
      req.usuario.id,
      req.file,
    );
    res.status(201).json({
      ok: true,
      ...resultado,
      mensaje: `${resultado.cantidadImportada} estudiante(s) importado(s) y matriculado(s) correctamente`,
    });
  }),

  // DELETE /api/cursos/:id/matriculas/:estudianteId (solo DOCENTE propietario)
  eliminarMatricula: asyncHandler(async (req, res) => {
    const cursoId = parseId(req.params.id, "id del curso");
    const estudianteId = parseId(req.params.estudianteId, "id del estudiante");
    const resultado = await cursosService.eliminarMatricula(
      cursoId,
      req.usuario.id,
      estudianteId,
    );
    res.status(200).json({ ok: true, ...resultado });
  }),

  // GET /api/cursos/:id/resumen-estudiantes (solo DOCENTE propietario)
  resumenEstudiantes: asyncHandler(async (req, res) => {
    const cursoId = parseId(req.params.id, "id del curso");
    const estudiantes = await cursosService.resumenEstudiantes(
      cursoId,
      req.usuario.id,
    );
    res.status(200).json({ ok: true, estudiantes });
  }),
};

module.exports = cursosController;
