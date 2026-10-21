const express = require("express");
const router = express.Router();
const path = require("path");
const fs = require("fs");

const pool = require("../db");
const authMiddleware = require("../middleware/authMiddleware");
const usageLimit = require("../middleware/usageLimit");
const upload = require("../middleware/upload");

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

// Helper: delete an image file from disk
function deleteImageFile(imageUrl) {
  if (!imageUrl) return;
  try {
    const filename = imageUrl.split("/uploads/")[1];
    if (filename) {
      const filePath = path.join(__dirname, "..", "uploads", filename);
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
      }
    }
  } catch (err) {
    console.error("Error deleting image file:", err);
  }
}

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
      "SELECT * FROM tasks WHERE user_id = $1 ORDER BY id DESC",
      [req.user.id]
    );

    res.json(result.rows);
  } catch (error) {
    console.error("Get tasks error:", error);
    res.status(500).json({ message: "Unable to load tasks." });
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
          return res.status(400).json({ message: "Image must be under 1MB." });
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
      if (req.file) deleteImageFile(`/uploads/${req.file.filename}`);
      return res.status(400).json({
        message: "Task title is required.",
      });
    }

    if (title.trim().length > 200) {
      if (req.file) deleteImageFile(`/uploads/${req.file.filename}`);
      return res.status(400).json({
        message: "Task title cannot exceed 200 characters.",
      });
    }

    if (!VALID_PRIORITIES.includes(priority)) {
      if (req.file) deleteImageFile(`/uploads/${req.file.filename}`);
      return res.status(400).json({
        message: "Priority must be low, medium, or high.",
      });
    }

    if (!VALID_CATEGORIES.includes(category)) {
      if (req.file) deleteImageFile(`/uploads/${req.file.filename}`);
      return res.status(400).json({
        message: "Please select a valid category.",
      });
    }

    if (!VALID_STATUSES.includes(status)) {
      if (req.file) deleteImageFile(`/uploads/${req.file.filename}`);
      return res.status(400).json({
        message: "Status must be todo, in_progress, or done.",
      });
    }

    if (typeof description !== "string" || description.length > 5000) {
      if (req.file) deleteImageFile(`/uploads/${req.file.filename}`);
      return res.status(400).json({
        message: "Description must be text and cannot exceed 5000 characters.",
      });
    }

    if (!isValidDate(due_date)) {
      if (req.file) deleteImageFile(`/uploads/${req.file.filename}`);
      return res.status(400).json({
        message: "Please provide a valid due date.",
      });
    }

    const client = await pool.connect();
    let savedTask;

    try {
      await client.query("BEGIN");

      // Atomically check and reserve monthly creation quota
      const slot = await client.query(RESERVE_TASK_SLOT_SQL, [req.user.id]);
      if (slot.rowCount === 0) {
        await client.query("ROLLBACK");
        if (req.file) deleteImageFile(`/uploads/${req.file.filename}`);
        return res.status(403).json({
          code: "TASK_LIMIT_REACHED",
          message: "Monthly task limit reached. Upgrade to Premium to create more.",
        });
      }

      // Handle image attachment
      let imageUrl = null;
      if (req.file) {
        imageUrl = `/uploads/${req.file.filename}`;
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
          imageUrl,
        ]
      );
      savedTask = result.rows[0];

      await client.query("COMMIT");
    } catch (error) {
      await client.query("ROLLBACK").catch(() => {});
      if (req.file) {
        deleteImageFile(`/uploads/${req.file.filename}`);
      }
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

// DELETE a task belonging to the logged-in user + automatic cleanup of image
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

    // Automatic cleanup: delete the task's image from disk if one exists
    const deletedTask = result.rows[0];
    if (deletedTask.image_url) {
      deleteImageFile(deletedTask.image_url);
    }

    res.json(deletedTask);
  } catch (error) {
    console.error("Delete task error:", error);
    res.status(500).json({ message: "Unable to delete task." });
  }
});

module.exports = router;
