import { useEffect, useRef, useState } from "react";
import { Routes, Route, Navigate, useNavigate, Link } from "react-router-dom";
import "./App.css";
import TaskForm from "./components/TaskForm";
import TaskList from "./components/TaskList";
import KanbanBoard from "./components/kanbanboard";
import Auth from "./components/Auth";
import Profile from "./components/Profile";
import TaskDetail from "./components/TaskDetail";
import ProtectedRoute from "./components/ProtectedRoute";
import StickyNotesWidget from "./components/StickyNotesWidget";
import { apiRequest, apiUpload } from "./api";
import { getTaskStatus } from "./taskstatus";

function Dashboard({
  user,
  tasks,
  setTasks,
  loading,
  error,
  setError,
  successMessage,
  showSuccessMessage,
  logout,
  theme,
  toggleTheme,
}) {
  const tasksSectionRef = useRef(null);
  const searchInputRef = useRef(null);
  const navigate = useNavigate();

  useEffect(() => {
    const handleKeyDown = (e) => {
      // Ignore if user is already typing in an input or textarea
      if (
        e.target instanceof HTMLInputElement ||
        e.target instanceof HTMLTextAreaElement ||
        e.target instanceof HTMLSelectElement
      ) {
        return;
      }
      if (e.key === "/" || ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k")) {
        e.preventDefault();
        searchInputRef.current?.focus();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  const scrollToTasks = () => {
    setTimeout(() => {
      tasksSectionRef.current?.scrollIntoView({
        behavior: "smooth",
        block: "start",
      });
    }, 150);
  };

  const [filter, setFilter] = useState("all");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [search, setSearch] = useState("");
  const [sortBy, setSortBy] = useState("newest");
  const [showUpcomingOnly, setShowUpcomingOnly] = useState(false);
  const [showOverdueOnly, setShowOverdueOnly] = useState(false);
  const [view, setView] = useState("list");

  const addTask = async (title, priority, dueDate, description, category, imageFile) => {
    try {
      setError("");

      let newTask;
      if (imageFile) {
        const formData = new FormData();
        formData.append("title", title);
        formData.append("priority", priority);
        formData.append("due_date", dueDate);
        formData.append("description", description);
        formData.append("category", category);
        formData.append("image", imageFile);

        newTask = await apiUpload("/tasks", formData);
      } else {
        newTask = await apiRequest("/tasks", {
          method: "POST",
          body: JSON.stringify({
            title,
            priority,
            due_date: dueDate,
            description,
            category,
          }),
        });
      }

      setTasks((previousTasks) => [
        ...(Array.isArray(previousTasks) ? previousTasks : []),
        newTask,
      ]);

      showSuccessMessage("Task added successfully!");
    } catch (err) {
      console.error("Add task error:", err);
      setError(err.message || "Unable to add task. Please try again.");
      throw err;
    }
  };

  const completeTask = async (task) => {
    try {
      setError("");
      const updatedTask = await apiRequest(`/tasks/${task.id}`, {
        method: "PUT",
        body: JSON.stringify({
          title: task.title,
          completed: !task.completed,
          priority: task.priority,
        }),
      });

      setTasks((previousTasks) =>
        (Array.isArray(previousTasks) ? previousTasks : []).map((item) =>
          item.id === updatedTask.id ? updatedTask : item
        )
      );
      showSuccessMessage(
        updatedTask.completed ? "Task completed!" : "Task marked active."
      );
    } catch (err) {
      console.error("Complete task error:", err);
      setError(err.message || "Unable to update task.");
    }
  };

  const deleteTask = async (id) => {
    try {
      setError("");
      await apiRequest(`/tasks/${id}`, { method: "DELETE" });

      setTasks((previousTasks) =>
        (Array.isArray(previousTasks) ? previousTasks : []).filter(
          (task) => task.id !== id
        )
      );
      showSuccessMessage("Task deleted successfully!");
    } catch (err) {
      console.error("Delete task error:", err);
      setError(err.message || "Unable to delete task.");
    }
  };

  const updateTask = async (id, title) => {
    try {
      const task = tasks.find((item) => item.id === id);
      if (!task) {
        setError("Task not found. Please refresh and try again.");
        return;
      }

      setError("");
      const updatedTask = await apiRequest(`/tasks/${id}`, {
        method: "PUT",
        body: JSON.stringify({
          title,
          completed: task.completed,
          priority: task.priority,
        }),
      });

      setTasks((previousTasks) =>
        (Array.isArray(previousTasks) ? previousTasks : []).map((item) =>
          item.id === updatedTask.id ? updatedTask : item
        )
      );
      showSuccessMessage("Task updated successfully!");
    } catch (err) {
      console.error("Update task error:", err);
      setError(err.message || "Unable to update task.");
    }
  };

  const moveTask = async (task, newStatus) => {
    if (getTaskStatus(task) === newStatus) return;

    setError("");
    setTasks((previousTasks) =>
      (Array.isArray(previousTasks) ? previousTasks : []).map((item) =>
        item.id === task.id
          ? { ...item, status: newStatus, completed: newStatus === "done" }
          : item
      )
    );

    try {
      const updatedTask = await apiRequest(`/tasks/${task.id}/status`, {
        method: "PATCH",
        body: JSON.stringify({ status: newStatus }),
      });

      setTasks((previousTasks) =>
        (Array.isArray(previousTasks) ? previousTasks : []).map((item) =>
          item.id === updatedTask.id ? updatedTask : item
        )
      );
    } catch (err) {
      console.error("Move task error:", err);
      setTasks((previousTasks) =>
        (Array.isArray(previousTasks) ? previousTasks : []).map((item) =>
          item.id === task.id ? task : item
        )
      );
      setError(err.message || "Unable to move task. Please try again.");
    }
  };

  const safeTasks = Array.isArray(tasks) ? tasks : [];

  const filteredTasks = safeTasks.filter((task) => {
    if (filter === "active") return !task.completed;
    if (filter === "completed") return task.completed;
    return true;
  });

  const categoryFilteredTasks = (filteredTasks || []).filter((task) => {
    if (categoryFilter === "all") return true;
    return task.category === categoryFilter;
  });

  const searchedTasks = categoryFilteredTasks.filter((task) =>
    task.title.toLowerCase().includes(search.toLowerCase())
  );

  const tasksToSort = searchedTasks.filter((task) => {
    if (showOverdueOnly) {
      if (!task.due_date || task.completed) return false;
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const dueDate = new Date(task.due_date);
      dueDate.setHours(0, 0, 0, 0);
      return dueDate < today;
    }

    if (showUpcomingOnly) {
      if (!task.due_date || task.completed) return false;
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const dueDate = new Date(task.due_date);
      dueDate.setHours(0, 0, 0, 0);
      const daysUntilDue = (dueDate - today) / (1000 * 60 * 60 * 24);
      return daysUntilDue >= 0 && daysUntilDue <= 3;
    }

    return true;
  });

  const sortedTasks = [...tasksToSort].sort((a, b) => {
    if (sortBy === "priority") {
      const priorityOrder = { high: 1, medium: 2, low: 3 };
      return (priorityOrder[a.priority] ?? 4) - (priorityOrder[b.priority] ?? 4);
    }
    if (sortBy === "dueDate") {
      if (!a.due_date) return 1;
      if (!b.due_date) return -1;
      return new Date(a.due_date) - new Date(b.due_date);
    }
    return b.id - a.id;
  });

  const boardTasks = safeTasks.filter(
    (task) =>
      (categoryFilter === "all" || task.category === categoryFilter) &&
      task.title.toLowerCase().includes(search.toLowerCase())
  );

  const totalTasks = safeTasks.length;
  const completedTasks = safeTasks.filter((task) => task.completed).length;
  const activeTasks = safeTasks.filter((task) => !task.completed).length;
  const inProgressTasks = safeTasks.filter(
    (task) => getTaskStatus(task) === "in_progress"
  ).length;
  const upcomingTasks = safeTasks.filter((task) => {
    if (!task.due_date || task.completed) return false;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const dueDate = new Date(task.due_date);
    dueDate.setHours(0, 0, 0, 0);
    const daysUntilDue = (dueDate - today) / (1000 * 60 * 60 * 24);
    return daysUntilDue >= 0 && daysUntilDue <= 3;
  }).length;

  const completionPercent =
    totalTasks === 0 ? 0 : Math.round((completedTasks / totalTasks) * 100);

  const overdueTasks = safeTasks.filter((task) => {
    if (!task.due_date || task.completed) return false;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const due = new Date(task.due_date);
    due.setHours(0, 0, 0, 0);
    return due < today;
  }).length;

  const resetFilters = () => {
    setFilter("all");
    setCategoryFilter("all");
    setSearch("");
    setShowUpcomingOnly(false);
    setShowOverdueOnly(false);
    setSortBy("newest");
  };

  const jumpToTasks = (mode = "all") => {
    setView("list");
    setFilter(
      mode === "completed" ? "completed" : mode === "active" ? "active" : "all"
    );
    setShowUpcomingOnly(mode === "upcoming");
    setShowOverdueOnly(mode === "overdue");
    setCategoryFilter("all");
    setSearch("");
    scrollToTasks();
  };

  const openBoard = () => {
    setView("board");
    setShowUpcomingOnly(false);
    setShowOverdueOnly(false);
    scrollToTasks();
  };

  const categorySelect = (id) => (
    <select
      id={id}
      value={categoryFilter}
      onChange={(event) => setCategoryFilter(event.target.value)}
    >
      <option value="all">All categories</option>
      <option value="Personal">Personal</option>
      <option value="College">College</option>
      <option value="Work">Work</option>
      <option value="Project">Project</option>
    </select>
  );

  return (
    <div className="app ty-dashboard" data-theme={theme}>
      <aside className="ty-sidebar">
        <Link
          className="ty-brand"
          to="/dashboard"
          onClick={(e) => {
            e.preventDefault();
            window.scrollTo({ top: 0, behavior: "smooth" });
          }}
        >
          <span className="ty-brand-mark">✓</span>
          <span>
            Task<span>Yard</span>
            <small>YOUR DAILY WORKSPACE</small>
          </span>
        </Link>
        <p className="ty-nav-label">WORKSPACE</p>
        <nav className="ty-nav" aria-label="Main navigation">
          <button
            className={`ty-nav-item ${view === "list" ? "active" : ""}`}
            onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
          >
            <span>⌂</span> Dashboard
          </button>
          <button className="ty-nav-item" onClick={() => jumpToTasks("all")}>
            <span>▤</span> My tasks <b>{activeTasks}</b>
          </button>
          <button
            className={`ty-nav-item ${view === "board" ? "active" : ""}`}
            onClick={openBoard}
          >
            <span>▦</span> Board <b>{inProgressTasks}</b>
          </button>
          <button className="ty-nav-item" onClick={() => jumpToTasks("upcoming")}>
            <span>◷</span> Upcoming <b>{upcomingTasks}</b>
          </button>
          <button className="ty-nav-item" onClick={() => jumpToTasks("completed")}>
            <span>✓</span> Completed
          </button>
          <button className="ty-nav-item" onClick={() => jumpToTasks("overdue")}>
            <span>⚑</span> Overdue <b className="ty-nav-danger">{overdueTasks}</b>
          </button>
          <button
            className="ty-nav-item"
            onClick={() => navigate("/profile")}
            style={{ marginTop: "12px", borderTop: "1px solid rgba(255,255,255,0.08)", paddingTop: "10px" }}
          >
            <span>👤</span> Profile & Billing
          </button>
        </nav>
        <div className="ty-sidebar-bottom">
          <div className="ty-sidebar-tip">
            <span>✦</span>
            <strong>Small steps add up.</strong>
            <p>Keep moving forward, one task at a time.</p>
          </div>
          <button
            className="ty-profile"
            onClick={() => navigate("/profile")}
            title="View Profile & Billing"
          >
            <span className="ty-avatar">
              {user.avatar_url ? (
                <img
                  src={user.avatar_url}
                  alt={user.name}
                  referrerPolicy="no-referrer"
                  style={{ width: "100%", height: "100%", borderRadius: "50%", objectFit: "cover" }}
                />
              ) : (
                (user.name || user.email || "U").charAt(0).toUpperCase()
              )}
            </span>
            <span className="ty-profile-text">
              <strong>{user.name || "Your account"}</strong>
              <small>
                {user.plan === "premium" ? "⭐ Premium" : "Free Plan"} · Profile
              </small>
            </span>
            <span className="ty-logout-icon">→</span>
          </button>
        </div>
      </aside>

      <main className="ty-main" id="dashboard">
        {/* Desktop Simulation titlebar strip */}
        <div className="ty-desktop-titlebar" aria-hidden="true">
          <div className="ty-desktop-dots">
            <span className="ty-window-dot dot-red" />
            <span className="ty-window-dot dot-yellow" />
            <span className="ty-window-dot dot-green" />
          </div>
          <div className="ty-desktop-window-title">
            <span className="ty-desktop-app-name">TaskYard</span>
            <span className="ty-desktop-sep">/</span>
            <span className="ty-desktop-sub">Deep Stealth Workspace</span>
          </div>
          <div className="ty-desktop-system-status">
            <span className="ty-desktop-indicator" />
            <span>Active Sync</span>
          </div>
        </div>

        {successMessage && (
          <div className="success-notification" role="status">
            ✓ &nbsp;{successMessage}
          </div>
        )}
        <header className="ty-topbar">
          <div>
            <p className="ty-eyebrow">YOUR PERSONAL WORKSPACE</p>
            <h1>
              Good to see you, {user.name?.split(" ")[0] || "there"} <span>✦</span>
            </h1>
            <p className="ty-subtitle">
              Here's what's happening with your tasks today.
            </p>
          </div>
          <div className="ty-topbar-actions">
            <span className="ty-date">
              ◷ &nbsp;
              {new Date().toLocaleDateString(undefined, {
                weekday: "short",
                month: "short",
                day: "numeric",
              })}
            </span>
            <button
              className="ty-logout-button"
              type="button"
              onClick={toggleTheme}
              aria-label={`Switch to ${theme === "dark" ? "light" : "dark"} mode`}
            >
              {theme === "dark" ? "☀️ Light mode" : "🌙 Dark mode"}
            </button>
            <button
              className="ty-logout-button"
              type="button"
              onClick={() => navigate("/profile")}
            >
              Profile 👤
            </button>
            <button className="ty-logout-button" onClick={logout}>
              Log out ↗
            </button>
          </div>
        </header>

        {error && <p className="error-message ty-error">{error}</p>}
        {loading && <p className="status-message">Loading your tasks…</p>}

        <section className="ty-stat-grid" aria-label="Task summary">
          <article className="ty-stat-card">
            <span className="ty-stat-icon ty-icon-purple">▤</span>
            <span className="ty-stat-label">Total tasks</span>
            <strong>{totalTasks}</strong>
            <small>Across all categories</small>
          </article>
          <article className="ty-stat-card">
            <span className="ty-stat-icon ty-icon-blue">◷</span>
            <span className="ty-stat-label">In progress</span>
            <strong>{inProgressTasks}</strong>
            <small>Tasks to keep moving</small>
          </article>
          <article className="ty-stat-card">
            <span className="ty-stat-icon ty-icon-green">✓</span>
            <span className="ty-stat-label">Completed</span>
            <strong>{completedTasks}</strong>
            <small>Nice work so far</small>
          </article>
          <article className="ty-stat-card">
            <span className="ty-stat-icon ty-icon-orange">⚑</span>
            <span className="ty-stat-label">Overdue</span>
            <strong>{overdueTasks}</strong>
            <small>Need your attention</small>
          </article>
        </section>

        <section className="ty-overview-grid">
          <article className="ty-panel ty-progress-panel">
            <div className="ty-panel-heading">
              <div>
                <p className="ty-eyebrow">YOUR MOMENTUM</p>
                <h2>Task completion</h2>
              </div>
              <span className="ty-pill">All time</span>
            </div>
            <div className="ty-progress-content">
              <div className="ty-ring" style={{ "--progress": `${completionPercent}%` }}>
                <div className="ty-ring-inner">
                  <strong>{completionPercent}%</strong>
                  <span>completed</span>
                </div>
              </div>
              <div className="ty-progress-copy">
                <h3>
                  {completionPercent === 100 && totalTasks
                    ? "Everything done!"
                    : completionPercent >= 60
                      ? "You're doing great!"
                      : "Every task counts."}
                </h3>
                <p>
                  {completedTasks} of {totalTasks} tasks completed. Keep your
                  momentum going.
                </p>
                <div className="ty-legend">
                  <span>
                    <i className="ty-dot ty-dot-green" /> Completed{" "}
                    <b>{completedTasks}</b>
                  </span>
                  <span>
                    <i className="ty-dot ty-dot-purple" /> In progress{" "}
                    <b>{inProgressTasks}</b>
                  </span>
                </div>
                <button className="ty-text-button" onClick={openBoard}>
                  Open the board <span>→</span>
                </button>
              </div>
            </div>
          </article>
          <article className="ty-panel ty-deadline-panel">
            <div className="ty-panel-heading">
              <div>
                <p className="ty-eyebrow">STAY ON TRACK</p>
                <h2>Coming up next</h2>
              </div>
              <span className="ty-stat-icon ty-icon-blue">◷</span>
            </div>
            <p className="ty-panel-description">
              Your open tasks due within the next 3 days.
            </p>
            <div className="ty-deadline-number">
              {upcomingTasks}
              <span> upcoming {upcomingTasks === 1 ? "task" : "tasks"}</span>
            </div>
            <div className="ty-mini-track">
              <span
                style={{
                  width: `${totalTasks ? Math.min(100, (upcomingTasks / totalTasks) * 100) : 0}%`,
                }}
              />
            </div>
            <button
              className="ty-secondary-button"
              onClick={() => jumpToTasks("upcoming")}
            >
              Review upcoming tasks <span>→</span>
            </button>
            <div className="ty-deadline-footer">
              <span className="ty-dot ty-dot-orange" />{" "}
              {overdueTasks
                ? `${overdueTasks} overdue — review when you can`
                : "You're all caught up on overdue tasks"}
            </div>
          </article>
        </section>

        <section className="ty-panel ty-create-panel" id="create-task">
          <div className="ty-panel-heading">
            <div>
              <p className="ty-eyebrow">MAKE IT HAPPEN</p>
              <h2>Create a task</h2>
              <p className="ty-panel-description">
                Add the next thing you want to get done. AI labels and image attachments supported!
              </p>
            </div>
            <span className="ty-create-mark">＋</span>
          </div>
          <div className="ty-task-form-wrap">
            <TaskForm onAddTask={addTask} />
          </div>
        </section>

        <section
          className="ty-panel ty-tasks-panel"
          id="tasks-section"
          ref={tasksSectionRef}
        >
          <div className="ty-panel-heading ty-tasks-heading">
            <div>
              <p className="ty-eyebrow">YOUR WORK, ORGANIZED</p>
              <h2>
                {view === "board" ? "Board" : "My tasks"}{" "}
                <span className="ty-count-pill">
                  {view === "board" ? boardTasks.length : sortedTasks.length}
                </span>
              </h2>
            </div>
            <div className="ty-heading-actions">
              <div className="ty-view-toggle" role="group" aria-label="Choose a view">
                <button
                  type="button"
                  className={view === "list" ? "selected" : ""}
                  onClick={() => setView("list")}
                >
                  List
                </button>
                <button
                  type="button"
                  className={view === "board" ? "selected" : ""}
                  onClick={() => setView("board")}
                >
                  Board
                </button>
              </div>
              <button className="ty-secondary-button" onClick={resetFilters}>
                Reset filters ↺
              </button>
            </div>
          </div>

          {view === "board" ? (
            <>
              <div className="ty-board-controls">
                <label className="ty-search">
                  <span>⌕</span>
                  <input
                    ref={searchInputRef}
                    type="text"
                    placeholder="Search tasks by title… (Press / or Ctrl+K)"
                    value={search}
                    onChange={(event) => setSearch(event.target.value)}
                  />
                  <span className="ty-search-kbd-hint">
                    <kbd>Ctrl</kbd> <kbd>K</kbd>
                  </span>
                </label>
                <div className="ty-filter-block">
                  <label className="ty-filter-label" htmlFor="ty-board-category">
                    CATEGORY
                  </label>
                  {categorySelect("ty-board-category")}
                </div>
              </div>
              {loading ? (
                <div className="ty-empty-state">
                  <span>◷</span>
                  <h3>Loading tasks</h3>
                  <p>Your workspace is getting ready.</p>
                </div>
              ) : (
                <KanbanBoard tasks={boardTasks} onMove={moveTask} />
              )}
            </>
          ) : (
            <>
              <div className="ty-controls">
                <label className="ty-search">
                  <span>⌕</span>
                  <input
                    ref={searchInputRef}
                    type="text"
                    placeholder="Search tasks by title… (Press / or Ctrl+K)"
                    value={search}
                    onChange={(event) => setSearch(event.target.value)}
                  />
                  <span className="ty-search-kbd-hint">
                    <kbd>/</kbd> or <kbd>Ctrl</kbd> <kbd>K</kbd>
                  </span>
                </label>
                <div className="ty-filter-row">
                  <div className="ty-filter-block">
                    <span className="ty-filter-label">STATUS</span>
                    <div className="ty-filter-buttons">
                      <button
                        className={filter === "all" ? "selected" : ""}
                        onClick={() => setFilter("all")}
                      >
                        All tasks
                      </button>
                      <button
                        className={filter === "active" ? "selected" : ""}
                        onClick={() => setFilter("active")}
                      >
                        Active
                      </button>
                      <button
                        className={filter === "completed" ? "selected" : ""}
                        onClick={() => setFilter("completed")}
                      >
                        Completed
                      </button>
                    </div>
                  </div>
                  <div className="ty-filter-block">
                    <label className="ty-filter-label" htmlFor="ty-category">
                      CATEGORY
                    </label>
                    {categorySelect("ty-category")}
                  </div>
                  <div className="ty-filter-block ty-sort-block">
                    <label className="ty-filter-label" htmlFor="sortTasks">
                      SORT BY
                    </label>
                    <select
                      id="sortTasks"
                      value={sortBy}
                      onChange={(event) => setSortBy(event.target.value)}
                    >
                      <option value="newest">Newest first</option>
                      <option value="priority">Priority: high to low</option>
                      <option value="dueDate">Due date: earliest</option>
                    </select>
                  </div>
                </div>
                {(showUpcomingOnly || showOverdueOnly) && (
                  <div className="ty-active-filter-note">
                    Showing{" "}
                    {showUpcomingOnly
                      ? "upcoming tasks due within 3 days"
                      : "overdue tasks"}
                    .{" "}
                    <button
                      onClick={() => {
                        setShowUpcomingOnly(false);
                        setShowOverdueOnly(false);
                      }}
                    >
                      Clear filter
                    </button>
                  </div>
                )}
              </div>

              {loading ? (
                <div className="ty-empty-state">
                  <span>◷</span>
                  <h3>Loading tasks</h3>
                  <p>Your workspace is getting ready.</p>
                </div>
              ) : sortedTasks.length === 0 ? (
                <div className="ty-empty-state">
                  <span>{safeTasks.length ? "⌕" : "✦"}</span>
                  <h3>
                    {safeTasks.length ? "No tasks match these filters" : "A fresh start"}
                  </h3>
                  <p>
                    {safeTasks.length
                      ? "Try another search or reset your filters."
                      : "Create your first task above and start building momentum."}
                  </p>
                  {safeTasks.length > 0 && (
                    <button className="ty-secondary-button" onClick={resetFilters}>
                      Clear filters
                    </button>
                  )}
                </div>
              ) : (
                <div className="ty-task-list-wrap">
                  <TaskList
                    tasks={sortedTasks}
                    onComplete={completeTask}
                    onDelete={deleteTask}
                    onUpdate={updateTask}
                  />
                </div>
              )}
            </>
          )}
        </section>

        <footer className="ty-footer">
          <span className="ty-brand-mark ty-footer-mark">✓</span>
          <span>
            <strong>TaskYard</strong> · Make room for what matters.
          </span>
          <span className="ty-footer-right">One task at a time ✦</span>
        </footer>
      </main>

      {/* Sticky Notes & Edge Pill Component */}
      <StickyNotesWidget />
    </div>
  );
}

function App() {
  const [tasks, setTasks] = useState([]);
  const [user, setUser] = useState(() => {
    const savedUser = localStorage.getItem("user");
    return savedUser ? JSON.parse(savedUser) : null;
  });
  const [loading, setLoading] = useState(true);
  const [theme, setTheme] = useState(() => {
    return localStorage.getItem("taskyard-theme") || "dark";
  });

  const toggleTheme = () => {
    setTheme((currentTheme) => {
      const newTheme = currentTheme === "dark" ? "light" : "dark";
      localStorage.setItem("taskyard-theme", newTheme);
      return newTheme;
    });
  };

  const [error, setError] = useState("");
  const [successMessage, setSuccessMessage] = useState("");

  const showSuccessMessage = (message) => {
    setError("");
    setSuccessMessage(message);
    setTimeout(() => setSuccessMessage(""), 3000);
  };

  useEffect(() => {
    if (!user) {
      setLoading(false);
      return;
    }

    setLoading(true);
    setError("");

    apiRequest("/tasks")
      .then((data) => {
        const receivedTasks = Array.isArray(data)
          ? data
          : Array.isArray(data?.tasks)
            ? data.tasks
            : [];
        setTasks(receivedTasks);
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, [user]);

  useEffect(() => {
    localStorage.setItem("taskyard-theme", theme);
  }, [theme]);

  const logout = () => {
    localStorage.removeItem("token");
    localStorage.removeItem("user");
    setUser(null);
    setTasks([]);
    setError("");
    setSuccessMessage("");
  };

  useEffect(() => {
    const handleSessionExpired = () => logout();
    window.addEventListener("session-expired", handleSessionExpired);
    return () => window.removeEventListener("session-expired", handleSessionExpired);
  }, []);

  const handleLogin = (userData) => {
    setUser(userData);
  };

  return (
    <Routes>
      <Route
        path="/"
        element={
          user ? <Navigate to="/dashboard" replace /> : <Auth onLogin={handleLogin} />
        }
      />
      <Route
        path="/dashboard"
        element={
          <ProtectedRoute user={user}>
            <Dashboard
              user={user}
              tasks={tasks}
              setTasks={setTasks}
              loading={loading}
              error={error}
              setError={setError}
              successMessage={successMessage}
              showSuccessMessage={showSuccessMessage}
              logout={logout}
              theme={theme}
              toggleTheme={toggleTheme}
            />
          </ProtectedRoute>
        }
      />
      <Route
        path="/task/:id"
        element={
          <ProtectedRoute user={user}>
            <TaskDetail />
          </ProtectedRoute>
        }
      />
      <Route
        path="/profile"
        element={
          <ProtectedRoute user={user}>
            <Profile user={user} onLogout={logout} />
          </ProtectedRoute>
        }
      />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

export default App;
