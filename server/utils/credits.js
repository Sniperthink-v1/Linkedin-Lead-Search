const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

// API Cost Configuration
// Based on actual API pricing:
// - Serper API: ~$0.001 per search (approximation)
// - Gemini API: Free tier has limits, but for paid: ~$0.0001 per call
const API_COSTS = {
  SERPER_PER_CALL: 0.001, // $0.001 per Serper API call
  GEMINI_PER_CALL: 0.0001, // $0.0001 per Gemini API call
  MARKUP_MULTIPLIER: 1.25, // Charge users 1.25x the actual cost
};

/**
 * Calculate the cost for a search operation
 * @param {number} serperCalls - Number of Serper API calls made
 * @param {number} geminiCalls - Number of Gemini API calls made
 * @returns {object} - { actualCost, chargedCost }
 */
function calculateSearchCost(serperCalls = 0, geminiCalls = 0) {
  const actualCost =
    serperCalls * API_COSTS.SERPER_PER_CALL +
    geminiCalls * API_COSTS.GEMINI_PER_CALL;

  const chargedCost = actualCost * API_COSTS.MARKUP_MULTIPLIER;

  return {
    actualCost: Math.round(actualCost * 1000000) / 1000000, // Round to 6 decimals
    chargedCost: Math.round(chargedCost * 1000000) / 1000000,
  };
}

/**
 * Check if user has sufficient credits
 * @param {string} userId - User ID
 * @param {number} requiredCredits - Credits required for operation
 * @returns {Promise<{sufficient: boolean, currentBalance: number}>}
 */
async function checkCredits(userId, requiredCredits) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { credits: true },
  });

  if (!user) {
    throw new Error("User not found");
  }

  return {
    sufficient: user.credits >= requiredCredits,
    currentBalance: user.credits,
  };
}

/**
 * Deduct credits from user and create transaction record
 * @param {string} userId - User ID
 * @param {object} transactionData - Transaction details
 * @returns {Promise<{success: boolean, newBalance: number, transaction: object}>}
 */
async function deductCredits(userId, transactionData) {
  const {
    amount, // Amount to deduct (positive number)
    type = "search",
    description,
    searchType,
    apiCostActual,
    apiCostCharged,
    serperCalls,
    geminiCalls,
    resultCount,
  } = transactionData;

  try {
    // Use transaction to ensure atomicity
    const result = await prisma.$transaction(async (tx) => {
      // Get current user balance
      const user = await tx.user.findUnique({
        where: { id: userId },
        select: { credits: true },
      });

      if (!user) {
        throw new Error("User not found");
      }

      const balanceBefore = user.credits;
      const balanceAfter = balanceBefore - amount;

      if (balanceAfter < 0) {
        throw new Error("Insufficient credits");
      }

      // Update user balance
      await tx.user.update({
        where: { id: userId },
        data: { credits: balanceAfter },
      });

      // Create transaction record
      const transaction = await tx.creditTransaction.create({
        data: {
          userId,
          amount: -amount, // Negative for deductions
          type,
          description,
          searchType,
          apiCostActual,
          apiCostCharged,
          serperCalls,
          geminiCalls,
          resultCount,
          balanceBefore,
          balanceAfter,
        },
      });

      return { balanceAfter, transaction };
    });

    return {
      success: true,
      newBalance: result.balanceAfter,
      transaction: result.transaction,
    };
  } catch (error) {
    console.error("Credit deduction error:", error);
    throw error;
  }
}

/**
 * Add credits to user (for purchases or admin adjustments)
 * @param {string} userId - User ID
 * @param {number} amount - Credits to add
 * @param {string} type - Transaction type
 * @param {string} description - Description
 * @returns {Promise<{success: boolean, newBalance: number}>}
 */
async function addCredits(userId, amount, type = "purchase", description) {
  try {
    const result = await prisma.$transaction(async (tx) => {
      const user = await tx.user.findUnique({
        where: { id: userId },
        select: { credits: true },
      });

      if (!user) {
        throw new Error("User not found");
      }

      const balanceBefore = user.credits;
      const balanceAfter = balanceBefore + amount;

      await tx.user.update({
        where: { id: userId },
        data: { credits: balanceAfter },
      });

      await tx.creditTransaction.create({
        data: {
          userId,
          amount, // Positive for additions
          type,
          description,
          balanceBefore,
          balanceAfter,
        },
      });

      return { balanceAfter };
    });

    return {
      success: true,
      newBalance: result.balanceAfter,
    };
  } catch (error) {
    console.error("Credit addition error:", error);
    throw error;
  }
}

/**
 * Get user's credit transaction history
 * @param {string} userId - User ID
 * @param {number} limit - Number of transactions to fetch
 * @returns {Promise<Array>}
 */
async function getCreditHistory(userId, limit = 50) {
  return await prisma.creditTransaction.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
    take: limit,
  });
}

/**
 * Get user's current credit balance
 * @param {string} userId - User ID
 * @returns {Promise<number>}
 */
async function getCreditBalance(userId) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { credits: true },
  });

  return user ? user.credits : 0;
}

module.exports = {
  API_COSTS,
  calculateSearchCost,
  checkCredits,
  deductCredits,
  addCredits,
  getCreditHistory,
  getCreditBalance,
};
