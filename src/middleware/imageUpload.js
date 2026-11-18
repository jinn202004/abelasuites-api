const multer = require("multer");

const MAX_IMAGE_BYTES = 8 * 1024 * 1024;

const imageUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_IMAGE_BYTES },
  fileFilter(_req, file, cb) {
    const mime = String(file.mimetype || "").toLowerCase();
    if (mime.startsWith("image/")) return cb(null, true);
    const err = new Error("Only image files are allowed");
    err.status = 400;
    return cb(err);
  },
});

module.exports = { imageUpload, MAX_IMAGE_BYTES };
