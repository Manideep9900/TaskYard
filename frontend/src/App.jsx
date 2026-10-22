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
  onRetryTasks,
}) {
  const tasksSectionRef = useRef(null);
  const searchInputRef = useRef(null);
  const navigate = useNavigate();

  const [isSlowLoading, setIsSlowLoading] = useState(false);

  useEffect(() => {
    let timer;
    if (loading) {
      timer = setTimeout(() => setIsSlowLoading(true), 3500);
    } else {
      setIsSlowLoading(false);
    }
    return () => clearTimeout(timer);
  }, [loading]);

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
    <div className="app ty-peeky-app" data-theme={theme}>
      {/* Sticky Peeky Top Navbar */}
      <header className="ty-peeky-navbar">
        <div className="ty-navbar-inner">
          <Link
            className="ty-navbar-brand"
            to="/dashboard"
            onClick={(e) => {
              e.preventDefault();
              window.scrollTo({ top: 0, behavior: "smooth" });
            }}
          >
            <span className="ty-brand-icon-stack">
              <span className="ty-icon-layer layer-1" />
              <span className="ty-icon-layer layer-2" />
              <span className="ty-icon-layer layer-3" />
            </span>
            <span className="ty-brand-name">
              Task<strong>Yard</strong>
            </span>
          </Link>

          <nav className="ty-navbar-links" aria-label="Main navigation">
            <button
              className={`ty-nav-link ${view === "list" ? "active" : ""}`}
              onClick={() => {
                setView("list");
                window.scrollTo({ top: 0, behavior: "smooth" });
              }}
            >
              Dashboard
            </button>
            <button
              className="ty-nav-link"
              onClick={() => jumpToTasks("all")}
            >
              My tasks <span className="ty-badge-count">{activeTasks}</span>
            </button>
            <button
              className={`ty-nav-link ${view === "board" ? "active" : ""}`}
              onClick={openBoard}
            >
              Board <span className="ty-badge-count">{inProgressTasks}</span>
            </button>
            <button
              className="ty-nav-link"
              onClick={() => jumpToTasks("upcoming")}
            >
              Upcoming {upcomingTasks > 0 && <span className="ty-badge-count">{upcomingTasks}</span>}
            </button>
            <button
              className="ty-nav-link"
              onClick={() => navigate("/profile")}
            >
              Pricing
            </button>
          </nav>

          <div className="ty-navbar-right">
            <button
              className="ty-navbar-profile-btn"
              onClick={() => navigate("/profile")}
              title="View Account & Plan"
            >
              <span className="ty-avatar-mini">
                {user.avatar_url ? (
                  <img
                    src={user.avatar_url}
                    alt={user.name}
                    referrerPolicy="no-referrer"
                  />
                ) : (
                  (user.name || user.email || "U").charAt(0).toUpperCase()
                )}
              </span>
              <span className="ty-user-mini-name">{user.name?.split(" ")[0] || "Account"}</span>
              <span className={`ty-plan-mini-pill ${user.plan === "premium" ? "pill-pro" : "pill-free"}`}>
                {user.plan === "premium" ? "PRO" : "FREE"}
              </span>
            </button>

            <button
              className="ty-pill-btn-black"
              onClick={() => {
                document.getElementById("create-task")?.scrollIntoView({ behavior: "smooth" });
                document.getElementById("task-title")?.focus();
              }}
            >
              + New task
            </button>

            <button className="ty-icon-btn-ghost" onClick={logout} title="Log out">
              Log out ↗
            </button>
          </div>
        </div>
      </header>

      <main className="ty-main-wrap" id="dashboard">
        {successMessage && (
          <div className="success-notification" role="status">
            ✓ &nbsp;{successMessage}
          </div>
        )}

        {/* Hero Section */}
        <section className="ty-hero-section">
          <div className="ty-hero-pill-badge">
            <span className="ty-badge-tag">Productivity</span>
            <span className="ty-badge-text">Task management with Kanban & AI labels</span>
          </div>

          <h1 className="ty-hero-title">
            Stay organized, prioritize what matters, and get work done.
          </h1>

          <p className="ty-hero-subtitle">
            A fast, distraction-free workspace for your personal to-dos, Kanban project tracking, and AI-assisted categorization.
          </p>

          <div className="ty-hero-actions">
            <button
              className="ty-hero-btn-primary"
              onClick={() => {
                document.getElementById("create-task")?.scrollIntoView({ behavior: "smooth" });
                document.getElementById("task-title")?.focus();
              }}
            >
              + Add a new task
            </button>
            <button className="ty-hero-btn-secondary" onClick={openBoard}>
              Open Kanban board
            </button>
          </div>

          <div className="ty-hero-proof">
            <div className="ty-proof-avatars">
              <span className="ty-avatar-dot dot-yellow" />
              <span className="ty-avatar-dot dot-blue" />
              <span className="ty-avatar-dot dot-pink" />
              <span className="ty-avatar-dot dot-green" />
            </div>
            <span className="ty-proof-text">
              <strong>{totalTasks} tasks</strong> tracked · {activeTasks} active · {user.plan === "premium" ? "⭐ Pro Plan (10,000 tasks/mo)" : "Free Plan (100 tasks/mo)"}
            </span>
          </div>
        </section>

        {/* Ticker / Feature Ribbon */}
        <div className="ty-ticker-ribbon" aria-hidden="true">
          <div className="ty-ticker-track">
            <span><i className="dot dot-yellow" /> Fast Search (Ctrl + K)</span>
            <span><i className="dot dot-blue" /> Smart AI Task Labels</span>
            <span><i className="dot dot-pink" /> Interactive Kanban Board</span>
            <span><i className="dot dot-green" /> Image Attachments</span>
            <span><i className="dot dot-yellow" /> Priority & Due Dates</span>
            <span><i className="dot dot-blue" /> Monthly Usage Tracking</span>
            <span><i className="dot dot-pink" /> Stripe Subscriptions</span>
            <span><i className="dot dot-green" /> Distraction Free</span>
          </div>
        </div>

        {/* Metrics Grid Section */}
        <section className="ty-metrics-section">
          <div className="ty-section-header-center">
            <h2 className="ty-metrics-heading">Real-time productivity overview.</h2>
            <p className="ty-metrics-sub">
              Monitor active progress, upcoming deadlines, and task completion velocity across your workspace.
            </p>
          </div>

          <div className="ty-metrics-grid">
            <div className="ty-metric-card">
              <div className="ty-metric-number">{totalTasks} <span>tasks</span></div>
              <div className="ty-metric-title">Total tracked</div>
              <p className="ty-metric-desc">Across all your categories.</p>
            </div>

            <div className="ty-metric-card">
              <div className="ty-metric-number">{inProgressTasks} <span>active</span></div>
              <div className="ty-metric-title">In progress</div>
              <p className="ty-metric-desc">Tasks currently in motion.</p>
            </div>

            <div className="ty-metric-card">
              <div className="ty-metric-number">{completionPercent}<span>%</span></div>
              <div className="ty-metric-title">Completion rate</div>
              <p className="ty-metric-desc">{completedTasks} completed so far.</p>
            </div>

            <div className="ty-metric-card">
              <div className="ty-metric-number">{overdueTasks > 0 ? overdueTasks : "0"} <span>alerts</span></div>
              <div className="ty-metric-title">Overdue items</div>
              <p className="ty-metric-desc">
                {overdueTasks > 0 ? "Tasks that need immediate attention." : "All due dates on schedule!"}
              </p>
            </div>
          </div>
        </section>

        {error && (
          <div className="error-message ty-error" style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: "0.5rem" }}>
            <span>{error}</span>
            {onRetryTasks && (
              <button
                type="button"
                className="ty-secondary-button"
                onClick={onRetryTasks}
                style={{ padding: "4px 12px", fontSize: "0.85rem", cursor: "pointer" }}
              >
                ↻ Retry
              </button>
            )}
          </div>
        )}
        {loading && <p className="status-message">Loading your tasks…</p>}

        {/* Create Task Card */}
        <section className="ty-card-section ty-create-panel" id="create-task">
          <div className="ty-card-header">
            <div>
              <p className="ty-eyebrow">MAKE IT HAPPEN</p>
              <h2>Create a task</h2>
              <p className="ty-card-description">
                Add the next thing you want to get done. AI labels and image attachments supported!
              </p>
            </div>
          </div>
          <div className="ty-task-form-wrap">
            <TaskForm onAddTask={addTask} />
          </div>
        </section>

        {/* Task List / Board Workspace (Screenshot 3) */}
        <section
          className="ty-card-section ty-tasks-panel"
          id="tasks-section"
          ref={tasksSectionRef}
        >
          <div className="ty-card-header ty-tasks-heading">
            <div>
              <p className="ty-eyebrow">YOUR WORK, ORGANIZED</p>
              <h2>
                {view === "board" ? "Board View" : "All Tasks"}{" "}
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
                  <span>⏳</span>
                  <h3>{isSlowLoading ? "Connecting to server..." : "Loading tasks"}</h3>
                  <p>
                    {isSlowLoading
                      ? "Render's free tier spins down after inactivity. Server is waking up, please hold on..."
                      : "Your workspace is getting ready."}
                  </p>
                </div>
              ) : error ? (
                <div className="ty-empty-state">
                  <span>⚠️</span>
                  <h3>Unable to load tasks</h3>
                  <p>{error}</p>
                  {onRetryTasks && (
                    <button className="ty-secondary-button" onClick={onRetryTasks} style={{ marginTop: "1rem" }}>
                      ↻ Retry Connection
                    </button>
                  )}
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
                  <span>⏳</span>
                  <h3>{isSlowLoading ? "Connecting to server..." : "Loading tasks"}</h3>
                  <p>
                    {isSlowLoading
                      ? "Render's free tier spins down after inactivity. Server is waking up, please hold on..."
                      : "Your workspace is getting ready."}
                  </p>
                </div>
              ) : error ? (
                <div className="ty-empty-state">
                  <span>⚠️</span>
                  <h3>Unable to load tasks</h3>
                  <p>{error}</p>
                  {onRetryTasks && (
                    <button className="ty-secondary-button" onClick={onRetryTasks} style={{ marginTop: "1rem" }}>
                      ↻ Retry Connection
                    </button>
                  )}
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
            <strong>TaskYard</strong> · Stay organized, prioritize what matters.
          </span>
          <span className="ty-footer-right">Zero clutter ✦</span>
        </footer>
      </main>
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

  const fetchTasks = () => {
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
  };

  useEffect(() => {
    fetchTasks();
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
              onRetryTasks={fetchTasks}
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
