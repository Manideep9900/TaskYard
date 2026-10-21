const path = require("path");
require("dotenv").config({ path: path.join(__dirname, ".env") });
const pool = require("./db");

async function migrate() {
  console.log("Running migrations...");

  await pool.query(`
    ALTER TABLE users
      ADD COLUMN IF NOT EXISTS google_id TEXT,
      ADD COLUMN IF NOT EXISTS avatar_url TEXT,
      ADD COLUMN IF NOT EXISTS plan TEXT NOT NULL DEFAULT 'free',
      ADD COLUMN IF NOT EXISTS stripe_customer_id TEXT,
      ADD COLUMN IF NOT EXISTS tasks_created_this_month INT NOT NULL DEFAULT 0,
      ADD COLUMN IF NOT EXISTS month_reset_at TIMESTAMPTZ NOT NULL DEFAULT date_trunc('month', now());
  `);

  // Add unique constraints only if they don't exist
  await pool.query(`
    DO $$
    BEGIN
      IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'users_google_id_key') THEN
        ALTER TABLE users ADD CONSTRAINT users_google_id_key UNIQUE (google_id);
      END IF;
      IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'users_stripe_customer_id_key') THEN
        ALTER TABLE users ADD CONSTRAINT users_stripe_customer_id_key UNIQUE (stripe_customer_id);
      END IF;
    END
    $$;
  `);

  await pool.query(`
    ALTER TABLE tasks
      ADD COLUMN IF NOT EXISTS labels TEXT[] DEFAULT '{}',
      ADD COLUMN IF NOT EXISTS image_url TEXT;
  `);

  // Make password nullable for Google-only users
  await pool.query(`
    ALTER TABLE users ALTER COLUMN password DROP NOT NULL;
  `);

  // Upgrade 3: PostgreSQL BYTEA storage for task images with ON DELETE CASCADE
  await pool.query(`
    CREATE TABLE IF NOT EXISTS task_images (
      task_id    INTEGER PRIMARY KEY REFERENCES tasks(id) ON DELETE CASCADE,
      mime_type  TEXT    NOT NULL,
      size_bytes INTEGER NOT NULL,
      data       BYTEA   NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );
  `);

  console.log("Migrations complete!");
  process.exit(0);
}

migrate().catch((err) => {
  console.error("Migration failed:", err);
  process.exit(1);
});

