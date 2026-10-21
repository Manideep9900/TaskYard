import { useState } from "react";
import { Link } from "react-router-dom";
import AuthImage from "./AuthImage";

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:3000";

function TaskItem({ task, onComplete, onDelete, onUpdate }) {
  const [editing, setEditing] = useState(false);
  const [title, setTitle] = useState(task.title);

  const handleUpdate = () => {
    if (!title.trim()) return;

    onUpdate(task.id, title.trim());
    setEditing(false);
  };

  const handleCancel = () => {
    setTitle(task.title);
    setEditing(false);
  };

  const dueDate = task.due_date ? task.due_date.slice(0, 10) : "";

  const isOverdue =
    dueDate &&
    !task.completed &&
    dueDate < new Date().toLocaleDateString("en-CA");

  return (
    <article
      className={`task-item task-card ${
        task.completed ? "task-card-completed" : ""
      }`}
    >
      <div className="task-card-check">
        <input
          type="checkbox"
          checked={Boolean(task.completed)}
          onChange={() => onComplete(task)}
          aria-label={`Mark ${task.title} as ${
            task.completed ? "incomplete" : "complete"
          }`}
        />
      </div>

      <div className="task-card-content">
        {editing ? (
          <input
            className="edit-input"
            type="text"
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") handleUpdate();
              if (event.key === "Escape") handleCancel();
            }}
            aria-label="Edit task title"
            autoFocus
          />
        ) : (
          <>
            <h3 className={task.completed ? "completed" : ""}>
              <Link to={`/task/${task.id}`} className="task-title-link">
                {task.title}
              </Link>
            </h3>

            {task.description && (
              <p className="task-description">{task.description}</p>
            )}
          </>
        )}

        {/* AI Labels */}
        {task.labels && task.labels.length > 0 && (
          <div className="task-item-labels">
            {task.labels.map((label, index) => (
              <span key={index} className="task-ai-label-pill">
                🏷️ {label}
              </span>
            ))}
          </div>
        )}

        {/* Image Attachment thumbnail */}
        {(task.has_image || task.image_url) && (
          <div className="task-item-image-wrap">
            <Link to={`/task/${task.id}`} title="View image">
              <AuthImage
                taskId={task.id}
                alt={task.title}
                className="task-item-thumbnail"
              />
            </Link>
          </div>
        )}

        <div className="task-card-meta">
          <span
            className={`priority priority-${(
              task.priority || "medium"
            ).toLowerCase()}`}
          >
            {task.priority || "Medium"}
          </span>

          {task.category && (
            <span className="category">{task.category}</span>
          )}

          {dueDate && (
            <span className={`due-date ${isOverdue ? "due-date-overdue" : ""}`}>
              {isOverdue ? "Overdue · " : "Due · "}
              {dueDate}
            </span>
          )}

          {task.completed && (
            <span className="task-completed-badge">✓ Completed</span>
          )}
        </div>
      </div>

      <div className="task-actions">
        {editing ? (
          <>
            <button
              type="button"
              className="task-action-save"
              onClick={handleUpdate}
            >
              Save
            </button>

            <button type="button" onClick={handleCancel}>
              Cancel
            </button>
          </>
        ) : (
          <button
            type="button"
            className="task-action-edit"
            onClick={() => {
              setTitle(task.title);
              setEditing(true);
            }}
          >
            Edit
          </button>
        )}

        <button
          type="button"
          className="delete-button"
          onClick={() => onDelete(task.id)}
        >
          Delete
        </button>
      </div>
    </article>
  );
}

export default TaskItem;
