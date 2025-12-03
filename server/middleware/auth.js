const { verifyToken } = require("../utils/auth");
const { PrismaClient } = require("@prisma/client");

const prisma = new PrismaClient();

/**
 * Middleware to verify JWT token and attach user to request
 */
async function authenticateToken(req, res, next) {
  try {
    // Get token from Authorization header or cookies
    const authHeader = req.headers["authorization"];
    const token = authHeader && authHeader.split(" ")[1]; // Bearer TOKEN

    if (!token) {
      return res.status(401).json({ error: "Access token required" });
    }

    // Verify token
    const decoded = verifyToken(token);

    // Get user from database
    const user = await prisma.user.findUnique({
      where: { id: decoded.userId },
      select: {
        id: true,
        email: true,
        name: true,
        emailVerified: true,
        accountStatus: true,
      },
    });

    if (!user) {
      return res.status(401).json({ error: "User not found" });
    }

    if (user.accountStatus !== "active") {
      return res.status(403).json({ error: "Account is suspended or deleted" });
    }

    // Attach user to request
    req.user = user;
    next();
  } catch (error) {
    console.error("Authentication error:", error);
    return res.status(403).json({ error: "Invalid or expired token" });
  }
}

/**
 * Middleware to check if user's email is verified
 */
function requireEmailVerification(req, res, next) {
  if (!req.user.emailVerified) {
    return res.status(403).json({
      error: "Email verification required",
      message: "Please verify your email address to access this feature",
    });
  }
  next();
}

/**
 * Middleware to check daily search limit
 */
async function checkSearchLimit(req, res, next) {
  try {
    // For testing, skip limit check
    const TESTING_MODE = true; // Set to false in production
    if (TESTING_MODE) {
      return next();
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const searchCount = await prisma.search.count({
      where: {
        userId: req.user.id,
        createdAt: {
          gte: today,
        },
      },
    });

    const DAILY_LIMIT = 3;
    if (searchCount >= DAILY_LIMIT) {
      return res.status(429).json({
        error: "Daily search limit reached",
        message: `You have reached your daily limit of ${DAILY_LIMIT} searches. Please try again tomorrow.`,
        limit: DAILY_LIMIT,
        used: searchCount,
      });
    }

    // Attach remaining searches to request
    req.remainingSearches = DAILY_LIMIT - searchCount;
    next();
  } catch (error) {
    console.error("Search limit check error:", error);
    return res.status(500).json({ error: "Failed to check search limit" });
  }
}

module.exports = {
  authenticateToken,
  requireEmailVerification,
  checkSearchLimit,
};
