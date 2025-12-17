const express = require("express");
const { PrismaClient } = require("@prisma/client");
const { authenticateToken } = require("../middleware/auth");
const { requireAdmin } = require("../middleware/admin");
const { addCredits } = require("../utils/credits");

const router = express.Router();
const prisma = new PrismaClient();

// GET /api/admin/stats - Get dashboard statistics
router.get("/stats", authenticateToken, requireAdmin, async (req, res) => {
  try {
    // Get user statistics
    const totalUsers = await prisma.user.count();
    const activeUsers = await prisma.user.count({
      where: { accountStatus: "active" },
    });
    const verifiedUsers = await prisma.user.count({
      where: { emailVerified: true },
    });

    // Get search statistics
    const totalSearches = await prisma.search.count();
    const searchesToday = await prisma.search.count({
      where: {
        createdAt: {
          gte: new Date(new Date().setHours(0, 0, 0, 0)),
        },
      },
    });

    // Get credit statistics
    const creditTransactions = await prisma.creditTransaction.findMany({
      where: { type: "search" },
    });

    const totalRevenue = creditTransactions.reduce(
      (sum, tx) => sum + (tx.apiCostCharged || 0),
      0
    );
    const totalCost = creditTransactions.reduce(
      (sum, tx) => sum + (tx.apiCostActual || 0),
      0
    );
    const totalProfit = totalRevenue - totalCost;

    // Get saved leads count
    const totalSavedLeads = await prisma.savedLead.count();

    // Get API usage statistics
    const totalSerperCalls = creditTransactions.reduce(
      (sum, tx) => sum + (tx.serperCalls || 0),
      0
    );
    const totalGeminiCalls = creditTransactions.reduce(
      (sum, tx) => sum + (tx.geminiCalls || 0),
      0
    );

    // Get recent searches
    const recentSearches = await prisma.search.findMany({
      take: 10,
      orderBy: { createdAt: "desc" },
      include: {
        user: {
          select: { name: true, email: true },
        },
      },
    });

    // Get low credit users
    const lowCreditUsers = await prisma.user.findMany({
      where: {
        credits: { lt: 1.0 },
        accountStatus: "active",
      },
      select: {
        id: true,
        name: true,
        email: true,
        credits: true,
      },
      orderBy: { credits: "asc" },
      take: 10,
    });

    res.json({
      success: true,
      stats: {
        users: {
          total: totalUsers,
          active: activeUsers,
          verified: verifiedUsers,
        },
        searches: {
          total: totalSearches,
          today: searchesToday,
        },
        credits: {
          totalRevenue: Math.round(totalRevenue * 10000) / 10000,
          totalCost: Math.round(totalCost * 10000) / 10000,
          totalProfit: Math.round(totalProfit * 10000) / 10000,
          profitMargin: totalCost > 0 ? Math.round((totalProfit / totalCost) * 10000) / 100 : 0,
        },
        leads: {
          total: totalSavedLeads,
        },
        apiUsage: {
          serperCalls: totalSerperCalls,
          geminiCalls: totalGeminiCalls,
        },
      },
      recentSearches,
      lowCreditUsers,
    });
  } catch (error) {
    console.error("Get admin stats error:", error);
    res.status(500).json({ error: "Failed to get statistics" });
  }
});

// GET /api/admin/users - Get all users with pagination
router.get("/users", authenticateToken, requireAdmin, async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const skip = (page - 1) * limit;

    const users = await prisma.user.findMany({
      skip,
      take: limit,
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        name: true,
        email: true,
        emailVerified: true,
        accountStatus: true,
        credits: true,
        isAdmin: true,
        createdAt: true,
        lastLogin: true,
        _count: {
          select: {
            searches: true,
            savedLeads: true,
            creditTransactions: true,
          },
        },
      },
    });

    const totalUsers = await prisma.user.count();

    res.json({
      success: true,
      users,
      pagination: {
        page,
        limit,
        total: totalUsers,
        pages: Math.ceil(totalUsers / limit),
      },
    });
  } catch (error) {
    console.error("Get users error:", error);
    res.status(500).json({ error: "Failed to get users" });
  }
});

// GET /api/admin/user/:id - Get specific user details
router.get("/user/:id", authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;

    const user = await prisma.user.findUnique({
      where: { id },
      include: {
        searches: {
          orderBy: { createdAt: "desc" },
          take: 10,
        },
        creditTransactions: {
          orderBy: { createdAt: "desc" },
          take: 20,
        },
        savedLeads: {
          orderBy: { savedAt: "desc" },
          take: 10,
        },
      },
    });

    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    res.json({
      success: true,
      user,
    });
  } catch (error) {
    console.error("Get user details error:", error);
    res.status(500).json({ error: "Failed to get user details" });
  }
});

// POST /api/admin/user/:id/credits - Add or remove credits from a user
router.post("/user/:id/credits", authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const { amount, description } = req.body;

    if (amount === undefined || amount === null || amount === 0 || isNaN(amount)) {
      return res.status(400).json({ error: "Invalid amount" });
    }

    // addCredits can handle both positive (add) and negative (remove) amounts
    const result = await addCredits(
      id,
      amount, // Can be positive or negative
      amount > 0 ? "admin_adjustment" : "admin_deduction",
      description || `Admin ${amount > 0 ? 'credit' : 'debit'} by ${req.user.email}`
    );

    res.json({
      success: true,
      message: amount > 0 ? "Credits added successfully" : "Credits removed successfully",
      newBalance: result.newBalance,
    });
  } catch (error) {
    console.error("Adjust credits error:", error);
    res.status(500).json({ error: "Failed to adjust credits" });
  }
});

// PATCH /api/admin/user/:id/status - Update user account status
router.patch("/user/:id/status", authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    if (!["active", "suspended", "deleted"].includes(status)) {
      return res.status(400).json({ error: "Invalid status" });
    }

    const user = await prisma.user.update({
      where: { id },
      data: { accountStatus: status },
      select: {
        id: true,
        name: true,
        email: true,
        accountStatus: true,
      },
    });

    res.json({
      success: true,
      message: "User status updated",
      user,
    });
  } catch (error) {
    console.error("Update user status error:", error);
    res.status(500).json({ error: "Failed to update user status" });
  }
});

// GET /api/admin/transactions - Get all credit transactions
router.get("/transactions", authenticateToken, requireAdmin, async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 50;
    const skip = (page - 1) * limit;
    const type = req.query.type; // Optional filter by type

    const where = type ? { type } : {};

    const transactions = await prisma.creditTransaction.findMany({
      where,
      skip,
      take: limit,
      orderBy: { createdAt: "desc" },
      include: {
        user: {
          select: {
            name: true,
            email: true,
          },
        },
      },
    });

    const totalTransactions = await prisma.creditTransaction.count({ where });

    res.json({
      success: true,
      transactions,
      pagination: {
        page,
        limit,
        total: totalTransactions,
        pages: Math.ceil(totalTransactions / limit),
      },
    });
  } catch (error) {
    console.error("Get transactions error:", error);
    res.status(500).json({ error: "Failed to get transactions" });
  }
});

// POST /api/admin/make-admin - Make a user admin (for initial setup)
router.post("/make-admin", authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({ error: "Email is required" });
    }

    const user = await prisma.user.update({
      where: { email },
      data: { isAdmin: true },
      select: {
        id: true,
        name: true,
        email: true,
        isAdmin: true,
      },
    });

    res.json({
      success: true,
      message: "User is now an admin",
      user,
    });
  } catch (error) {
    console.error("Make admin error:", error);
    res.status(500).json({ error: "Failed to make user admin" });
  }
});

module.exports = router;
