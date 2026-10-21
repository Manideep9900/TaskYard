const Stripe = require("stripe");
const pool = require("../db");

const setPlanByCustomer = (customerId, plan) =>
  pool.query("UPDATE users SET plan = $1 WHERE stripe_customer_id = $2", [plan, customerId]);

async function stripeWebhook(req, res) {
  const stripeKey = process.env.STRIPE_SECRET_KEY;
  if (!stripeKey) {
    return res.status(500).json({ message: "Stripe not configured on server." });
  }

  const stripe = new Stripe(stripeKey);
  const sig = req.headers["stripe-signature"];

  let event;
  try {
    event = stripe.webhooks.constructEvent(
      req.body,
      sig,
      process.env.STRIPE_WEBHOOK_SECRET
    );
  } catch (err) {
    console.error("Stripe signature check failed:", err.message);
    return res.status(400).json({ message: "Invalid signature." }); // forged or corrupted
  }

  try {
    switch (event.type) {
      case "checkout.session.completed": {
        const s = event.data.object;
        if (s.mode !== "subscription") break; // ignore one-off payments
        const userId = s.client_reference_id;
        if (userId) {
          // links the customer if it was not saved yet, and updates plan
          await pool.query(
            "UPDATE users SET plan = 'premium', stripe_customer_id = COALESCE(stripe_customer_id, $1) WHERE id = $2",
            [s.customer, userId]
          );
        } else {
          await setPlanByCustomer(s.customer, "premium");
        }
        break;
      }
      case "customer.subscription.updated": {
        const sub = event.data.object;
        if (["active", "trialing"].includes(sub.status)) {
          await setPlanByCustomer(sub.customer, "premium");
        } else if (["canceled", "unpaid", "incomplete_expired"].includes(sub.status)) {
          await setPlanByCustomer(sub.customer, "free");
        }
        // past_due / incomplete: Stripe is still retrying, keep current plan
        break;
      }
      case "customer.subscription.deleted":
        await setPlanByCustomer(event.data.object.customer, "free");
        break;
      default:
        break;
    }
    res.json({ received: true });
  } catch (err) {
    console.error("Webhook processing error:", err);
    res.status(500).json({ message: "Webhook failed." }); // 500 makes Stripe retry
  }
}

module.exports = stripeWebhook;
