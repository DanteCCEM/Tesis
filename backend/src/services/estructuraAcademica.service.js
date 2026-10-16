const prisma = require("../config/prisma");
const ApiError = require("../utils/ApiError");

const incluirSeccion = { grado: true };

const manejarErrorPrisma = (error, recurso) => {
  if (error?.code === "P2002") throw ApiError.conflict(`${recurso} duplicado`);
  if (error?.code === "P2003") {
    throw ApiError.conflict(`${recurso}: la relación indicada no existe o el registro está en uso`);
  }
  if (error?.code === "P2025") throw ApiError.notFound(`${recurso} no encontrado`);
  throw error;
};

const ejecutar = async (recurso, operacion) => {
  try {
    return await operacion();
  } catch (error) {
    return manejarErrorPrisma(error, recurso);
  }
};

const idValido = (valor) => {
  const id = Number(valor);
  if (!Number.isInteger(id) || id <= 0) throw ApiError.badRequest("id inválido");
  return id;
};

const fecha = (valor) => (valor === null || valor === undefined ? valor : new Date(valor));
const texto = (valor) => String(valor).trim();

const estructuraAcademicaService = {
  listarAnios: () => prisma.anioAcademico.findMany({ orderBy: { anio: "desc" } }),
  obtenerAnio: (id) => ejecutar("Año académico", async () => {
    const resultado = await prisma.anioAcademico.findUnique({ where: { id: idValido(id) } });
    if (!resultado) throw ApiError.notFound("Año académico no encontrado");
    return resultado;
  }),
  crearAnio: (datos) => ejecutar("Año académico", () => prisma.anioAcademico.create({
    data: {
      anio: Number(datos.anio),
      estado: datos.estado,
      fechaInicio: fecha(datos.fechaInicio),
      fechaFin: fecha(datos.fechaFin),
    },
  })),
  actualizarAnio: (id, datos) => ejecutar("Año académico", () => prisma.anioAcademico.update({
    where: { id: idValido(id) },
    data: {
      ...(datos.anio !== undefined ? { anio: Number(datos.anio) } : {}),
      ...(datos.estado !== undefined ? { estado: datos.estado } : {}),
      ...(datos.fechaInicio !== undefined ? { fechaInicio: fecha(datos.fechaInicio) } : {}),
      ...(datos.fechaFin !== undefined ? { fechaFin: fecha(datos.fechaFin) } : {}),
    },
  })),
  eliminarAnio: (id) => ejecutar("Año académico", () =>
    prisma.anioAcademico.delete({ where: { id: idValido(id) } })),

  listarGrados: () => prisma.grado.findMany({ orderBy: [{ orden: "asc" }, { nombre: "asc" }] }),
  obtenerGrado: (id) => ejecutar("Grado", async () => {
    const resultado = await prisma.grado.findUnique({
      where: { id: idValido(id) },
      include: { secciones: { orderBy: { nombre: "asc" } } },
    });
    if (!resultado) throw ApiError.notFound("Grado no encontrado");
    return resultado;
  }),
  crearGrado: (datos) => ejecutar("Grado", () => prisma.grado.create({
    data: { nombre: texto(datos.nombre), orden: Number(datos.orden) },
  })),
  actualizarGrado: (id, datos) => ejecutar("Grado", () => prisma.grado.update({
    where: { id: idValido(id) },
    data: {
      ...(datos.nombre !== undefined ? { nombre: texto(datos.nombre) } : {}),
      ...(datos.orden !== undefined ? { orden: Number(datos.orden) } : {}),
    },
  })),
  eliminarGrado: (id) => ejecutar("Grado", () =>
    prisma.grado.delete({ where: { id: idValido(id) } })),

  listarSecciones: (gradoId) => prisma.seccion.findMany({
    where: gradoId ? { gradoId: idValido(gradoId) } : undefined,
    include: incluirSeccion,
    orderBy: [{ grado: { orden: "asc" } }, { nombre: "asc" }],
  }),
  obtenerSeccion: (id) => ejecutar("Sección", async () => {
    const resultado = await prisma.seccion.findUnique({
      where: { id: idValido(id) }, include: incluirSeccion,
    });
    if (!resultado) throw ApiError.notFound("Sección no encontrada");
    return resultado;
  }),
  crearSeccion: (datos) => ejecutar("Sección", () => prisma.seccion.create({
    data: {
      gradoId: Number(datos.gradoId), nombre: texto(datos.nombre).toUpperCase(), estado: datos.estado,
    },
    include: incluirSeccion,
  })),
  actualizarSeccion: (id, datos) => ejecutar("Sección", () => prisma.seccion.update({
    where: { id: idValido(id) },
    data: {
      ...(datos.gradoId !== undefined ? { gradoId: Number(datos.gradoId) } : {}),
      ...(datos.nombre !== undefined ? { nombre: texto(datos.nombre).toUpperCase() } : {}),
      ...(datos.estado !== undefined ? { estado: datos.estado } : {}),
    },
    include: incluirSeccion,
  })),
  eliminarSeccion: (id) => ejecutar("Sección", () =>
    prisma.seccion.delete({ where: { id: idValido(id) } })),

  listarAreas: () => prisma.areaCurricular.findMany({ orderBy: { nombre: "asc" } }),
  obtenerArea: (id) => ejecutar("Área curricular", async () => {
    const resultado = await prisma.areaCurricular.findUnique({ where: { id: idValido(id) } });
    if (!resultado) throw ApiError.notFound("Área curricular no encontrada");
    return resultado;
  }),
  crearArea: (datos) => ejecutar("Área curricular", () => prisma.areaCurricular.create({
    data: {
      nombre: texto(datos.nombre),
      descripcion: datos.descripcion ? texto(datos.descripcion) : null,
      estado: datos.estado,
    },
  })),
  actualizarArea: (id, datos) => ejecutar("Área curricular", () => prisma.areaCurricular.update({
    where: { id: idValido(id) },
    data: {
      ...(datos.nombre !== undefined ? { nombre: texto(datos.nombre) } : {}),
      ...(datos.descripcion !== undefined
        ? { descripcion: datos.descripcion ? texto(datos.descripcion) : null }
        : {}),
      ...(datos.estado !== undefined ? { estado: datos.estado } : {}),
    },
  })),
  eliminarArea: (id) => ejecutar("Área curricular", () =>
    prisma.areaCurricular.delete({ where: { id: idValido(id) } })),
};

module.exports = estructuraAcademicaService;
