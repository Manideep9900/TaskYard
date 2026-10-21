const multer = require("multer");

const TYPES = ["image/jpeg", "image/png", "image/gif", "image/webp"];

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 1_000_000, files: 1 },
  fileFilter: (req, file, cb) =>
    TYPES.includes(file.mimetype)
      ? cb(null, true)
      : cb(
          Object.assign(
            new Error("Only JPEG, PNG, GIF or WebP images are allowed."),
            { status: 400 }
          )
        ),
});

// The browser-declared type can be faked, so also check the real file signature.
function detectImageType(b) {
  if (!b || b.length < 4) return null;
  if (b.length >= 3 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) {
    return "image/jpeg";
  }
  if (
    b.length >= 8 &&
    b.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))
  ) {
    return "image/png";
  }
  const h = b.subarray(0, 6).toString("latin1");
  if (h === "GIF87a" || h === "GIF89a") {
    return "image/gif";
  }
  if (
    b.length >= 12 &&
    b.subarray(0, 4).toString("latin1") === "RIFF" &&
    b.subarray(8, 12).toString("latin1") === "WEBP"
  ) {
    return "image/webp";
  }
  return null;
}

module.exports = { upload, detectImageType };
