const fs = require("fs");
const path = require("path");
require("dotenv").config({ path: path.join(__dirname, "..", ".env") });
const pool = require("../db");

function detectImageType(b) {
  if (b.length >= 3 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return "image/jpeg";
  if (b.length >= 8 && b.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return "image/png";
  const h = b.subarray(0, 6).toString("latin1");
  if (h === "GIF87a" || h === "GIF89a") return "image/gif";
  if (b.length >= 12 && b.subarray(0, 4).toString("latin1") === "RIFF" && b.subarray(8, 12).toString("latin1") === "WEBP") return "image/webp";
  return null;
}

async function importImages() {
  console.log("Checking for tasks with image_url to import into task_images table...");
  const res = await pool.query("SELECT id, image_url FROM tasks WHERE image_url IS NOT NULL AND image_url != ''");
  console.log(`Found ${res.rows.length} tasks with image_url.`);

  for (const row of res.rows) {
    const filename = path.basename(row.image_url);
    const filePath = path.join(__dirname, "..", "uploads", filename);

    if (fs.existsSync(filePath)) {
      const buffer = fs.readFileSync(filePath);
      const mimeType = detectImageType(buffer) || "image/jpeg";
      await pool.query(
        `INSERT INTO task_images (task_id, mime_type, size_bytes, data)
         VALUES ($1, $2, $3, $4)
         ON CONFLICT (task_id) DO UPDATE SET
           mime_type = EXCLUDED.mime_type,
           size_bytes = EXCLUDED.size_bytes,
           data = EXCLUDED.data`,
        [row.id, mimeType, buffer.length, buffer]
      );
      await pool.query("UPDATE tasks SET image_url = NULL WHERE id = $1", [row.id]);
      console.log(`Imported image for task ${row.id} (${buffer.length} bytes, ${mimeType})`);
    } else {
      console.log(`File not found for task ${row.id}: ${filePath}`);
    }
  }

  console.log("Image migration completed!");
}

importImages()
  .catch(console.error)
  .finally(() => pool.end());
