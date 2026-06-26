const fs = require("fs/promises");
const path = require("path");
const { PDFParse } = require("pdf-parse");
const ApiError = require("../utils/ApiError");
const { MAX_FILE_SIZE_BYTES } = require("../config/upload");

const MIN_TEXT_LENGTH = Number(process.env.PDF_MIN_TEXT_CHARS || 80);
const MAX_TEXTO_IA = Number(process.env.PDF_IA_MAX_CHARS || 50000);

const normalizarEspacios = (texto) =>
  String(texto ?? "")
    .replace(/\u0000/g, "")
    .replace(/\s+/g, " ")
    .trim();

const truncarParaIA = (texto) => {
  if (texto.length <= MAX_TEXTO_IA) {
    return { texto, truncado: false, caracteresOriginales: texto.length };
  }
  return {
    texto: texto.slice(0, MAX_TEXTO_IA),
    truncado: true,
    caracteresOriginales: texto.length,
  };
};

const pdfExtractService = {
  MIN_TEXT_LENGTH,
  MAX_TEXTO_IA,

  async extraerTextoDesdeBuffer(buffer) {
    if (!buffer || buffer.length === 0) {
      throw ApiError.badRequest("El archivo PDF está vacío");
    }

    if (buffer.length > MAX_FILE_SIZE_BYTES) {
      throw ApiError.badRequest(
        "El PDF supera el tamaño máximo permitido para procesamiento",
      );
    }

    let parser;
    try {
      parser = new PDFParse({ data: buffer });
      const result = await parser.getText();
      await parser.destroy();

      const texto = normalizarEspacios(result?.text);
      if (texto.length < MIN_TEXT_LENGTH) {
        throw ApiError.badRequest(
          "El PDF no contiene texto seleccionable suficiente. Sube un PDF con texto digital o aplica OCR antes de procesarlo",
        );
      }

      return truncarParaIA(texto);
    } catch (error) {
      if (parser) {
        await parser.destroy().catch(() => {});
      }
      if (error instanceof ApiError) {
        throw error;
      }
      throw ApiError.badRequest(
        "No se pudo extraer texto del PDF. Verifica que el archivo no esté dañado",
      );
    }
  },

  async extraerTextoDesdeArchivo(rutaArchivo) {
    if (!rutaArchivo || !String(rutaArchivo).trim()) {
      throw ApiError.badRequest("El plan no tiene un archivo PDF asociado");
    }

    const rutaAbsoluta = path.resolve(rutaArchivo);

    try {
      const stats = await fs.stat(rutaAbsoluta);
      if (!stats.isFile()) {
        throw ApiError.notFound("No se encontró el archivo PDF del plan curricular");
      }
      if (stats.size > MAX_FILE_SIZE_BYTES) {
        throw ApiError.badRequest(
          "El PDF supera el tamaño máximo permitido para procesamiento",
        );
      }

      const buffer = await fs.readFile(rutaAbsoluta);
      return this.extraerTextoDesdeBuffer(buffer);
    } catch (error) {
      if (error instanceof ApiError) {
        throw error;
      }
      if (error?.code === "ENOENT") {
        throw ApiError.notFound("No se encontró el archivo PDF del plan curricular");
      }
      throw ApiError.badRequest("No se pudo leer el archivo PDF del plan");
    }
  },
};

module.exports = pdfExtractService;
