import React, { useState } from "react";
import {
  Mail,
  Lock,
  User,
  Eye,
  EyeOff,
  LogIn,
  UserPlus,
  Sparkles,
} from "lucide-react";

const AuthModal = ({ isOpen, onClose, onLoginSuccess }) => {
  const [mode, setMode] = useState("login"); // "login" or "signup"
  const [formData, setFormData] = useState({
    email: "",
    password: "",
    name: "",
  });
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setMessage("");
    setLoading(true);

    try {
      const endpoint =
        mode === "login" ? "/api/auth/login" : "/api/auth/signup";
      const response = await fetch(`http://localhost:3000${endpoint}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
      });

      const data = await response.json();

      if (data.success) {
        // Store token in localStorage
        localStorage.setItem("authToken", data.token);
        localStorage.setItem("user", JSON.stringify(data.user));

        if (mode === "signup") {
          setMessage(
            "Account created! Please check your email to verify your account."
          );
          setTimeout(() => {
            onLoginSuccess(data.user, data.token);
            onClose();
          }, 2000);
        } else {
          onLoginSuccess(data.user, data.token);
          onClose();
        }
      } else {
        setError(data.error || "Authentication failed");
      }
    } catch (err) {
      console.error("Auth error:", err);
      setError("Failed to connect to server. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-darker rounded-2xl shadow-2xl border border-gray-800 w-full max-w-md relative">
        {/* Close button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-gray-400 hover:text-white transition-colors"
        >
          ✕
        </button>

        {/* Header */}
        <div className="bg-gradient-to-r from-primary to-purple-600 p-6 rounded-t-2xl">
          <div className="flex items-center justify-center gap-2 mb-2">
            <Sparkles className="w-6 h-6 text-white" />
            <h2 className="text-2xl font-bold text-white">
              {mode === "login" ? "Welcome Back" : "Get Started"}
            </h2>
          </div>
          <p className="text-center text-blue-100 text-sm">
            {mode === "login"
              ? "Sign in to continue lead generation"
              : "Create account to start finding leads"}
          </p>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {/* Error/Success Messages */}
          {error && (
            <div className="bg-red-500 bg-opacity-10 border border-red-500 text-red-500 px-4 py-3 rounded-lg text-sm">
              {error}
            </div>
          )}
          {message && (
            <div className="bg-green-500 bg-opacity-10 border border-green-500 text-green-500 px-4 py-3 rounded-lg text-sm">
              {message}
            </div>
          )}

          {/* Name field (signup only) */}
          {mode === "signup" && (
            <div>
              <label className="block text-sm font-medium text-gray-400 mb-2">
                Full Name
              </label>
              <div className="relative">
                <User className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-500" />
                <input
                  type="text"
                  placeholder="John Doe"
                  className="w-full bg-dark border border-gray-700 rounded-lg pl-10 pr-4 py-3 text-white focus:ring-2 focus:ring-primary focus:border-transparent outline-none transition-all"
                  value={formData.name}
                  onChange={(e) =>
                    setFormData({ ...formData, name: e.target.value })
                  }
                  required
                />
              </div>
            </div>
          )}

          {/* Email field */}
          <div>
            <label className="block text-sm font-medium text-gray-400 mb-2">
              Email Address
            </label>
            <div className="relative">
              <Mail className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-500" />
              <input
                type="email"
                placeholder="you@example.com"
                className="w-full bg-dark border border-gray-700 rounded-lg pl-10 pr-4 py-3 text-white focus:ring-2 focus:ring-primary focus:border-transparent outline-none transition-all"
                value={formData.email}
                onChange={(e) =>
                  setFormData({ ...formData, email: e.target.value })
                }
                required
              />
            </div>
          </div>

          {/* Password field */}
          <div>
            <label className="block text-sm font-medium text-gray-400 mb-2">
              Password
            </label>
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-500" />
              <input
                type={showPassword ? "text" : "password"}
                placeholder="••••••••"
                className="w-full bg-dark border border-gray-700 rounded-lg pl-10 pr-12 py-3 text-white focus:ring-2 focus:ring-primary focus:border-transparent outline-none transition-all"
                value={formData.password}
                onChange={(e) =>
                  setFormData({ ...formData, password: e.target.value })
                }
                required
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-500 hover:text-gray-300 transition-colors"
              >
                {showPassword ? (
                  <EyeOff className="w-5 h-5" />
                ) : (
                  <Eye className="w-5 h-5" />
                )}
              </button>
            </div>
            {mode === "signup" && (
              <p className="text-xs text-gray-500 mt-1">
                Min 8 characters, uppercase, lowercase, and number
              </p>
            )}
          </div>

          {/* Forgot password (login only) */}
          {mode === "login" && (
            <div className="text-right">
              <button
                type="button"
                className="text-sm text-primary hover:text-blue-400 transition-colors"
              >
                Forgot password?
              </button>
            </div>
          )}

          {/* Submit button */}
          <button
            type="submit"
            disabled={loading}
            className="w-full bg-primary hover:bg-blue-600 text-white py-3 rounded-lg font-semibold flex items-center justify-center gap-2 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? (
              <>
                <div className="animate-spin rounded-full h-5 w-5 border-2 border-white border-t-transparent" />
                {mode === "login" ? "Signing in..." : "Creating account..."}
              </>
            ) : (
              <>
                {mode === "login" ? (
                  <>
                    <LogIn className="w-5 h-5" />
                    Sign In
                  </>
                ) : (
                  <>
                    <UserPlus className="w-5 h-5" />
                    Create Account
                  </>
                )}
              </>
            )}
          </button>

          {/* Toggle mode */}
          <div className="text-center text-sm text-gray-400">
            {mode === "login" ? (
              <p>
                Don't have an account?{" "}
                <button
                  type="button"
                  onClick={() => {
                    setMode("signup");
                    setError("");
                    setMessage("");
                  }}
                  className="text-primary hover:text-blue-400 font-semibold transition-colors"
                >
                  Sign up
                </button>
              </p>
            ) : (
              <p>
                Already have an account?{" "}
                <button
                  type="button"
                  onClick={() => {
                    setMode("login");
                    setError("");
                    setMessage("");
                  }}
                  className="text-primary hover:text-blue-400 font-semibold transition-colors"
                >
                  Sign in
                </button>
              </p>
            )}
          </div>
        </form>

        {/* Test credentials hint */}
        <div className="bg-dark bg-opacity-50 p-4 rounded-b-2xl border-t border-gray-800">
          <p className="text-xs text-gray-500 text-center">
            <strong className="text-gray-400">Test Account:</strong>{" "}
            techsupport@sniperthink.com / sniperthinkProduct@LeadGen
          </p>
        </div>
      </div>
    </div>
  );
};

export default AuthModal;
