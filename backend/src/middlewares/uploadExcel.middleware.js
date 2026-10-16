const multer = require("multer");
const ApiError = require("../utils/ApiError");

const MAX_EXCEL_SIZE_BYTES = 2 * 1024 * 1024;

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_EXCEL_SIZE_BYTES, files: 1 },
  fileFilter: (_req, file, cb) => {
    const nombre = String(file.originalname || "").toLowerCase();
    if (nombre.endsWith(".xlsx")) return cb(null, true);
    return cb(ApiError.badRequest("El archivo debe tener formato .xlsx"));
  },
});

const subirExcelEstudiantes = (req, res, next) => {
  upload.single("archivo")(req, res, (error) => {
    if (error instanceof multer.MulterError) {
      if (error.code === "LIMIT_FILE_SIZE") {
        return next(ApiError.badRequest("El archivo Excel no puede superar 2 MB"));
      }
      return next(ApiError.badRequest(error.message));
    }
    if (error) return next(error);
    return next();
  });
};

module.exports = subirExcelEstudiantes;
