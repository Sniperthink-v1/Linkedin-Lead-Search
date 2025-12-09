import React, { useEffect, useState } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { CheckCircle, XCircle, Loader } from "lucide-react";

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:3000";

const VerifyEmail = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [status, setStatus] = useState("verifying"); // verifying, success, error
  const [message, setMessage] = useState("");

  useEffect(() => {
    const token = searchParams.get("token");

    if (!token) {
      setStatus("error");
      setMessage("Invalid verification link. No token provided.");
      return;
    }

    verifyEmail(token);
  }, [searchParams]);

  const verifyEmail = async (token) => {
    try {
      const response = await fetch(
        `${API_URL}/api/auth/verify-email?token=${token}`,
        {
          method: "GET",
          headers: { "Content-Type": "application/json" },
        }
      );

      const data = await response.json();

      if (data.success) {
        setStatus("success");
        setMessage(
          data.message || "Email verified successfully! You can now login."
        );

        // Redirect to home after 3 seconds
        setTimeout(() => {
          navigate("/");
        }, 3000);
      } else {
        setStatus("error");
        setMessage(data.error || "Failed to verify email. Please try again.");
      }
    } catch (error) {
      console.error("Verification error:", error);
      setStatus("error");
      setMessage(
        "Failed to connect to server. Please check your connection and try again."
      );
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-darker via-dark to-darker flex items-center justify-center p-4">
      <div className="bg-darker rounded-2xl shadow-2xl border border-gray-800 w-full max-w-md p-8">
        <div className="flex flex-col items-center text-center">
          {status === "verifying" && (
            <>
              <Loader className="w-16 h-16 text-primary animate-spin mb-4" />
              <h2 className="text-2xl font-bold text-white mb-2">
                Verifying Your Email
              </h2>
              <p className="text-gray-400">
                Please wait while we verify your email address...
              </p>
            </>
          )}

          {status === "success" && (
            <>
              <CheckCircle className="w-16 h-16 text-green-500 mb-4" />
              <h2 className="text-2xl font-bold text-white mb-2">
                Email Verified Successfully!
              </h2>
              <p className="text-gray-400 mb-4">{message}</p>
              <p className="text-sm text-gray-500">
                Redirecting you to the homepage in 3 seconds...
              </p>
              <button
                onClick={() => navigate("/")}
                className="mt-4 px-6 py-2 bg-primary hover:bg-blue-600 text-white rounded-lg transition-colors"
              >
                Go to Homepage Now
              </button>
            </>
          )}

          {status === "error" && (
            <>
              <XCircle className="w-16 h-16 text-red-500 mb-4" />
              <h2 className="text-2xl font-bold text-white mb-2">
                Verification Failed
              </h2>
              <p className="text-gray-400 mb-6">{message}</p>
              <button
                onClick={() => navigate("/")}
                className="px-6 py-2 bg-primary hover:bg-blue-600 text-white rounded-lg transition-colors"
              >
                Go to Homepage
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default VerifyEmail;
