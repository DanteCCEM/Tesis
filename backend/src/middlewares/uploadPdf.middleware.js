const multer = require("multer");
const ApiError = require("../utils/ApiError");
const { uploadPlanPdf } = require("../config/upload");

const manejarErrorMulter = (error, _req, _res, next) => {
  if (error instanceof multer.MulterError) {
    if (error.code === "LIMIT_FILE_SIZE") {
      return next(
        ApiError.badRequest(
          "El archivo PDF supera el tamaño máximo permitido",
        ),
      );
    }
    if (error.code === "LIMIT_UNEXPECTED_FILE") {
      return next(
        ApiError.badRequest('El archivo debe enviarse en el campo "archivo"'),
      );
    }
    return next(ApiError.badRequest(error.message));
  }

  return next(error);
};

const subirPdfPlan = (req, res, next) => {
  uploadPlanPdf.single("archivo")(req, res, (error) => {
    if (error) {
      return manejarErrorMulter(error, req, res, next);
    }
    next();
  });
};

module.exports = subirPdfPlan;
