import { useEffect, useState } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import { apiRequest } from "../api";

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:3000";

function TaskDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [task, setTask] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [labelsLoading, setLabelsLoading] = useState(false);
  const [statusMessage, setStatusMessage] = useState("");

  useEffect(() => {
    apiRequest("/tasks")
      .then((tasks) => {
        const allTasks = Array.isArray(tasks) ? tasks : tasks?.tasks || [];
        const found = allTasks.find((t) => String(t.id) === String(id));
        if (found) {
          setTask(found);
        } else {
          setError("Task not found.");
        }
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, [id]);

  const handleRegenerateLabels = async () => {
    setLabelsLoading(true);
    setStatusMessage("");
    setError("");
    try {
      const updated = await apiRequest(`/tasks/${id}/labels`, {
        method: "POST",
      });
      setTask(updated);
      setStatusMessage("AI labels updated successfully!");
      setTimeout(() => setStatusMessage(""), 3000);
    } catch (err) {
      setError(err.message || "Failed to generate labels.");
    } finally {
      setLabelsLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!window.confirm("Are you sure you want to delete this task? Its attachment will be permanently removed.")) {
      return;
    }

    try {
      await apiRequest(`/tasks/${id}`, { method: "DELETE" });
      navigate("/dashboard");
    } catch (err) {
      setError(err.message || "Failed to delete task.");
    }
  };

  const theme = localStorage.getItem("taskyard-theme") || "dark";

  if (loading) {
    return (
      <div className="ty-detail-page" data-theme={theme}>
        <div className="ty-detail-container">
          <p className="status-message">Loading task details…</p>
        </div>
      </div>
    );
  }

  if (error && !task) {
    return (
      <div className="ty-detail-page" data-theme={theme}>
        <div className="ty-detail-container">
          <Link to="/dashboard" className="ty-back-link">
            ← Back to Dashboard
          </Link>
          <p className="error-message ty-error">{error || "Task not found."}</p>
        </div>
      </div>
    );
  }

  const dueDate = task.due_date ? task.due_date.slice(0, 10) : "";
  const isOverdue =
    dueDate &&
    !task.completed &&
    dueDate < new Date().toLocaleDateString("en-CA");

  return (
    <div className="ty-detail-page" data-theme={theme}>
      <div className="ty-detail-container">
        <div className="ty-profile-nav">
          <Link to="/dashboard" className="ty-back-link">
            ← Back to Dashboard
          </Link>
        </div>

        {statusMessage && (
          <div className="success-notification" role="status" style={{ position: "relative", marginBottom: "16px", left: "auto", transform: "none" }}>
            ✓ &nbsp;{statusMessage}
          </div>
        )}

        {error && <p className="error-message ty-error">{error}</p>}

        <section className="ty-detail-header-card">
          <div className="ty-detail-title-row">
            <h1 className={task.completed ? "completed" : ""}>{task.title}</h1>
            <div className="ty-detail-badges">
              <span className={`priority priority-${(task.priority || "medium").toLowerCase()}`}>
                {task.priority || "Medium"}
              </span>
              {task.completed && (
                <span className="task-completed-badge">✓ Completed</span>
              )}
            </div>
          </div>

          <div className="ty-detail-meta-row">
            {task.category && (
              <span className="category">{task.category}</span>
            )}
            {dueDate && (
              <span className={`due-date ${isOverdue ? "due-date-overdue" : ""}`}>
                {isOverdue ? "Overdue · " : "Due · "}
                {dueDate}
              </span>
            )}
            <span className="ty-detail-status-pill">
              Status: <strong>{task.status || (task.completed ? "done" : "todo")}</strong>
            </span>
          </div>
        </section>

        {task.description && (
          <section className="ty-detail-section">
            <p className="ty-eyebrow">DESCRIPTION</p>
            <p className="ty-detail-desc">{task.description}</p>
          </section>
        )}

        {/* AI Labels Section */}
        <section className="ty-detail-section">
          <div className="ty-detail-labels-head">
            <div>
              <p className="ty-eyebrow">AI POWERED</p>
              <h2>Task Labels</h2>
            </div>
            <button
              className="ty-secondary-button"
              type="button"
              onClick={handleRegenerateLabels}
              disabled={labelsLoading}
            >
              {labelsLoading ? "Generating with OpenAI…" : "✨ Regenerate AI Labels"}
            </button>
          </div>

          <div className="task-labels-container">
            {task.labels && task.labels.length > 0 ? (
              task.labels.map((label, idx) => (
                <span key={idx} className="task-ai-label">
                  🏷️ {label}
                </span>
              ))
            ) : (
              <p className="ty-labels-empty">
                No labels generated yet. Click above to analyze this task with OpenAI.
              </p>
            )}
          </div>
        </section>

        {/* Image Attachment Section */}
        {task.image_url && (
          <section className="ty-detail-section">
            <p className="ty-eyebrow">ATTACHMENT</p>
            <h2>Attached Image</h2>
            <div className="ty-detail-image-box">
              <img
                src={`${API_URL}${task.image_url}`}
                alt="Task attachment"
                className="ty-detail-attachment"
              />
            </div>
          </section>
        )}

        {/* Actions */}
        <div className="ty-detail-actions-bar">
          <button className="delete-button ty-detail-delete-btn" onClick={handleDelete}>
            🗑️ Delete Task and Image
          </button>
        </div>
      </div>
    </div>
  );
}

export default TaskDetail;

