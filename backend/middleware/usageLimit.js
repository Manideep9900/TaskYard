const pool = require("../db");

const PLAN_LIMITS = {
  free: 100,
  premium: 10000,
};

const usageLimit = async (req, res, next) => {
  try {
    const userId = req.user.id;

    const userResult = await pool.query(
      "SELECT plan, tasks_created_this_month, month_reset_at FROM users WHERE id = $1",
      [userId]
    );

    if (userResult.rows.length === 0) {
      return res.status(404).json({ message: "User not found." });
    }

    const user = userResult.rows[0];
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

    // Reset counter if we're in a new month
    if (new Date(user.month_reset_at) < monthStart) {
      await pool.query(
        "UPDATE users SET tasks_created_this_month = 0, month_reset_at = $1 WHERE id = $2",
        [monthStart, userId]
      );
      user.tasks_created_this_month = 0;
    }

    const limit = PLAN_LIMITS[user.plan] || PLAN_LIMITS.free;

    if (user.tasks_created_this_month >= limit) {
      return res.status(403).json({
        message: `Monthly task limit reached (${limit} tasks on the ${user.plan} plan). Upgrade to create more tasks.`,
        limit,
        used: user.tasks_created_this_month,
        plan: user.plan,
      });
    }

    req.userPlan = user.plan;
    req.tasksUsed = user.tasks_created_this_month;
    req.taskLimit = limit;

    next();
  } catch (error) {
    console.error("Usage limit check error:", error);
    res.status(500).json({ message: "Unable to verify usage limits." });
  }
};

module.exports = usageLimit;

