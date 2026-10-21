import { useState } from "react";
import { Link } from "react-router-dom";
import AuthImage from "./AuthImage";
import {
  DndContext,
  DragOverlay,
  KeyboardSensor,
  MouseSensor,
  TouchSensor,
  pointerWithin,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import { BOARD_COLUMNS, getTaskStatus } from "../taskstatus";

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:3000";
const PRIORITY_ORDER = { high: 1, medium: 2, low: 3 };

function CardContent({ task, onMove, handle }) {
  const status = getTaskStatus(task);
  const priority = (task.priority || "medium").toLowerCase();
  const dueDate = task.due_date ? task.due_date.slice(0, 10) : "";
  const isOverdue =
    dueDate &&
    status !== "done" &&
    dueDate < new Date().toLocaleDateString("en-CA");

  return (
    <>
      <div className="ty-board-card-top">
        <h4 className={status === "done" ? "completed" : ""}>
          <Link to={`/task/${task.id}`} className="task-title-link">
            {task.title}
          </Link>
        </h4>
        {handle}
      </div>

      {task.description && (
        <p className="ty-board-card-desc">{task.description}</p>
      )}

      {/* AI Labels */}
      {task.labels && task.labels.length > 0 && (
        <div className="task-board-labels">
          {task.labels.map((label, idx) => (
            <span key={idx} className="task-ai-label-pill">
              🏷️ {label}
            </span>
          ))}
        </div>
      )}

      {/* Image Thumbnail */}
      {(task.has_image || task.image_url) && (
        <div className="task-board-image-wrap">
          <Link to={`/task/${task.id}`}>
            <AuthImage
              taskId={task.id}
              alt={task.title}
              className="task-board-thumb"
            />
          </Link>
        </div>
      )}

      <div className="ty-board-card-meta">
        <span className={`priority priority-${priority}`}>
          {priority.charAt(0).toUpperCase() + priority.slice(1)}
        </span>
        {task.category && <span className="category">{task.category}</span>}
        {dueDate && (
          <span className={`due-date ${isOverdue ? "due-date-overdue" : ""}`}>
            {isOverdue ? "Overdue · " : "Due · "}
            {dueDate}
          </span>
        )}
      </div>

      {onMove && (
        <label className="ty-board-move">
          <span>Move to</span>
          <select
            value={status}
            onChange={(event) => onMove(task, event.target.value)}
            aria-label={`Move "${task.title}" to another column`}
          >
            {BOARD_COLUMNS.map((column) => (
              <option key={column.id} value={column.id}>
                {column.title}
              </option>
            ))}
          </select>
        </label>
      )}
    </>
  );
}

function DraggableCard({ task, onMove }) {
  const { attributes, listeners, setNodeRef, setActivatorNodeRef, isDragging } =
    useDraggable({ id: task.id });

  return (
    <article
      ref={setNodeRef}
      className={`ty-board-card ${isDragging ? "is-dragging" : ""}`}
    >
      <CardContent
        task={task}
        onMove={onMove}
        handle={
          <button
            type="button"
            ref={setActivatorNodeRef}
            className="ty-drag-handle"
            aria-label={`Drag "${task.title}" to another column`}
            {...listeners}
            {...attributes}
          >
            ⠿
          </button>
        }
      />
    </article>
  );
}

function BoardColumn({ column, tasks, onMove }) {
  const { setNodeRef, isOver } = useDroppable({ id: column.id });

  return (
    <section
      ref={setNodeRef}
      className={`ty-board-column ${isOver ? "is-over" : ""}`}
      data-status={column.id}
      aria-label={column.title}
    >
      <header className="ty-board-column-head">
        <div>
          <h3>
            <i className="ty-board-dot" />
            {column.title}
          </h3>
          <small>{column.hint}</small>
        </div>
        <span className="ty-board-count">{tasks.length}</span>
      </header>

      {tasks.length === 0 ? (
        <p className="ty-board-empty">Drop a task here</p>
      ) : (
        tasks.map((task) => (
          <DraggableCard key={task.id} task={task} onMove={onMove} />
        ))
      )}
    </section>
  );
}

function KanbanBoard({ tasks, onMove }) {
  const [activeId, setActiveId] = useState(null);

  const sensors = useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: 4 } }),
    useSensor(TouchSensor, {
      activationConstraint: { delay: 120, tolerance: 6 },
    }),
    useSensor(KeyboardSensor)
  );

  const sortCards = (a, b) =>
    (PRIORITY_ORDER[a.priority] ?? 4) - (PRIORITY_ORDER[b.priority] ?? 4) ||
    b.id - a.id;

  const tasksFor = (columnId) =>
    tasks.filter((task) => getTaskStatus(task) === columnId).sort(sortCards);

  const activeTask = tasks.find((task) => task.id === activeId) || null;

  const handleDragEnd = ({ active, over }) => {
    setActiveId(null);
    if (!over) return;

    const task = tasks.find((item) => item.id === active.id);
    const targetIsColumn = BOARD_COLUMNS.some((column) => column.id === over.id);

    if (task && targetIsColumn && getTaskStatus(task) !== over.id) {
      onMove(task, over.id);
    }
  };

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={pointerWithin}
      onDragStart={({ active }) => setActiveId(active.id)}
      onDragEnd={handleDragEnd}
      onDragCancel={() => setActiveId(null)}
    >
      <div className="ty-board">
        {BOARD_COLUMNS.map((column) => (
          <BoardColumn
            key={column.id}
            column={column}
            tasks={tasksFor(column.id)}
            onMove={onMove}
          />
        ))}
      </div>

      <DragOverlay>
        {activeTask ? (
          <article className="ty-board-card ty-board-card-overlay">
            <CardContent task={activeTask} />
          </article>
        ) : null}
      </DragOverlay>
    </DndContext>
  );
}

export default KanbanBoard;