import React, { useState } from "react";
import { Mail, AlertCircle, CheckCircle, X } from "lucide-react";

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:3000";

const EmailVerificationBanner = ({ user, onUpdate }) => {
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [dismissed, setDismissed] = useState(false);

  if (!user || user.emailVerified || dismissed) {
    return null;
  }

  const handleResendVerification = async () => {
    setLoading(true);
    setMessage("");

    try {
      const token = localStorage.getItem("authToken");
      const response = await fetch(`${API_URL}/api/auth/resend-verification`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
      });

      const data = await response.json();

      if (data.success) {
        setMessage("✓ Verification email sent! Please check your inbox.");
      } else {
        setMessage(data.error || "Failed to send verification email");
      }
    } catch (error) {
      console.error("Resend verification error:", error);
      setMessage("Failed to connect to server. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-yellow-500 bg-opacity-10 border border-yellow-500 border-opacity-30 rounded-lg p-4 mb-6">
      <div className="flex items-start gap-3">
        <AlertCircle className="w-5 h-5 text-yellow-500 flex-shrink-0 mt-0.5" />
        <div className="flex-1">
          <h3 className="text-yellow-500 font-semibold mb-1">
            Email Verification Required
          </h3>
          <p className="text-gray-300 text-sm mb-3">
            Please verify your email address to unlock all features. Check your
            inbox for the verification link.
          </p>

          {message && (
            <div
              className={`text-sm mb-3 ${
                message.startsWith("✓") ? "text-green-400" : "text-red-400"
              }`}
            >
              {message}
            </div>
          )}

          <button
            onClick={handleResendVerification}
            disabled={loading}
            className="px-4 py-2 bg-yellow-500 hover:bg-yellow-600 text-black rounded-lg font-semibold text-sm transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
          >
            {loading ? (
              <>
                <div className="animate-spin rounded-full h-4 w-4 border-2 border-black border-t-transparent" />
                Sending...
              </>
            ) : (
              <>
                <Mail className="w-4 h-4" />
                Resend Verification Email
              </>
            )}
          </button>
        </div>
        <button
          onClick={() => setDismissed(true)}
          className="text-gray-400 hover:text-white transition-colors"
          title="Dismiss"
        >
          <X className="w-5 h-5" />
        </button>
      </div>
    </div>
  );
};

export default EmailVerificationBanner;
