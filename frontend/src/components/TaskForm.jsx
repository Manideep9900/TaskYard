import { useState } from "react";

function TaskForm({ onAddTask }) {
  const [title, setTitle] = useState("");
  const [priority, setPriority] = useState("medium");
  const [dueDate, setDueDate] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState("Personal");
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (event) => {
    event.preventDefault();

    if (isSubmitting) return;

    if (!title.trim()) {
      setError("Please enter a task.");
      return;
    }

    setError("");
    setIsSubmitting(true);

    try {
      await onAddTask(
        title.trim(),
        priority,
        dueDate,
        description.trim(),
        category
      );

      setTitle("");
      setPriority("medium");
      setDueDate("");
      setDescription("");
      setCategory("Personal");
    } catch (error) {
      setError(error.message || "Unable to add task. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <section className="task-form-container">
      <div className="task-form-heading">
        <div>
          <p className="section-eyebrow">MAKE IT HAPPEN</p>
          <h2>Create a task</h2>
          <p>Add the next thing you want to get done.</p>
        </div>

        <span className="task-form-icon" aria-hidden="true">
          +
        </span>
      </div>

      <form className="task-form" onSubmit={handleSubmit}>
        <div className="task-form-main">
          <div className="task-form-field title-field">
            <label htmlFor="task-title">Task title</label>
            <input
              id="task-title"
              type="text"
              placeholder="What do you need to accomplish?"
              value={title}
              onChange={(event) => {
                setTitle(event.target.value);
                setError("");
              }}
              disabled={isSubmitting}
              maxLength={200}
            />
          </div>

          <div className="task-form-field description-field">
            <label htmlFor="task-description">Description</label>
            <textarea
              id="task-description"
              placeholder="Add some details (optional)"
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              disabled={isSubmitting}
              rows={3}
            />
          </div>
        </div>

        <div className="task-form-options">
          <div className="task-form-field">
            <label htmlFor="task-priority">Priority</label>
            <select
              id="task-priority"
              value={priority}
              onChange={(event) => setPriority(event.target.value)}
              disabled={isSubmitting}
            >
              <option value="low">Low</option>
              <option value="medium">Medium</option>
              <option value="high">High</option>
            </select>
          </div>

          <div className="task-form-field">
            <label htmlFor="task-category">Category</label>
            <select
              id="task-category"
              value={category}
              onChange={(event) => setCategory(event.target.value)}
              disabled={isSubmitting}
            >
              <option value="Personal">Personal</option>
              <option value="College">College</option>
              <option value="Work">Work</option>
              <option value="Project">Project</option>
            </select>
          </div>

          <div className="task-form-field">
            <label htmlFor="task-due-date">Due date</label>
            <input
              id="task-due-date"
              type="date"
              value={dueDate}
              onChange={(event) => setDueDate(event.target.value)}
              disabled={isSubmitting}
            />
          </div>
        </div>

        <button
          className="task-submit-button"
          type="submit"
          disabled={isSubmitting}
        >
          <span aria-hidden="true">{isSubmitting ? "◌" : "+"}</span>
          {isSubmitting ? "Adding task..." : "Add task"}
        </button>
      </form>

      {error && (
        <p className="form-error" role="alert">
          {error}
        </p>
      )}
    </section>
  );
}

export default TaskForm;
