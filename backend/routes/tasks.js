const express = require("express");
const router = express.Router();

const pool = require("../db");
const authMiddleware = require("../middleware/authMiddleware");
const usageLimit = require("../middleware/usageLimit");
const { upload, detectImageType } = require("../middleware/upload");

const VALID_PRIORITIES = ["low", "medium", "high"];
const VALID_CATEGORIES = ["Personal", "College", "Work", "Project"];
const VALID_STATUSES = ["todo", "in_progress", "done"];

const isValidDate = (date) => {
  if (date === null || date === undefined || date === "") {
    return true;
  }

  if (typeof date !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return false;
  }

  const parsed = new Date(`${date}T00:00:00Z`);

  return (
    !Number.isNaN(parsed.getTime()) &&
    parsed.toISOString().slice(0, 10) === date
  );
};

const isValidTaskId = (id) => /^\d+$/.test(id) && Number(id) > 0;

function parseLabels(text) {
  const cleaned = String(text || "")
    .replace(/<think>[\s\S]*?<\/think>/gi, "")
    .replace(/```(?:json)?/gi, "")
    .trim();
  const match = cleaned.match(/\[[\s\S]*\]/);
  if (!match) return [];
  try {
    const arr = JSON.parse(match[0]);
    return [...new Set(arr.map((x) => String(x).toLowerCase().trim()).filter((x) => x && x.length <= 24))].slice(0, 3);
  } catch {
    return [];
  }
}

// Helper: generate AI labels using Groq or OpenAI with timeout & defensive parsing
async function generateLabels(title, description) {
  try {
    const OpenAI = require("openai");
    let client;
    let model;

    const groqKey = process.env.GROQ_API_KEY;
    const openaiKey = process.env.OPENAI_API_KEY;

    if (groqKey && groqKey !== "YOUR_GROQ_API_KEY_HERE") {
      client = new OpenAI({
        apiKey: groqKey,
        baseURL: "https://api.groq.com/openai/v1",
        timeout: 8000, // 8-second timeout
      });
      model = process.env.GROQ_MODEL || "qwen/qwen3.8-27b";
    } else if (openaiKey && openaiKey !== "YOUR_OPENAI_API_KEY_HERE") {
      client = new OpenAI({
        apiKey: openaiKey,
        timeout: 8000,
      });
      model = process.env.OPENAI_MODEL || "gpt-3.5-turbo";
    } else {
      return [];
    }

    const response = await client.chat.completions.create({
      model,
      messages: [
        {
          role: "system",
          content:
            'You are a helpful task labeling assistant. Given a task title and optional description, return 1-3 short, relevant labels as a JSON array of strings. Labels should be lowercase, 1-2 words each (e.g. ["urgent", "bug fix", "design", "research", "finance", "meeting", "writing"]). Return ONLY the raw JSON array of strings, without markdown backticks or commentary.',
        },
        {
          role: "user",
          content: `Title: ${title}${description ? `\nDescription: ${description}` : ""}`,
        },
      ],
      max_tokens: 60,
      temperature: 0.2,
    });

    const content = response.choices[0]?.message?.content?.trim() || "";
    return parseLabels(content);
  } catch (error) {
    console.error("AI label generation notice:", error.message);
    return [];
  }
}

// GET all tasks belonging to the logged-in user
router.get("/", authMiddleware, async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT tasks.*,
              EXISTS (SELECT 1 FROM task_images WHERE task_images.task_id = tasks.id) AS has_image,
              CASE WHEN EXISTS (SELECT 1 FROM task_images WHERE task_images.task_id = tasks.id)
                   THEN '/tasks/' || tasks.id || '/image'
                   ELSE NULL END AS image_url
       FROM tasks
       WHERE user_id = $1
       ORDER BY id DESC`,
      [req.user.id]
    );

    res.json(result.rows);
  } catch (error) {
    console.error("Get tasks error:", error);
    res.status(500).json({ message: "Unable to load tasks." });
  }
});

// GET single task by ID
router.get("/:id", authMiddleware, async (req, res) => {
  try {
    const { id } = req.params;
    if (!isValidTaskId(id)) {
      return res.status(400).json({ message: "Invalid task ID." });
    }

    const result = await pool.query(
      `SELECT tasks.*,
              EXISTS (SELECT 1 FROM task_images WHERE task_images.task_id = tasks.id) AS has_image,
              CASE WHEN EXISTS (SELECT 1 FROM task_images WHERE task_images.task_id = tasks.id)
                   THEN '/tasks/' || tasks.id || '/image'
                   ELSE NULL END AS image_url
       FROM tasks
       WHERE id = $1 AND user_id = $2`,
      [id, req.user.id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ message: "Task not found." });
    }

    res.json(result.rows[0]);
  } catch (error) {
    console.error("Get task by ID error:", error);
    res.status(500).json({ message: "Unable to load task." });
  }
});

const RESERVE_TASK_SLOT_SQL = `
  UPDATE users SET
    tasks_created_this_month = CASE WHEN month_reset_at < date_trunc('month', now())
                                    THEN 1 ELSE tasks_created_this_month + 1 END,
    month_reset_at           = CASE WHEN month_reset_at < date_trunc('month', now())
                                    THEN date_trunc('month', now()) ELSE month_reset_at END
  WHERE id = $1
    AND (CASE WHEN month_reset_at < date_trunc('month', now()) THEN 0
              ELSE tasks_created_this_month END)
        < (CASE WHEN plan = 'premium' THEN 10000 ELSE 100 END)
  RETURNING tasks_created_this_month;
`;

// POST create a task (with atomic slot reservation & transaction)
router.post(
  "/",
  authMiddleware,
  (req, res, next) => {
    // Multer middleware handles multipart/form-data
    upload.single("image")(req, res, (err) => {
      if (err) {
        if (err.code === "LIMIT_FILE_SIZE") {
          return res.status(413).json({ message: "Image must be 1 MB or smaller." });
        }
        return res.status(400).json({ message: err.message || "File upload failed." });
      }
      next();
    });
  },
  async (req, res) => {
    const {
      title,
      priority = "medium",
      due_date,
      description = "",
      category = "Personal",
      status = "todo",
    } = req.body;

    if (typeof title !== "string" || !title.trim()) {
      return res.status(400).json({
        message: "Task title is required.",
      });
    }

    if (title.trim().length > 200) {
      return res.status(400).json({
        message: "Task title cannot exceed 200 characters.",
      });
    }

    if (!VALID_PRIORITIES.includes(priority)) {
      return res.status(400).json({
        message: "Priority must be low, medium, or high.",
      });
    }

    if (!VALID_CATEGORIES.includes(category)) {
      return res.status(400).json({
        message: "Please select a valid category.",
      });
    }

    if (!VALID_STATUSES.includes(status)) {
      return res.status(400).json({
        message: "Status must be todo, in_progress, or done.",
      });
    }

    if (typeof description !== "string" || description.length > 5000) {
      return res.status(400).json({
        message: "Description must be text and cannot exceed 5000 characters.",
      });
    }

    if (!isValidDate(due_date)) {
      return res.status(400).json({
        message: "Please provide a valid due date.",
      });
    }

    // Check file magic bytes if uploaded
    let detectedMime = null;
    if (req.file) {
      detectedMime = detectImageType(req.file.buffer);
      if (!detectedMime) {
        return res.status(400).json({
          message: "Only JPEG, PNG, GIF or WebP images are allowed.",
        });
      }
    }

    const client = await pool.connect();
    let savedTask;

    try {
      await client.query("BEGIN");

      // Atomically check and reserve monthly creation quota
      const slot = await client.query(RESERVE_TASK_SLOT_SQL, [req.user.id]);
      if (slot.rowCount === 0) {
        await client.query("ROLLBACK");
        return res.status(403).json({
          code: "TASK_LIMIT_REACHED",
          message: "Monthly task limit reached. Upgrade to Premium to create more.",
        });
      }

      const result = await client.query(
        `INSERT INTO tasks
          (title, user_id, priority, due_date, description, category, status, completed, labels, image_url)
         VALUES ($1, $2, $3, $4, $5, $6, $7::text, ($7::text = 'done'), $8, $9)
         RETURNING *`,
        [
          title.trim(),
          req.user.id,
          priority,
          due_date || null,
          description,
          category,
          status,
          [], // initial labels empty, updated after commit
          null,
        ]
      );
      savedTask = result.rows[0];

      if (req.file) {
        await client.query(
          `INSERT INTO task_images (task_id, mime_type, size_bytes, data)
           VALUES ($1, $2, $3, $4)
           ON CONFLICT (task_id) DO UPDATE
           SET mime_type = EXCLUDED.mime_type,
               size_bytes = EXCLUDED.size_bytes,
               data = EXCLUDED.data,
               created_at = now()`,
          [savedTask.id, detectedMime, req.file.size, req.file.buffer]
        );

        const imgPath = `/tasks/${savedTask.id}/image`;
        await client.query("UPDATE tasks SET image_url = $1 WHERE id = $2", [imgPath, savedTask.id]);
        savedTask.image_url = imgPath;
        savedTask.has_image = true;
      } else {
        savedTask.has_image = false;
      }

      await client.query("COMMIT");
    } catch (error) {
      await client.query("ROLLBACK").catch(() => {});
      console.error("Create task transaction error:", error);
      return res.status(500).json({ message: "Unable to create task." });
    } finally {
      client.release();
    }

    // Run AI label call AFTER commit so slow Groq request never holds a DB lock
    generateLabels(title.trim(), description)
      .then(async (labels) => {
        if (Array.isArray(labels) && labels.length > 0) {
          await pool.query("UPDATE tasks SET labels = $1 WHERE id = $2", [labels, savedTask.id]);
        }
      })
      .catch((err) => console.error("AI label background update:", err.message));

    res.status(201).json(savedTask);
  }
);

// PUT update task title, completion status, and priority
router.put("/:id", authMiddleware, async (req, res) => {
  try {
    const { id } = req.params;
    const { title, completed, priority } = req.body;

    if (!isValidTaskId(id)) {
      return res.status(400).json({
        message: "Invalid task ID.",
      });
    }

    if (typeof title !== "string" || !title.trim()) {
      return res.status(400).json({
        message: "Task title is required.",
      });
    }

    if (title.trim().length > 200) {
      return res.status(400).json({
        message: "Task title cannot exceed 200 characters.",
      });
    }

    if (typeof completed !== "boolean") {
      return res.status(400).json({
        message: "Completed must be true or false.",
      });
    }

    if (!VALID_PRIORITIES.includes(priority)) {
      return res.status(400).json({
        message: "Priority must be low, medium, or high.",
      });
    }

    const result = await pool.query(
      `UPDATE tasks
       SET title = $1,
           completed = $2::boolean,
           priority = $3,
           status = CASE
             WHEN $2::boolean THEN 'done'
             WHEN status = 'done' THEN 'todo'
             ELSE status
           END
       WHERE id = $4 AND user_id = $5
       RETURNING *`,
      [title.trim(), completed, priority, id, req.user.id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        message: "Task not found.",
      });
    }

    res.json(result.rows[0]);
  } catch (error) {
    console.error("Update task error:", error);
    res.status(500).json({ message: "Unable to update task." });
  }
});

// PATCH move a task to another Kanban column
router.patch("/:id/status", authMiddleware, async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    if (!isValidTaskId(id)) {
      return res.status(400).json({
        message: "Invalid task ID.",
      });
    }

    if (!VALID_STATUSES.includes(status)) {
      return res.status(400).json({
        message: "Status must be todo, in_progress, or done.",
      });
    }

    const result = await pool.query(
      `UPDATE tasks
       SET status = $1::text,
           completed = ($1::text = 'done')
       WHERE id = $2 AND user_id = $3
       RETURNING *`,
      [status, id, req.user.id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        message: "Task not found.",
      });
    }

    res.json(result.rows[0]);
  } catch (error) {
    console.error("Update status error:", error);
    res.status(500).json({ message: "Unable to move task." });
  }
});

// POST regenerate AI labels for a task
router.post("/:id/labels", authMiddleware, async (req, res) => {
  try {
    const { id } = req.params;

    if (!isValidTaskId(id)) {
      return res.status(400).json({ message: "Invalid task ID." });
    }

    const taskResult = await pool.query(
      "SELECT * FROM tasks WHERE id = $1 AND user_id = $2",
      [id, req.user.id]
    );

    if (taskResult.rows.length === 0) {
      return res.status(404).json({ message: "Task not found." });
    }

    const task = taskResult.rows[0];
    const labels = await generateLabels(task.title, task.description);

    const result = await pool.query(
      "UPDATE tasks SET labels = $1 WHERE id = $2 AND user_id = $3 RETURNING *",
      [labels, id, req.user.id]
    );

    res.json(result.rows[0]);
  } catch (error) {
    console.error("Generate labels error:", error);
    res.status(500).json({ message: "Unable to generate labels." });
  }
});

// GET task image from BYTEA table task_images (private, owner-only)
router.get("/:id/image", authMiddleware, async (req, res) => {
  try {
    const { id } = req.params;
    if (!isValidTaskId(id)) {
      return res.status(400).json({ message: "Invalid task ID." });
    }

    const result = await pool.query(
      `SELECT ti.mime_type, ti.data
       FROM task_images ti
       JOIN tasks t ON t.id = ti.task_id
       WHERE ti.task_id = $1 AND t.user_id = $2`,
      [id, req.user.id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ message: "Image not found." });
    }

    const { mime_type, data } = result.rows[0];
    res.setHeader("Content-Type", mime_type);
    res.setHeader("Cache-Control", "private, max-age=3600");
    res.setHeader("X-Content-Type-Options", "nosniff");
    return res.send(data);
  } catch (error) {
    console.error("Get task image error:", error);
    res.status(500).json({ message: "Unable to load task image." });
  }
});

// DELETE remove image attachment from task without deleting the task
router.delete("/:id/image", authMiddleware, async (req, res) => {
  try {
    const { id } = req.params;
    if (!isValidTaskId(id)) {
      return res.status(400).json({ message: "Invalid task ID." });
    }

    const check = await pool.query(
      "SELECT id FROM tasks WHERE id = $1 AND user_id = $2",
      [id, req.user.id]
    );
    if (check.rows.length === 0) {
      return res.status(404).json({ message: "Task not found." });
    }

    await pool.query("DELETE FROM task_images WHERE task_id = $1", [id]);
    await pool.query("UPDATE tasks SET image_url = NULL WHERE id = $1", [id]);

    res.json({ message: "Image removed successfully.", taskId: Number(id) });
  } catch (error) {
    console.error("Delete task image error:", error);
    res.status(500).json({ message: "Unable to delete task image." });
  }
});

// DELETE a task belonging to the logged-in user (Postgres ON DELETE CASCADE cleans up task_images automatically)
router.delete("/:id", authMiddleware, async (req, res) => {
  try {
    const { id } = req.params;

    if (!isValidTaskId(id)) {
      return res.status(400).json({
        message: "Invalid task ID.",
      });
    }

    const result = await pool.query(
      "DELETE FROM tasks WHERE id = $1 AND user_id = $2 RETURNING *",
      [id, req.user.id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        message: "Task not found.",
      });
    }

    res.json(result.rows[0]);
  } catch (error) {
    console.error("Delete task error:", error);
    res.status(500).json({ message: "Unable to delete task." });
  }
});

module.exports = router;
