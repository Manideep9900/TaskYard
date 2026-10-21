import { useState, useEffect } from "react";

const NOTE_COLORS = [
  { id: "yellow", bg: "#fef08a", label: "Yellow Note" },
  { id: "blue", bg: "#93c5fd", label: "Blue Note" },
  { id: "pink", bg: "#fbcfe8", label: "Pink Note" },
  { id: "green", bg: "#bbf7d0", label: "Green Note" },
];

export default function StickyNotesWidget() {
  const [isOpen, setIsOpen] = useState(false);
  const [activeColor, setActiveColor] = useState("yellow");
  const [notes, setNotes] = useState(() => {
    try {
      const saved = localStorage.getItem("taskyard_sticky_notes");
      return saved ? JSON.parse(saved) : {
        yellow: "🎯 Priority: Complete 20 LPA job prep\n• System design revision\n• LeetCode 3 problems\n• Send weekly update",
        blue: "💡 Idea: Add AI summary to weekly sprint review.",
        pink: "📌 Quick reminder: Cancel trial subscription before Sunday.",
        green: "✅ Health: Take a 15-min walk at 4 PM.",
      };
    } catch {
      return { yellow: "", blue: "", pink: "", green: "" };
    }
  });

  useEffect(() => {
    try {
      localStorage.setItem("taskyard_sticky_notes", JSON.stringify(notes));
    } catch (e) {
      console.error(e);
    }
  }, [notes]);

  const currentColorConfig = NOTE_COLORS.find((c) => c.id === activeColor) || NOTE_COLORS[0];

  const handleTextChange = (text) => {
    setNotes((prev) => ({
      ...prev,
      [activeColor]: text,
    }));
  };

  const handleOpenColor = (colorId) => {
    setActiveColor(colorId);
    setIsOpen(true);
  };

  return (
    <aside className="ty-desktop-sticky-container" aria-label="Quick sticky notes">
      {/* Edge Pills sitting at the right screen edge */}
      <div className="ty-edge-pills-rack" title="Quick Sticky Notes">
        {NOTE_COLORS.map((c) => (
          <button
            key={c.id}
            type="button"
            className={`ty-edge-pill ${isOpen && activeColor === c.id ? "active" : ""}`}
            style={{ backgroundColor: c.bg }}
            onClick={() => {
              if (isOpen && activeColor === c.id) {
                setIsOpen(false);
              } else {
                handleOpenColor(c.id);
              }
            }}
            aria-label={`Open ${c.label}`}
            title={`Sticky Note (${c.id})`}
          />
        ))}
      </div>

      {/* Floating Note Panel */}
      {isOpen && (
        <div
          className="ty-note-panel shadow-2xl"
          style={{ backgroundColor: currentColorConfig.bg }}
          role="dialog"
          aria-label="Active Sticky Note"
        >
          <div className="ty-note-panel-header">
            <div className="ty-note-color-dots">
              {NOTE_COLORS.map((c) => (
                <button
                  key={c.id}
                  type="button"
                  className={`ty-note-color-dot ${activeColor === c.id ? "selected" : ""}`}
                  style={{ backgroundColor: c.bg }}
                  onClick={() => setActiveColor(c.id)}
                  title={c.label}
                />
              ))}
            </div>

            <span className="ty-note-tag">Sticky Note</span>

            <button
              type="button"
              className="ty-note-close-btn"
              onClick={() => setIsOpen(false)}
              title="Close Note"
            >
              ✕
            </button>
          </div>

          <textarea
            className="ty-note-textarea"
            value={notes[activeColor] || ""}
            onChange={(e) => handleTextChange(e.target.value)}
            placeholder="Type quick thoughts or scratchpad notes here... (Saved automatically)"
            autoFocus
          />

          <div className="ty-note-footer">
            <small>High-contrast auto-saving sticky</small>
            <button
              type="button"
              className="ty-note-clear-btn"
              onClick={() => handleTextChange("")}
            >
              Clear
            </button>
          </div>
        </div>
      )}
    </aside>
  );
}
