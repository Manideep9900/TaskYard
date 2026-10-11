const express = require("express");
const router = express.Router();
 
const pool = require("../db");
const authMiddleware = require("../middleware/authMiddleware");
 
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
 
// POST create a task
router.post("/", authMiddleware, async (req, res) => {
  try {
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
 
    const result = await pool.query(
      `INSERT INTO tasks
        (title, user_id, priority, due_date, description, category, status, completed)
       VALUES ($1, $2, $3, $4, $5, $6, $7::text, ($7::text = 'done'))
       RETURNING *`,
      [
        title.trim(),
        req.user.id,
        priority,
        due_date || null,
        description,
        category,
        status,
      ]
    );
 
    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error("Create task error:", error);
    res.status(500).json({ message: "Unable to create task." });
  }
});
 
// PUT update task title, completion status, and priority
// Keeps the Kanban "status" column in sync with the "completed" checkbox.
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
 
// DELETE a task belonging to the logged-in user
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