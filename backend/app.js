const express = require("express");
const cors = require("cors");
const path = require("path");
const taskRoutes = require("./routes/tasks");
const authRoutes = require("./routes/auth");
const billingRoutes = require("./routes/billing");
const stripeWebhook = require("./routes/webhook");

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
app.post("/webhook/stripe", express.raw({ type: "application/json" }), stripeWebhook);

// Parse JSON for all other routes
app.use(express.json());

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
    return res.status(413).json({ message: "Image must be 1 MB or smaller." });
  }
  if (err.status === 400 || (err.message && err.message.includes("allowed"))) {
    return res.status(400).json({ message: err.message });
  }
  console.error("Unhandled server error:", err);
  res.status(500).json({ message: "Internal server error." });
});

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
