const express = require("express");
const { PrismaClient } = require("@prisma/client");
const {
  hashPassword,
  comparePassword,
  generateToken,
  generateVerificationToken,
  isValidEmail,
  validatePassword,
} = require("../utils/auth");
const {
  sendVerificationEmail,
  sendPasswordResetEmail,
  sendWelcomeEmail,
} = require("../utils/email");
const { authenticateToken } = require("../middleware/auth");

const router = express.Router();
const prisma = new PrismaClient();

// POST /api/auth/signup - Register new user
router.post("/signup", async (req, res) => {
  try {
    const { email, password, name } = req.body;

    // Validation
    if (!email || !password || !name) {
      return res
        .status(400)
        .json({ error: "Email, password, and name are required" });
    }

    if (!isValidEmail(email)) {
      return res.status(400).json({ error: "Invalid email format" });
    }

    const passwordValidation = validatePassword(password);
    if (!passwordValidation.valid) {
      return res.status(400).json({ error: passwordValidation.message });
    }

    // Check if user already exists
    const existingUser = await prisma.user.findUnique({
      where: { email: email.toLowerCase() },
    });

    if (existingUser) {
      return res.status(409).json({ error: "Email already registered" });
    }

    // Hash password
    const hashedPassword = await hashPassword(password);

    // Generate verification token
    const verificationToken = generateVerificationToken();

    // Create user
    const user = await prisma.user.create({
      data: {
        email: email.toLowerCase(),
        password: hashedPassword,
        name,
        verificationToken,
        emailVerified: false,
      },
      select: {
        id: true,
        email: true,
        name: true,
        emailVerified: true,
        createdAt: true,
      },
    });

    // Send verification email
    try {
      await sendVerificationEmail(user.email, user.name, verificationToken);
    } catch (emailError) {
      console.error("Failed to send verification email:", emailError);
      // Don't fail signup if email fails
    }

    // Generate JWT token
    const token = generateToken({ userId: user.id, email: user.email });

    res.status(201).json({
      success: true,
      message:
        "Account created successfully. Please check your email to verify your account.",
      user,
      token,
    });
  } catch (error) {
    console.error("Signup error:", error);
    res.status(500).json({ error: "Failed to create account" });
  }
});

// POST /api/auth/login - Login user
router.post("/login", async (req, res) => {
  try {
    const { email, password } = req.body;

    // Validation
    if (!email || !password) {
      return res.status(400).json({ error: "Email and password are required" });
    }

    // Find user
    const user = await prisma.user.findUnique({
      where: { email: email.toLowerCase() },
    });

    if (!user || !user.password) {
      return res.status(401).json({ error: "Invalid email or password" });
    }

    // Check account status
    if (user.accountStatus !== "active") {
      return res.status(403).json({ error: "Account is suspended or deleted" });
    }

    // Verify password
    const isValidPassword = await comparePassword(password, user.password);
    if (!isValidPassword) {
      return res.status(401).json({ error: "Invalid email or password" });
    }

    // Update last login
    await prisma.user.update({
      where: { id: user.id },
      data: { lastLogin: new Date() },
    });

    // Generate JWT token
    const token = generateToken({ userId: user.id, email: user.email });

    res.json({
      success: true,
      message: "Login successful",
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        emailVerified: user.emailVerified,
      },
      token,
    });
  } catch (error) {
    console.error("Login error:", error);
    res.status(500).json({ error: "Failed to login" });
  }
});

// GET /api/auth/verify-email - Verify email with token
router.get("/verify-email", async (req, res) => {
  try {
    const { token } = req.query;

    if (!token) {
      return res.status(400).json({ error: "Verification token is required" });
    }

    // Find user by verification token
    const user = await prisma.user.findUnique({
      where: { verificationToken: token },
    });

    if (!user) {
      return res
        .status(400)
        .json({ error: "Invalid or expired verification token" });
    }

    if (user.emailVerified) {
      return res.json({ success: true, message: "Email already verified" });
    }

    // Update user as verified
    await prisma.user.update({
      where: { id: user.id },
      data: {
        emailVerified: true,
        verificationToken: null,
      },
    });

    // Send welcome email
    try {
      await sendWelcomeEmail(user.email, user.name);
    } catch (emailError) {
      console.error("Failed to send welcome email:", emailError);
    }

    res.json({
      success: true,
      message: "Email verified successfully! You can now use all features.",
    });
  } catch (error) {
    console.error("Email verification error:", error);
    res.status(500).json({ error: "Failed to verify email" });
  }
});

// POST /api/auth/resend-verification - Resend verification email
router.post("/resend-verification", authenticateToken, async (req, res) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.user.id },
    });

    if (user.emailVerified) {
      return res.status(400).json({ error: "Email already verified" });
    }

    // Generate new verification token
    const verificationToken = generateVerificationToken();

    await prisma.user.update({
      where: { id: user.id },
      data: { verificationToken },
    });

    // Send verification email
    await sendVerificationEmail(user.email, user.name, verificationToken);

    res.json({
      success: true,
      message: "Verification email sent successfully",
    });
  } catch (error) {
    console.error("Resend verification error:", error);
    res.status(500).json({ error: "Failed to resend verification email" });
  }
});

// POST /api/auth/forgot-password - Request password reset
router.post("/forgot-password", async (req, res) => {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({ error: "Email is required" });
    }

    const user = await prisma.user.findUnique({
      where: { email: email.toLowerCase() },
    });

    // Don't reveal if email exists
    if (!user) {
      return res.json({
        success: true,
        message: "If the email exists, a password reset link has been sent",
      });
    }

    // Generate reset token
    const resetToken = generateVerificationToken();
    const resetTokenExpiry = new Date(Date.now() + 3600000); // 1 hour

    await prisma.user.update({
      where: { id: user.id },
      data: {
        resetToken,
        resetTokenExpiry,
      },
    });

    // Send password reset email
    await sendPasswordResetEmail(user.email, user.name, resetToken);

    res.json({
      success: true,
      message: "If the email exists, a password reset link has been sent",
    });
  } catch (error) {
    console.error("Forgot password error:", error);
    res.status(500).json({ error: "Failed to process password reset request" });
  }
});

// POST /api/auth/reset-password - Reset password with token
router.post("/reset-password", async (req, res) => {
  try {
    const { token, newPassword } = req.body;

    if (!token || !newPassword) {
      return res
        .status(400)
        .json({ error: "Token and new password are required" });
    }

    const passwordValidation = validatePassword(newPassword);
    if (!passwordValidation.valid) {
      return res.status(400).json({ error: passwordValidation.message });
    }

    // Find user by reset token
    const user = await prisma.user.findUnique({
      where: { resetToken: token },
    });

    if (!user || !user.resetTokenExpiry) {
      return res.status(400).json({ error: "Invalid or expired reset token" });
    }

    // Check if token is expired
    if (new Date() > user.resetTokenExpiry) {
      return res.status(400).json({ error: "Reset token has expired" });
    }

    // Hash new password
    const hashedPassword = await hashPassword(newPassword);

    // Update password and clear reset token
    await prisma.user.update({
      where: { id: user.id },
      data: {
        password: hashedPassword,
        resetToken: null,
        resetTokenExpiry: null,
      },
    });

    res.json({
      success: true,
      message:
        "Password reset successfully. You can now login with your new password.",
    });
  } catch (error) {
    console.error("Reset password error:", error);
    res.status(500).json({ error: "Failed to reset password" });
  }
});

// GET /api/auth/me - Get current user info
router.get("/me", authenticateToken, async (req, res) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.user.id },
      select: {
        id: true,
        email: true,
        name: true,
        emailVerified: true,
        accountStatus: true,
        provider: true,
        createdAt: true,
        lastLogin: true,
      },
    });

    // Get search statistics
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const searchesToday = await prisma.search.count({
      where: {
        userId: user.id,
        createdAt: { gte: today },
      },
    });

    const totalSearches = await prisma.search.count({
      where: { userId: user.id },
    });

    const savedLeadsCount = await prisma.savedLead.count({
      where: { userId: user.id },
    });

    res.json({
      success: true,
      user: {
        ...user,
        stats: {
          searchesToday,
          totalSearches,
          savedLeadsCount,
          remainingSearches: Math.max(0, 3 - searchesToday), // 3 searches per day limit
        },
      },
    });
  } catch (error) {
    console.error("Get user error:", error);
    res.status(500).json({ error: "Failed to get user information" });
  }
});

// POST /api/auth/logout - Logout user (client-side token removal)
router.post("/logout", authenticateToken, (req, res) => {
  res.json({
    success: true,
    message: "Logged out successfully",
  });
});

module.exports = router;
