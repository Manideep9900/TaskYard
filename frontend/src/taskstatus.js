// Shared by App.jsx and the Kanban board.
export const BOARD_COLUMNS = [
  { id: "todo", title: "To do", hint: "Ready to start" },
  { id: "in_progress", title: "In progress", hint: "Being worked on" },
  { id: "done", title: "Done", hint: "Finished" },
];

// Older tasks may not have a status yet, so fall back to the completed flag.
export function getTaskStatus(task) {
  if (task.status) return task.status;
  return task.completed ? "done" : "todo";
}