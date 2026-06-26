const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const multer = require("multer");
const ApiError = require("../utils/ApiError");

const UPLOAD_ROOT = path.join(process.cwd(), "uploads", "planes-curriculares");
const MAX_FILE_SIZE_BYTES =
  Number(process.env.PLAN_CURRICULAR_MAX_MB || 10) * 1024 * 1024;

const ensureUploadDir = (cursoId) => {
  const dir = path.join(UPLOAD_ROOT, String(cursoId));
  fs.mkdirSync(dir, { recursive: true });
  return dir;
};

const sanitizeOriginalName = (nombre) =>
  path.basename(String(nombre || "plan.pdf")).replace(/[^\w.\-() áéíóúñÁÉÍÓÚÑ]/gi, "_");

const storage = multer.diskStorage({
  destination: (req, _file, cb) => {
    try {
      const cursoId = req.params.cursoId ?? req.params.id;
      const dir = ensureUploadDir(cursoId);
      cb(null, dir);
    } catch (error) {
      cb(error);
    }
  },
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase() || ".pdf";
    const base = crypto.randomUUID();
    cb(null, `${base}${ext === ".pdf" ? ext : ".pdf"}`);
  },
});

const fileFilter = (_req, file, cb) => {
  const mime = String(file.mimetype || "").toLowerCase();
  const ext = path.extname(file.originalname || "").toLowerCase();

  if (mime === "application/pdf" && ext === ".pdf") {
    return cb(null, true);
  }

  cb(ApiError.badRequest("Solo se permiten archivos PDF"));
};

const uploadPlanPdf = multer({
  storage,
  fileFilter,
  limits: { fileSize: MAX_FILE_SIZE_BYTES, files: 1 },
});

module.exports = {
  UPLOAD_ROOT,
  MAX_FILE_SIZE_BYTES,
  sanitizeOriginalName,
  uploadPlanPdf,
};
