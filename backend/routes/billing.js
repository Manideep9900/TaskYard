const express = require("express");
const router = express.Router();
const pool = require("../db");
const authMiddleware = require("../middleware/authMiddleware");

const getStripe = () => {
  if (!process.env.STRIPE_SECRET_KEY || process.env.STRIPE_SECRET_KEY === "YOUR_STRIPE_SECRET_KEY_HERE") {
    return null;
  }
  return require("stripe")(process.env.STRIPE_SECRET_KEY);
};

// Create a Stripe Checkout session for subscribing to premium
router.post("/create-checkout", authMiddleware, async (req, res) => {
  try {
    const stripe = getStripe();
    if (!stripe) {
      return res.status(503).json({
        message: "Stripe is not configured yet. Please configure STRIPE_SECRET_KEY in backend/.env.",
      });
    }

    const userId = req.user.id;
    const userResult = await pool.query(
      "SELECT id, email, stripe_customer_id, plan FROM users WHERE id = $1",
      [userId]
    );

    if (userResult.rows.length === 0) {
      return res.status(404).json({ message: "User not found." });
    }

    const user = userResult.rows[0];

    if (user.plan === "premium") {
      return res.status(400).json({ message: "You are already on the premium plan." });
    }

    let customerId = user.stripe_customer_id;

    if (!customerId) {
      const customer = await stripe.customers.create({
        email: user.email,
        metadata: { user_id: String(userId) },
      });
      customerId = customer.id;
      await pool.query(
        "UPDATE users SET stripe_customer_id = $1 WHERE id = $2",
        [customerId, userId]
      );
    }

    // Use configured price ID if available, otherwise use inline subscription price_data ($9.99/month)
    let lineItem;
    if (process.env.STRIPE_PRICE_ID && process.env.STRIPE_PRICE_ID !== "YOUR_STRIPE_PRICE_ID_HERE") {
      lineItem = {
        price: process.env.STRIPE_PRICE_ID,
        quantity: 1,
      };
    } else {
      lineItem = {
        price_data: {
          currency: "usd",
          product_data: {
            name: "TaskYard Premium Plan",
            description: "10,000 tasks/month, priority AI labeling, unlimited attachments",
          },
          unit_amount: 999, // $9.99 / month
          recurring: {
            interval: "month",
          },
        },
        quantity: 1,
      };
    }

    const session = await stripe.checkout.sessions.create({
      customer: customerId,
      client_reference_id: String(userId),
      mode: "subscription",
      line_items: [lineItem],
      success_url: `${process.env.FRONTEND_URL || "http://localhost:5173"}/profile?success=true`,
      cancel_url: `${process.env.FRONTEND_URL || "http://localhost:5173"}/profile?canceled=true`,
      metadata: { user_id: String(userId) },
    });

    res.json({ url: session.url });
  } catch (error) {
    console.error("Checkout error:", error);
    res.status(500).json({ message: error.message || "Unable to create checkout session." });
  }
});

// Create a Stripe Billing Portal session
router.post("/portal", authMiddleware, async (req, res) => {
  try {
    const stripe = getStripe();
    if (!stripe) {
      return res.status(503).json({
        message: "Stripe is not configured yet. Please configure STRIPE_SECRET_KEY in backend/.env.",
      });
    }

    const userId = req.user.id;
    const userResult = await pool.query(
      "SELECT stripe_customer_id FROM users WHERE id = $1",
      [userId]
    );

    if (userResult.rows.length === 0) {
      return res.status(404).json({ message: "User not found." });
    }

    const { stripe_customer_id } = userResult.rows[0];

    if (!stripe_customer_id) {
      return res.status(400).json({ message: "No billing account found. Please subscribe first." });
    }

    const session = await stripe.billingPortal.sessions.create({
      customer: stripe_customer_id,
      return_url: `${process.env.FRONTEND_URL || "http://localhost:5173"}/profile`,
    });

    res.json({ url: session.url });
  } catch (error) {
    console.error("Portal error:", error);
    res.status(500).json({ message: error.message || "Unable to open billing portal." });
  }
});

module.exports = router;

