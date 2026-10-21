const express = require("express");
const router = express.Router();
const pool = require("../db");

// Stripe webhook — this route receives raw body
router.post("/stripe", async (req, res) => {
  if (!process.env.STRIPE_SECRET_KEY || process.env.STRIPE_SECRET_KEY === "YOUR_STRIPE_SECRET_KEY_HERE") {
    return res.status(503).send("Stripe not configured.");
  }

  const stripe = require("stripe")(process.env.STRIPE_SECRET_KEY);
  const sig = req.headers["stripe-signature"];

  let event;
  try {
    if (process.env.STRIPE_WEBHOOK_SECRET && process.env.STRIPE_WEBHOOK_SECRET !== "YOUR_STRIPE_WEBHOOK_SECRET_HERE") {
      event = stripe.webhooks.constructEvent(
        req.body,
        sig,
        process.env.STRIPE_WEBHOOK_SECRET
      );
    } else {
      // In development or when webhook secret is not set yet, parse from json body if possible
      event = JSON.parse(req.body.toString());
    }
  } catch (err) {
    console.error("Webhook signature verification failed:", err.message);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  try {
    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object;
        const customerId = session.customer;

        await pool.query(
          "UPDATE users SET plan = 'premium' WHERE stripe_customer_id = $1",
          [customerId]
        );
        console.log(`User upgraded to premium: customer ${customerId}`);
        break;
      }

      case "customer.subscription.updated": {
        const subscription = event.data.object;
        const customerId = subscription.customer;
        const status = subscription.status;

        if (status === "active") {
          await pool.query(
            "UPDATE users SET plan = 'premium' WHERE stripe_customer_id = $1",
            [customerId]
          );
        } else if (status === "canceled" || status === "unpaid") {
          await pool.query(
            "UPDATE users SET plan = 'free' WHERE stripe_customer_id = $1",
            [customerId]
          );
        }
        break;
      }

      case "customer.subscription.deleted": {
        const subscription = event.data.object;
        const customerId = subscription.customer;

        await pool.query(
          "UPDATE users SET plan = 'free' WHERE stripe_customer_id = $1",
          [customerId]
        );
        console.log(`User downgraded to free: customer ${customerId}`);
        break;
      }

      default:
        console.log(`Unhandled event type: ${event.type}`);
    }
  } catch (error) {
    console.error("Webhook handler error:", error);
    return res.status(500).json({ message: "Webhook handler failed." });
  }

  res.json({ received: true });
});

module.exports = router;

