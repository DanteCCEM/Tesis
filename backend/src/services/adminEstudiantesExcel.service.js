const ExcelJS = require("exceljs");
const bcrypt = require("bcryptjs");
const prisma = require("../config/prisma");
const ApiError = require("../utils/ApiError");
const { generarPasswordTemporal } = require("../utils/password");

const MAX_FILAS = 300;
const COLUMNAS = ["dni", "nombres", "apellidoPaterno", "apellidoMaterno", "codigoEstudiante", "username", "telefono"];
const texto = (celda) => String(celda?.value?.text ?? celda?.value ?? "").trim();
const slug = (valor) => String(valor).normalize("NFD").replace(/[\u0300-\u036f]/g, "")
  .toLowerCase().replace(/[^a-z0-9]+/g, ".").replace(/^\.|\.$/g, "");

const crearPlantilla = async () => {
  const libro = new ExcelJS.Workbook();
  const hoja = libro.addWorksheet("Estudiantes", { views: [{ state: "frozen", ySplit: 1 }] });
  hoja.columns = COLUMNAS.map((header) => ({ header, key: header, width: header === "nombres" ? 28 : 22 }));
  hoja.getRow(1).eachCell((cell) => {
    cell.font = { bold: true, color: { argb: "FFFFFFFF" } };
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF2563EB" } };
  });
  const instrucciones = libro.addWorksheet("Instrucciones");
  instrucciones.columns = [{ width: 110 }];
  [
    "IMPORTACIÓN INSTITUCIONAL DE ESTUDIANTES",
    "DNI, nombres y apellidos son obligatorios. DNI debe tener 8 dígitos.",
    "codigoEstudiante, username y telefono son opcionales.",
    "Si username queda vacío, EvaluaIA lo genera automáticamente.",
    "Las contraseñas se generan en el servidor y se muestran una sola vez al finalizar.",
    "El año y la sección se seleccionan al subir el archivo, no se escriben en el Excel.",
  ].forEach((mensaje, index) => { instrucciones.getCell(index + 1, 1).value = mensaje; });
  return libro.xlsx.writeBuffer();
};

const leer = async (buffer) => {
  if (!buffer?.length) throw ApiError.badRequest("Debes seleccionar un archivo Excel");
  const libro = new ExcelJS.Workbook();
  try { await libro.xlsx.load(buffer); } catch { throw ApiError.badRequest("El archivo .xlsx no es válido"); }
  const hoja = libro.getWorksheet("Estudiantes") || libro.worksheets[0];
  if (!hoja) throw ApiError.badRequest("El archivo no contiene hojas");
  const headers = COLUMNAS.map((_, i) => texto(hoja.getCell(1, i + 1)));
  if (headers.some((header, i) => header !== COLUMNAS[i])) throw ApiError.badRequest(`Los encabezados deben ser: ${COLUMNAS.join(", ")}`);
  const filas = [];
  const errores = [];
  hoja.eachRow((row, numero) => {
    if (numero === 1) return;
    const datos = Object.fromEntries(COLUMNAS.map((campo, i) => [campo, texto(row.getCell(i + 1))]));
    if (Object.values(datos).every((valor) => !valor)) return;
    if (!/^\d{8}$/.test(datos.dni)) errores.push(`Fila ${numero}: DNI inválido`);
    for (const campo of ["nombres", "apellidoPaterno", "apellidoMaterno"]) if (!datos[campo]) errores.push(`Fila ${numero}: ${campo} es obligatorio`);
    filas.push({ ...datos, fila: numero });
  });
  if (!filas.length) throw ApiError.badRequest("La plantilla no contiene estudiantes");
  if (filas.length > MAX_FILAS) throw ApiError.badRequest(`Se permiten hasta ${MAX_FILAS} estudiantes por archivo`);
  const repetidos = (campo) => filas.filter((item, i) => item[campo] && filas.findIndex((otro) => otro[campo].toLowerCase() === item[campo].toLowerCase()) !== i);
  for (const campo of ["dni", "codigoEstudiante", "username"]) if (repetidos(campo).length) errores.push(`${campo} está repetido dentro del archivo`);
  if (errores.length) throw ApiError.badRequest(errores.slice(0, 12).join("; "));
  return filas;
};

const adminEstudiantesExcelService = {
  crearPlantilla,
  async importar(archivo, datos, actorId) {
    const anioAcademicoId = Number(datos.anioAcademicoId);
    const seccionId = Number(datos.seccionId);
    if (!Number.isInteger(anioAcademicoId) || !Number.isInteger(seccionId)) throw ApiError.badRequest("Selecciona año académico y sección");
    const filas = await leer(archivo?.buffer);
    const passwords = filas.map(() => generarPasswordTemporal());
    const hashes = await Promise.all(passwords.map((password) => bcrypt.hash(password, 10)));
    try {
      const credenciales = await prisma.$transaction(async (tx) => {
        const [anio, seccion] = await Promise.all([
          tx.anioAcademico.findUnique({ where: { id: anioAcademicoId } }),
          tx.seccion.findUnique({ where: { id: seccionId } }),
        ]);
        if (!anio) throw ApiError.notFound("Año académico no encontrado");
        if (!seccion || seccion.estado !== "ACTIVO") throw ApiError.badRequest("La sección no está activa");
        const existentes = await tx.perfilEstudiante.findMany({ where: { dni: { in: filas.map((item) => item.dni) } }, select: { dni: true } });
        if (existentes.length) throw ApiError.conflict(`Ya existen estudiantes con DNI: ${existentes.map((item) => item.dni).join(", ")}`);
        const usados = new Set();
        const resultado = [];
        for (const [indice, fila] of filas.entries()) {
          let base = fila.username ? slug(fila.username) : slug(`${fila.nombres.split(/\s+/)[0]}.${fila.apellidoPaterno}`);
          if (base.length < 3) base = `estudiante.${fila.dni}`;
          let username = base.slice(0, 40);
          let sufijo = 1;
          while (usados.has(username) || await tx.usuario.findUnique({ where: { username }, select: { id: true } })) {
            sufijo += 1;
            const cola = `.${sufijo}`;
            username = `${base.slice(0, 40 - cola.length)}${cola}`;
          }
          usados.add(username);
          const usuario = await tx.usuario.create({
            data: {
              username,
              nombres: `${fila.nombres} ${fila.apellidoPaterno} ${fila.apellidoMaterno}`,
              contrasena: hashes[indice], rol: "ESTUDIANTE", estado: "ACTIVO", debeCambiarPassword: true,
            },
          });
          await tx.perfilEstudiante.create({
            data: {
              usuarioId: usuario.id, dni: fila.dni, nombres: fila.nombres,
              apellidoPaterno: fila.apellidoPaterno, apellidoMaterno: fila.apellidoMaterno,
              codigoEstudiante: fila.codigoEstudiante || null, telefono: fila.telefono || null,
            },
          });
          await tx.matriculaAcademica.create({ data: { estudianteId: usuario.id, anioAcademicoId, seccionId } });
          await tx.auditoria.createMany({ data: [
            { usuarioActorId: actorId, usuarioObjetivoId: usuario.id, accion: "USER_CREATED", datos: { rol: "ESTUDIANTE", origen: "ADMIN_EXCEL" } },
            { usuarioActorId: actorId, usuarioObjetivoId: usuario.id, accion: "ACADEMIC_ENROLLMENT_CHANGED", datos: { anioAcademicoId, seccionId, origen: "ADMIN_EXCEL" } },
          ] });
          resultado.push({ usuarioId: usuario.id, username, contrasenaTemporal: passwords[indice] });
        }
        return resultado;
      });
      return { cantidadImportada: credenciales.length, credenciales };
    } catch (error) {
      if (error?.code === "P2002") throw ApiError.conflict("El archivo contiene un DNI, código o username ya registrado");
      throw error;
    }
  },
};

module.exports = adminEstudiantesExcelService;
