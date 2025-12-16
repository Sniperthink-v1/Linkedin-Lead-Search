const express = require("express");
const { authenticateToken } = require("../middleware/auth");
const {
  getCreditBalance,
  getCreditHistory,
  addCredits,
} = require("../utils/credits");

const router = express.Router();

// GET /api/credits/balance - Get user's credit balance
router.get("/balance", authenticateToken, async (req, res) => {
  try {
    const balance = await getCreditBalance(req.user.id);
    res.json({
      success: true,
      credits: balance,
    });
  } catch (error) {
    console.error("Get credit balance error:", error);
    res.status(500).json({ error: "Failed to get credit balance" });
  }
});

// GET /api/credits/history - Get user's credit transaction history
router.get("/history", authenticateToken, async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 50;
    const history = await getCreditHistory(req.user.id, limit);

    res.json({
      success: true,
      transactions: history,
    });
  } catch (error) {
    console.error("Get credit history error:", error);
    res.status(500).json({ error: "Failed to get credit history" });
  }
});

// POST /api/credits/purchase - Purchase credits (placeholder for payment integration)
router.post("/purchase", authenticateToken, async (req, res) => {
  try {
    const { amount, paymentId } = req.body;

    if (!amount || amount <= 0) {
      return res.status(400).json({ error: "Invalid amount" });
    }

    // TODO: Integrate with payment gateway (Stripe, Razorpay, etc.)
    // For now, this is a placeholder

    const result = await addCredits(
      req.user.id,
      amount,
      "purchase",
      `Purchased ${amount} credits - Payment ID: ${paymentId || "N/A"}`
    );

    res.json({
      success: true,
      message: "Credits purchased successfully",
      newBalance: result.newBalance,
    });
  } catch (error) {
    console.error("Purchase credits error:", error);
    res.status(500).json({ error: "Failed to purchase credits" });
  }
});

// POST /api/credits/admin/add - Admin: Add credits to a user
router.post("/admin/add", authenticateToken, async (req, res) => {
  try {
    // TODO: Add admin role check
    const { userId, amount, description } = req.body;

    if (!userId || !amount) {
      return res.status(400).json({ error: "User ID and amount are required" });
    }

    const result = await addCredits(
      userId,
      amount,
      "admin_adjustment",
      description || "Admin credit adjustment"
    );

    res.json({
      success: true,
      message: "Credits added successfully",
      newBalance: result.newBalance,
    });
  } catch (error) {
    console.error("Admin add credits error:", error);
    res.status(500).json({ error: "Failed to add credits" });
  }
});

module.exports = router;
