import { useState, useRef } from "react";

function TaskForm({ onAddTask }) {
  const [title, setTitle] = useState("");
  const [priority, setPriority] = useState("medium");
  const [dueDate, setDueDate] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState("Personal");
  const [imageFile, setImageFile] = useState(null);
  const [imagePreview, setImagePreview] = useState(null);
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const fileInputRef = useRef(null);

  const handleImageChange = (event) => {
    const file = event.target.files[0];
    if (!file) {
      setImageFile(null);
      setImagePreview(null);
      return;
    }

    if (!file.type.startsWith("image/")) {
      setError("Only image files (JPEG, PNG, GIF, WebP) are allowed.");
      if (fileInputRef.current) fileInputRef.current.value = "";
      return;
    }

    // 1MB limit check
    if (file.size > 1 * 1024 * 1024) {
      setError("Image size exceeds the 1MB limit. Please choose a smaller image.");
      if (fileInputRef.current) fileInputRef.current.value = "";
      return;
    }

    setError("");
    setImageFile(file);
    setImagePreview(URL.createObjectURL(file));
  };

  const removeImage = () => {
    setImageFile(null);
    setImagePreview(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

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
        category,
        imageFile
      );

      setTitle("");
      setPriority("medium");
      setDueDate("");
      setDescription("");
      setCategory("Personal");
      removeImage();
    } catch (err) {
      setError(err.message || "Unable to add task. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <section className="task-form-container">
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

          {/* Friendly custom image attachment field */}
          <div className="task-form-field file-upload-field">
            <label htmlFor="task-image">
              Image attachment <small>(Max 1MB, images only)</small>
            </label>
            <input
              id="task-image"
              type="file"
              accept="image/*"
              ref={fileInputRef}
              onChange={handleImageChange}
              disabled={isSubmitting}
              style={{ display: "none" }}
            />
            <div className="ty-file-picker-row">
              <button
                type="button"
                className="ty-file-choose-btn"
                onClick={() => fileInputRef.current?.click()}
                disabled={isSubmitting}
              >
                📎 Choose image
              </button>
              {imageFile ? (
                <span className="ty-file-chosen-name" title={imageFile.name}>
                  {imageFile.name}
                </span>
              ) : (
                <span className="ty-file-empty-note">No image selected</span>
              )}
            </div>

            {imagePreview && (
              <div className="task-image-preview-badge">
                <img src={imagePreview} alt="Selected preview" />
                <button
                  type="button"
                  onClick={removeImage}
                  className="task-image-remove-btn"
                  title="Remove image"
                >
                  ✕
                </button>
              </div>
            )}
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
