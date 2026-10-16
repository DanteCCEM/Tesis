const ExcelJS = require("exceljs");
const bcrypt = require("bcryptjs");
const prisma = require("../config/prisma");
const ApiError = require("../utils/ApiError");

const MAX_ESTUDIANTES = 500;
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const COLUMNAS = ["nombres", "correo", "contrasena"];

const textoCelda = (celda) => {
  const valor = celda?.value;
  if (valor == null) return "";
  if (typeof valor === "object") {
    if (valor.text) return String(valor.text).trim();
    if (Array.isArray(valor.richText)) {
      return valor.richText.map((item) => item.text || "").join("").trim();
    }
  }
  return String(valor).trim();
};

const normalizarEncabezado = (valor) =>
  String(valor || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLowerCase();

const crearPlantilla = async () => {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "EvaluaIA";
  workbook.created = new Date();

  const hoja = workbook.addWorksheet("Estudiantes", {
    views: [{ state: "frozen", ySplit: 1 }],
  });
  hoja.columns = [
    { header: "nombres", key: "nombres", width: 36 },
    { header: "correo", key: "correo", width: 38 },
    { header: "contrasena", key: "contrasena", width: 24 },
  ];
  hoja.getRow(1).height = 24;
  hoja.getRow(1).eachCell((cell) => {
    cell.font = { bold: true, color: { argb: "FFFFFFFF" } };
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF2563EB" } };
    cell.alignment = { vertical: "middle" };
  });
  hoja.autoFilter = "A1:C1";
  hoja.getColumn("correo").numFmt = "@";
  hoja.getColumn("contrasena").numFmt = "@";
  hoja.dataValidations.add("A2:A501", {
    type: "textLength",
    operator: "between",
    allowBlank: false,
    formulae: [2, 120],
    showErrorMessage: true,
    errorTitle: "Nombre inválido",
    error: "Ingresa el nombre completo del estudiante.",
  });
  hoja.dataValidations.add("C2:C501", {
    type: "textLength",
    operator: "greaterThanOrEqual",
    allowBlank: false,
    formulae: [6],
    showErrorMessage: true,
    errorTitle: "Contraseña inválida",
    error: "La contraseña debe tener al menos 6 caracteres.",
  });

  const instrucciones = workbook.addWorksheet("Instrucciones");
  instrucciones.columns = [{ width: 110 }];
  [
    "INSTRUCCIONES PARA IMPORTAR ESTUDIANTES",
    "1. Completa una fila por estudiante en la hoja Estudiantes.",
    "2. No cambies los encabezados: nombres, correo y contrasena.",
    "3. La contraseña debe tener al menos 6 caracteres.",
    "4. No repitas correos dentro del archivo.",
    "5. El correo no debe pertenecer a un usuario ya registrado.",
    `6. Puedes importar hasta ${MAX_ESTUDIANTES} estudiantes por archivo.`,
    "7. Guarda el archivo con formato .xlsx antes de subirlo.",
  ].forEach((mensaje, index) => {
    const cell = instrucciones.getCell(index + 1, 1);
    cell.value = mensaje;
    cell.alignment = { wrapText: true, vertical: "top" };
    if (index === 0) cell.font = { bold: true, size: 14, color: { argb: "FF1E3A8A" } };
  });

  return workbook.xlsx.writeBuffer();
};

const leerEstudiantes = async (buffer) => {
  if (!buffer?.length) throw ApiError.badRequest("Debes seleccionar un archivo Excel");

  const workbook = new ExcelJS.Workbook();
  try {
    await workbook.xlsx.load(buffer);
  } catch {
    throw ApiError.badRequest("No se pudo leer el archivo. Verifica que sea un .xlsx válido");
  }

  const hoja = workbook.getWorksheet("Estudiantes") || workbook.worksheets[0];
  if (!hoja) throw ApiError.badRequest("El archivo Excel no contiene hojas");

  const encabezados = [1, 2, 3].map((columna) =>
    normalizarEncabezado(textoCelda(hoja.getCell(1, columna))),
  );
  if (COLUMNAS.some((columna, index) => encabezados[index] !== columna)) {
    throw ApiError.badRequest(
      'La primera fila debe contener exactamente: "nombres", "correo" y "contrasena"',
    );
  }

  const estudiantes = [];
  const errores = [];
  hoja.eachRow((row, numeroFila) => {
    if (numeroFila === 1) return;
    const nombres = textoCelda(row.getCell(1));
    const correo = textoCelda(row.getCell(2)).toLowerCase();
    const contrasena = textoCelda(row.getCell(3));
    if (!nombres && !correo && !contrasena) return;

    const erroresFila = [];
    if (nombres.length < 2 || nombres.length > 120) erroresFila.push("nombres inválidos");
    if (!EMAIL_REGEX.test(correo)) erroresFila.push("correo inválido");
    if (contrasena.length < 6) erroresFila.push("contraseña menor a 6 caracteres");
    if (erroresFila.length) errores.push(`Fila ${numeroFila}: ${erroresFila.join(", ")}`);
    estudiantes.push({ fila: numeroFila, nombres, correo, contrasena });
  });

  if (!estudiantes.length) throw ApiError.badRequest("La plantilla no contiene estudiantes");
  if (estudiantes.length > MAX_ESTUDIANTES) {
    throw ApiError.badRequest(`Solo se permiten ${MAX_ESTUDIANTES} estudiantes por archivo`);
  }

  const filasPorCorreo = new Map();
  for (const estudiante of estudiantes) {
    const filas = filasPorCorreo.get(estudiante.correo) || [];
    filas.push(estudiante.fila);
    filasPorCorreo.set(estudiante.correo, filas);
  }
  for (const [correo, filas] of filasPorCorreo) {
    if (filas.length > 1) errores.push(`Correo repetido "${correo}" en filas ${filas.join(", ")}`);
  }

  if (errores.length) {
    const visibles = errores.slice(0, 8);
    const adicionales = errores.length - visibles.length;
    throw ApiError.badRequest(
      `Corrige el archivo: ${visibles.join("; ")}${adicionales > 0 ? `; y ${adicionales} error(es) más` : ""}`,
    );
  }
  return estudiantes;
};

const estudiantesExcelService = {
  crearPlantilla,

  async importar(cursoId, docenteId, archivo) {
    const curso = await prisma.curso.findUnique({ where: { id: cursoId } });
    if (!curso) throw ApiError.notFound("Curso no encontrado");
    if (curso.docenteId !== docenteId) {
      throw ApiError.forbidden("No eres el propietario de este curso");
    }

    const estudiantes = await leerEstudiantes(archivo?.buffer);
    const correos = estudiantes.map((estudiante) => estudiante.correo);
    const existentes = await prisma.usuario.findMany({
      where: {
        OR: correos.map((correo) => ({
          correo: { equals: correo, mode: "insensitive" },
        })),
      },
      select: { correo: true },
    });
    if (existentes.length) {
      const lista = existentes.map((usuario) => usuario.correo).sort().join(", ");
      throw ApiError.conflict(`No se importó el archivo. Estos correos ya están registrados: ${lista}`);
    }

    const datos = await Promise.all(
      estudiantes.map(async ({ nombres, correo, contrasena }) => ({
        nombres,
        correo,
        contrasena: await bcrypt.hash(contrasena, 10),
      })),
    );

    try {
      await prisma.$transaction(async (tx) => {
        for (const estudiante of datos) {
          const usuario = await tx.usuario.create({
            data: { ...estudiante, rol: "ESTUDIANTE" },
          });
          await tx.matricula.create({ data: { cursoId, estudianteId: usuario.id } });
        }
      });
    } catch (error) {
      if (error?.code === "P2002") {
        throw ApiError.conflict(
          "No se importó el archivo porque uno de los estudiantes ya existe o está repetido",
        );
      }
      throw error;
    }

    return { cantidadImportada: estudiantes.length };
  },
};

module.exports = estudiantesExcelService;
