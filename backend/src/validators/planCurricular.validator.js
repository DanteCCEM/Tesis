const ApiError = require("../utils/ApiError");
const planCurricularService = require("../services/planCurricular.service");

const { PERIODOS, ESTADOS_PLAN, ESTADOS_TEMA } = planCurricularService;

const esEnteroPositivo = (valor) =>
  Number.isInteger(Number(valor)) && Number(valor) > 0;

const validarPeriodo = (periodo, errores, obligatorio = true) => {
  if (periodo === undefined || periodo === null || periodo === "") {
    if (obligatorio) errores.push("periodo es obligatorio");
    return;
  }
  if (!PERIODOS.includes(periodo)) {
    errores.push(`periodo debe ser uno de: ${PERIODOS.join(", ")}`);
  }
};

const validarEstadoPlan = (estado, errores) => {
  if (estado !== undefined && !ESTADOS_PLAN.includes(estado)) {
    errores.push(`estado debe ser uno de: ${ESTADOS_PLAN.join(", ")}`);
  }
};

const validarEstadoTema = (estado, errores) => {
  if (estado !== undefined && !ESTADOS_TEMA.includes(estado)) {
    errores.push(`estado debe ser uno de: ${ESTADOS_TEMA.join(", ")}`);
  }
};

const validarTitulo = (titulo, errores, campo = "titulo") => {
  if (!titulo || !String(titulo).trim()) {
    errores.push(`${campo} es obligatorio`);
  }
};

const validarCrearPlan = (req, _res, next) => {
  const { periodo } = req.body ?? {};
  const errores = [];

  validarPeriodo(periodo, errores, true);

  if (errores.length > 0) {
    return next(ApiError.badRequest(errores.join("; ")));
  }

  req.body = { periodo: String(periodo).trim() };
  next();
};

const validarActualizarPlan = (req, _res, next) => {
  const { periodo, estado, unidades } = req.body ?? {};
  const errores = [];

  validarPeriodo(periodo, errores, false);
  validarEstadoPlan(estado, errores);

  if (unidades !== undefined && !Array.isArray(unidades)) {
    errores.push("unidades debe ser un arreglo");
  }

  if (errores.length > 0) {
    return next(ApiError.badRequest(errores.join("; ")));
  }

  next();
};

const validarUnidad = (req, _res, next) => {
  const { titulo, descripcion, orden } = req.body ?? {};
  const errores = [];

  validarTitulo(titulo, errores);

  if (orden !== undefined && !esEnteroPositivo(orden)) {
    errores.push("orden debe ser un entero positivo");
  }

  if (errores.length > 0) {
    return next(ApiError.badRequest(errores.join("; ")));
  }

  req.body = {
    titulo: String(titulo).trim(),
    descripcion: descripcion ? String(descripcion).trim() : null,
    orden: orden !== undefined ? Number(orden) : undefined,
  };
  next();
};

const validarActualizarUnidad = (req, _res, next) => {
  const { titulo, descripcion, orden } = req.body ?? {};
  const errores = [];

  if (titulo !== undefined && !String(titulo).trim()) {
    errores.push("titulo no puede estar vacío");
  }
  if (orden !== undefined && !esEnteroPositivo(orden)) {
    errores.push("orden debe ser un entero positivo");
  }

  if (errores.length > 0) {
    return next(ApiError.badRequest(errores.join("; ")));
  }
  next();
};

const validarTema = (req, _res, next) => {
  const { titulo, descripcion, orden, estado } = req.body ?? {};
  const errores = [];

  validarTitulo(titulo, errores);
  validarEstadoTema(estado, errores);

  if (orden !== undefined && !esEnteroPositivo(orden)) {
    errores.push("orden debe ser un entero positivo");
  }

  if (errores.length > 0) {
    return next(ApiError.badRequest(errores.join("; ")));
  }

  req.body = {
    titulo: String(titulo).trim(),
    descripcion: descripcion ? String(descripcion).trim() : null,
    orden: orden !== undefined ? Number(orden) : undefined,
    estado,
  };
  next();
};

const validarActualizarTema = (req, _res, next) => {
  const { titulo, descripcion, orden, estado } = req.body ?? {};
  const errores = [];

  if (titulo !== undefined && !String(titulo).trim()) {
    errores.push("titulo no puede estar vacío");
  }
  validarEstadoTema(estado, errores);
  if (orden !== undefined && !esEnteroPositivo(orden)) {
    errores.push("orden debe ser un entero positivo");
  }

  if (errores.length > 0) {
    return next(ApiError.badRequest(errores.join("; ")));
  }
  next();
};

const validarSubtema = (req, _res, next) => {
  const { titulo, descripcion, orden } = req.body ?? {};
  const errores = [];

  validarTitulo(titulo, errores);

  if (orden !== undefined && !esEnteroPositivo(orden)) {
    errores.push("orden debe ser un entero positivo");
  }

  if (errores.length > 0) {
    return next(ApiError.badRequest(errores.join("; ")));
  }

  req.body = {
    titulo: String(titulo).trim(),
    descripcion: descripcion ? String(descripcion).trim() : null,
    orden: orden !== undefined ? Number(orden) : undefined,
  };
  next();
};

const validarActualizarSubtema = (req, _res, next) => {
  const { titulo, descripcion, orden } = req.body ?? {};
  const errores = [];

  if (titulo !== undefined && !String(titulo).trim()) {
    errores.push("titulo no puede estar vacío");
  }
  if (orden !== undefined && !esEnteroPositivo(orden)) {
    errores.push("orden debe ser un entero positivo");
  }

  if (errores.length > 0) {
    return next(ApiError.badRequest(errores.join("; ")));
  }
  next();
};

const validarProcesarPdf = (req, _res, next) => {
  const { confirmarReemplazo } = req.body ?? {};
  req.body = {
    confirmarReemplazo:
      confirmarReemplazo === true ||
      confirmarReemplazo === "true" ||
      confirmarReemplazo === 1 ||
      confirmarReemplazo === "1",
  };
  next();
};

module.exports = {
  validarCrearPlan,
  validarActualizarPlan,
  validarUnidad,
  validarActualizarUnidad,
  validarTema,
  validarActualizarTema,
  validarSubtema,
  validarActualizarSubtema,
  validarProcesarPdf,
};
