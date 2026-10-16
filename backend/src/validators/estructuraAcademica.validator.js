const ApiError = require("../utils/ApiError");

const ESTADOS_ANIO = ["ACTIVO", "CERRADO"];
const ESTADOS_REGISTRO = ["ACTIVO", "INACTIVO"];
const esId = (valor) => Number.isInteger(Number(valor)) && Number(valor) > 0;
const esFecha = (valor) => valor === null || (typeof valor === "string" && !Number.isNaN(Date.parse(valor)));
const textoValido = (valor, maximo = 100) =>
  typeof valor === "string" && valor.trim().length > 0 && valor.trim().length <= maximo;

const validar = (fn) => (req, _res, next) => {
  const errores = fn(req.body ?? {}, req.method !== "POST");
  if (errores.length) return next(ApiError.badRequest(errores.join("; ")));
  next();
};

const campoRequerido = (datos, parcial, campo) => !parcial || datos[campo] !== undefined;

const validarAnio = validar((datos, parcial) => {
  const errores = [];
  if (campoRequerido(datos, parcial, "anio")) {
    const anio = Number(datos.anio);
    if (!Number.isInteger(anio) || anio < 1900 || anio > 2200) errores.push("anio no es válido");
  }
  if (datos.estado !== undefined && !ESTADOS_ANIO.includes(datos.estado)) errores.push("estado no es válido");
  for (const campo of ["fechaInicio", "fechaFin"]) {
    if (datos[campo] !== undefined && !esFecha(datos[campo])) errores.push(`${campo} no es válida`);
  }
  if (datos.fechaInicio && datos.fechaFin && new Date(datos.fechaInicio) > new Date(datos.fechaFin)) {
    errores.push("fechaInicio no puede ser posterior a fechaFin");
  }
  return errores;
});

const validarGrado = validar((datos, parcial) => {
  const errores = [];
  if (campoRequerido(datos, parcial, "nombre") && !textoValido(datos.nombre)) errores.push("nombre es obligatorio y debe tener hasta 100 caracteres");
  if (campoRequerido(datos, parcial, "orden")) {
    const orden = Number(datos.orden);
    if (!Number.isInteger(orden) || orden < 1) errores.push("orden debe ser un entero positivo");
  }
  return errores;
});

const validarSeccion = validar((datos, parcial) => {
  const errores = [];
  if (campoRequerido(datos, parcial, "gradoId") && !esId(datos.gradoId)) errores.push("gradoId no es válido");
  if (campoRequerido(datos, parcial, "nombre") && !textoValido(datos.nombre, 40)) errores.push("nombre es obligatorio y debe tener hasta 40 caracteres");
  if (datos.estado !== undefined && !ESTADOS_REGISTRO.includes(datos.estado)) errores.push("estado no es válido");
  return errores;
});

const validarArea = validar((datos, parcial) => {
  const errores = [];
  if (campoRequerido(datos, parcial, "nombre") && !textoValido(datos.nombre)) errores.push("nombre es obligatorio y debe tener hasta 100 caracteres");
  if (datos.descripcion !== undefined && datos.descripcion !== null && String(datos.descripcion).length > 1000) errores.push("descripcion debe tener hasta 1000 caracteres");
  if (datos.estado !== undefined && !ESTADOS_REGISTRO.includes(datos.estado)) errores.push("estado no es válido");
  return errores;
});

module.exports = { validarAnio, validarGrado, validarSeccion, validarArea };
