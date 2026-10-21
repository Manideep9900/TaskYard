const express = require("express");
const cors = require("cors");
const path = require("path");
const taskRoutes = require("./routes/tasks");
const authRoutes = require("./routes/auth");
const billingRoutes = require("./routes/billing");
const webhookRoutes = require("./routes/webhook");

const app = express();

// CORS Configuration
const allowedOrigins = (process.env.FRONTEND_URL || "http://localhost:5173")
  .split(",")
  .map((origin) => origin.trim())
  .filter(Boolean);

app.use(
  cors({
    origin: (origin, callback) => {
      // allow requests with no origin (like curl, Postman, mobile) or matching allowed list
      if (!origin || allowedOrigins.includes(origin) || allowedOrigins.includes("*")) {
        return callback(null, true);
      }
      return callback(new Error(`CORS origin ${origin} not allowed by policy`));
    },
    credentials: true,
  })
);

// Stripe webhook needs raw body — must come BEFORE express.json()
app.use("/webhook", express.raw({ type: "application/json" }), webhookRoutes);

// Parse JSON for all other routes
app.use(express.json());

// Serve uploaded images as static files
app.use("/uploads", express.static(path.join(__dirname, "uploads")));

// Home route
app.get("/", (req, res) => {
  res.send("Task Manager Backend is running!");
});

// Health check
app.get("/health", (req, res) => {
  res.json({
    status: "OK",
    message: "Backend is healthy",
  });
});

// Routes
app.use("/tasks", taskRoutes);
app.use("/auth", authRoutes);
app.use("/billing", billingRoutes);

// File upload / general error handling
app.use((err, req, res, next) => {
  if (err.code === "LIMIT_FILE_SIZE") {
    return res.status(400).json({ message: "File size must be under 1MB." });
  }
  if (err.message && err.message.includes("Only image files")) {
    return res.status(400).json({ message: err.message });
  }
  console.error("Unhandled server error:", err);
  res.status(500).json({ message: "Internal server error." });
});

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
