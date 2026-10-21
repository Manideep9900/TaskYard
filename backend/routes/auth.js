const express = require("express");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const { OAuth2Client } = require("google-auth-library");

const router = express.Router();
const pool = require("../db");
const authMiddleware = require("../middleware/authMiddleware");

const getGoogleClient = () => {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  if (!clientId || clientId === "YOUR_GOOGLE_CLIENT_ID_HERE") {
    return null;
  }
  return new OAuth2Client(clientId);
};

// Register with email/password
router.post("/register", async (req, res) => {
  try {
    const { name, email, password } = req.body;

    if (!name || !email || !password) {
      return res.status(400).json({
        message: "Name, email and password are required.",
      });
    }

    const existingUser = await pool.query(
      "SELECT id FROM users WHERE email = $1",
      [email]
    );

    if (existingUser.rows.length > 0) {
      return res.status(409).json({
        message: "Email already registered.",
      });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const result = await pool.query(
      "INSERT INTO users (name, email, password) VALUES ($1, $2, $3) RETURNING id, name, email, plan",
      [name, email, hashedPassword]
    );

    res.status(201).json({
      message: "User registered successfully.",
      user: result.rows[0],
    });
  } catch (error) {
    console.error("Register error:", error);
    res.status(500).json({
      message: "Server error.",
    });
  }
});

// Login with email/password
router.post("/login", async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({
        message: "Email and password are required.",
      });
    }

    const result = await pool.query(
      "SELECT * FROM users WHERE email = $1",
      [email]
    );

    if (result.rows.length === 0) {
      return res.status(401).json({
        message: "Invalid email or password.",
      });
    }

    const user = result.rows[0];

    if (!user.password) {
      return res.status(401).json({
        message: "This account uses Google login. Please sign in with Google.",
      });
    }

    const passwordMatch = await bcrypt.compare(password, user.password);

    if (!passwordMatch) {
      return res.status(401).json({
        message: "Invalid email or password.",
      });
    }

    const token = jwt.sign(
      { id: user.id, email: user.email },
      process.env.JWT_SECRET,
      { expiresIn: "7d" }
    );

    res.json({
      message: "Login successful.",
      token,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        avatar_url: user.avatar_url,
        plan: user.plan || "free",
      },
    });
  } catch (error) {
    console.error("Login error:", error);
    res.status(500).json({
      message: "Server error.",
    });
  }
});

// Google login/register
router.post("/google", async (req, res) => {
  try {
    const { credential } = req.body;

    if (!credential) {
      return res.status(400).json({ message: "Google credential is required." });
    }

    const client = getGoogleClient();

    if (!client) {
      return res.status(503).json({ message: "Google login is not configured." });
    }

    const ticket = await client.verifyIdToken({
      idToken: credential,
      audience: process.env.GOOGLE_CLIENT_ID,
    });
    const payload = ticket.getPayload();

    if (!payload.email || !payload.email_verified) {
      return res.status(401).json({ message: "Google account email is not verified." });
    }

    const googleId = payload.sub;
    const email = payload.email;
    const name = payload.name;
    const picture = payload.picture;

    // Check if user exists by google_id first, then fall back to email match
    let userResult = await pool.query(
      "SELECT * FROM users WHERE google_id = $1",
      [googleId]
    );

    if (userResult.rows.length === 0) {
      userResult = await pool.query(
        "SELECT * FROM users WHERE email = $1",
        [email]
      );
    }

    let user;

    if (userResult.rows.length > 0) {
      user = userResult.rows[0];
      // Update google_id and avatar if missing
      await pool.query(
        "UPDATE users SET google_id = COALESCE(google_id, $1), avatar_url = COALESCE(avatar_url, $2) WHERE id = $3",
        [googleId, picture, user.id]
      );
    } else {
      // Create new user
      const result = await pool.query(
        "INSERT INTO users (name, email, google_id, avatar_url, plan) VALUES ($1, $2, $3, $4, 'free') RETURNING *",
        [name, email, googleId, picture]
      );
      user = result.rows[0];
    }

    const token = jwt.sign(
      { id: user.id, email: user.email },
      process.env.JWT_SECRET,
      { expiresIn: "7d" }
    );

    res.json({
      message: "Login successful.",
      token,
      user: {
        id: user.id,
        name: user.name || name,
        email: user.email || email,
        avatar_url: user.avatar_url || picture,
        plan: user.plan || "free",
      },
    });
  } catch (error) {
    console.error("Google auth error:", error);
    res.status(401).json({
      message: error.message || "Google authentication failed.",
    });
  }
});

// Get user profile with plan and monthly usage stats
router.get("/profile", authMiddleware, async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT id, name, email, avatar_url, plan, tasks_created_this_month, month_reset_at,
              (google_id IS NOT NULL) AS has_google,
              (password IS NOT NULL) AS has_password
       FROM users WHERE id = $1`,
      [req.user.id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ message: "User not found." });
    }

    const user = result.rows[0];

    // Check and reset monthly counter if new month
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    let tasksCreated = user.tasks_created_this_month || 0;

    if (new Date(user.month_reset_at) < monthStart) {
      await pool.query(
        "UPDATE users SET tasks_created_this_month = 0, month_reset_at = $1 WHERE id = $2",
        [monthStart, req.user.id]
      );
      tasksCreated = 0;
    }

    const limit = user.plan === "premium" ? 10000 : 100;

    res.json({
      id: user.id,
      name: user.name,
      email: user.email,
      avatar_url: user.avatar_url,
      plan: user.plan || "free",
      has_google: user.has_google,
      has_password: user.has_password,
      usage: {
        tasks_created: tasksCreated,
        limit,
      },
    });
  } catch (error) {
    console.error("Profile error:", error);
    res.status(500).json({ message: "Unable to load profile." });
  }
});

module.exports = router;
