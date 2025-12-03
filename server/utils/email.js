const nodemailer = require("nodemailer");

const EMAIL_HOST = process.env.EMAIL_HOST;
const EMAIL_PORT = process.env.EMAIL_PORT;
const EMAIL_USER = process.env.EMAIL_USER;
const EMAIL_PASSWORD = process.env.EMAIL_PASSWORD;
const EMAIL_FROM = process.env.EMAIL_FROM;
const FRONTEND_URL = process.env.FRONTEND_URL || "http://localhost:5173";

// Create reusable transporter
const transporter = nodemailer.createTransport({
  host: EMAIL_HOST,
  port: EMAIL_PORT,
  secure: false, // true for 465, false for other ports
  auth: {
    user: EMAIL_USER,
    pass: EMAIL_PASSWORD,
  },
});

/**
 * Send verification email to user
 * @param {string} email - User's email
 * @param {string} name - User's name
 * @param {string} token - Verification token
 */
async function sendVerificationEmail(email, name, token) {
  const verificationLink = `${FRONTEND_URL}/verify-email?token=${token}`;

  const mailOptions = {
    from: EMAIL_FROM,
    to: email,
    subject: "Verify your email - LinkedIn Lead Search",
    html: `
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
          .content { background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px; }
          .button { display: inline-block; padding: 15px 30px; background: #667eea; color: white; text-decoration: none; border-radius: 5px; margin: 20px 0; }
          .footer { text-align: center; color: #666; font-size: 12px; margin-top: 20px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>Welcome to LinkedIn Lead Search!</h1>
          </div>
          <div class="content">
            <p>Hi <strong>${name}</strong>,</p>
            <p>Thank you for signing up! Please verify your email address to activate your account and start generating leads.</p>
            <p style="text-align: center;">
              <a href="${verificationLink}" class="button">Verify Email Address</a>
            </p>
            <p>Or copy and paste this link into your browser:</p>
            <p style="word-break: break-all; color: #667eea;">${verificationLink}</p>
            <p><strong>This link will expire in 24 hours.</strong></p>
            <p>If you didn't create an account, you can safely ignore this email.</p>
          </div>
          <div class="footer">
            <p>&copy; 2025 LinkedIn Lead Search. All rights reserved.</p>
          </div>
        </div>
      </body>
      </html>
    `,
  };

  try {
    await transporter.sendMail(mailOptions);
    console.log(`Verification email sent to ${email}`);
  } catch (error) {
    console.error("Error sending verification email:", error);
    throw new Error("Failed to send verification email");
  }
}

/**
 * Send password reset email
 * @param {string} email - User's email
 * @param {string} name - User's name
 * @param {string} token - Reset token
 */
async function sendPasswordResetEmail(email, name, token) {
  const resetLink = `${FRONTEND_URL}/reset-password?token=${token}`;

  const mailOptions = {
    from: EMAIL_FROM,
    to: email,
    subject: "Reset your password - LinkedIn Lead Search",
    html: `
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
          .content { background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px; }
          .button { display: inline-block; padding: 15px 30px; background: #667eea; color: white; text-decoration: none; border-radius: 5px; margin: 20px 0; }
          .warning { background: #fff3cd; border-left: 4px solid #ffc107; padding: 15px; margin: 20px 0; }
          .footer { text-align: center; color: #666; font-size: 12px; margin-top: 20px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>Password Reset Request</h1>
          </div>
          <div class="content">
            <p>Hi <strong>${name}</strong>,</p>
            <p>We received a request to reset your password. Click the button below to create a new password:</p>
            <p style="text-align: center;">
              <a href="${resetLink}" class="button">Reset Password</a>
            </p>
            <p>Or copy and paste this link into your browser:</p>
            <p style="word-break: break-all; color: #667eea;">${resetLink}</p>
            <div class="warning">
              <strong>⚠️ Security Notice:</strong> This link will expire in 1 hour. If you didn't request a password reset, please ignore this email or contact support if you're concerned about your account security.
            </div>
          </div>
          <div class="footer">
            <p>&copy; 2025 LinkedIn Lead Search. All rights reserved.</p>
          </div>
        </div>
      </body>
      </html>
    `,
  };

  try {
    await transporter.sendMail(mailOptions);
    console.log(`Password reset email sent to ${email}`);
  } catch (error) {
    console.error("Error sending password reset email:", error);
    throw new Error("Failed to send password reset email");
  }
}

/**
 * Send welcome email after successful verification
 * @param {string} email - User's email
 * @param {string} name - User's name
 */
async function sendWelcomeEmail(email, name) {
  const mailOptions = {
    from: EMAIL_FROM,
    to: email,
    subject: "Welcome to LinkedIn Lead Search!",
    html: `
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
          .content { background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px; }
          .feature { background: white; padding: 15px; margin: 10px 0; border-radius: 5px; border-left: 4px solid #667eea; }
          .button { display: inline-block; padding: 15px 30px; background: #667eea; color: white; text-decoration: none; border-radius: 5px; margin: 20px 0; }
          .footer { text-align: center; color: #666; font-size: 12px; margin-top: 20px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>🎉 Account Verified!</h1>
          </div>
          <div class="content">
            <p>Hi <strong>${name}</strong>,</p>
            <p>Your account is now verified and ready to use! Here's what you can do:</p>
            <div class="feature">
              <strong>🔍 LinkedIn Lead Search:</strong> Find professionals by job title and location with AI-powered search
            </div>
            <div class="feature">
              <strong>🏢 Business Lead Search:</strong> Discover businesses with contact details, ratings, and reviews
            </div>
            <div class="feature">
              <strong>📊 Search History:</strong> Access your past searches and saved leads anytime
            </div>
            <div class="feature">
              <strong>📥 Export Data:</strong> Download leads to Excel for easy management
            </div>
            <p style="text-align: center;">
              <a href="${FRONTEND_URL}" class="button">Start Searching Now</a>
            </p>
            <p><strong>Daily Limit:</strong> You can perform 3 searches per day. Make them count!</p>
          </div>
          <div class="footer">
            <p>&copy; 2025 LinkedIn Lead Search. All rights reserved.</p>
          </div>
        </div>
      </body>
      </html>
    `,
  };

  try {
    await transporter.sendMail(mailOptions);
    console.log(`Welcome email sent to ${email}`);
  } catch (error) {
    console.error("Error sending welcome email:", error);
    // Don't throw error for welcome email, it's not critical
  }
}

module.exports = {
  sendVerificationEmail,
  sendPasswordResetEmail,
  sendWelcomeEmail,
};
