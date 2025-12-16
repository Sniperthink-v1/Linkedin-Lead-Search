import React, { useState, useEffect } from "react";
import {
  User,
  LogOut,
  Search as SearchIcon,
  History,
  Download,
  Settings,
  Coins,
  Plus,
  Activity,
} from "lucide-react";

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:3000";

const UserProfile = ({
  user,
  onLogout,
  onShowSearchHistory,
  onShowSavedLeads,
  onShowSettings,
  onShowAdminDashboard,
}) => {
  const [showDropdown, setShowDropdown] = useState(false);
  const [credits, setCredits] = useState(null);

  useEffect(() => {
    fetchCredits();
  }, []);

  const fetchCredits = async () => {
    try {
      const token = localStorage.getItem("authToken");
      const response = await fetch(`${API_URL}/api/credits/balance`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });
      const data = await response.json();
      if (data.success) {
        setCredits(data.credits);
      }
    } catch (error) {
      console.error("Failed to fetch credits:", error);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem("authToken");
    localStorage.removeItem("user");
    onLogout();
  };

  const handleMenuClick = (action) => {
    setShowDropdown(false);
    action();
  };

  return (
    <div className="relative">
      {/* User button */}
      <button
        onClick={() => setShowDropdown(!showDropdown)}
        className="flex items-center gap-2 bg-dark hover:bg-darker border border-gray-700 hover:border-primary rounded-lg px-4 py-2 transition-all"
      >
        <div className="w-8 h-8 rounded-full bg-gradient-to-br from-primary to-purple-600 flex items-center justify-center text-white font-semibold">
          {user?.name?.charAt(0).toUpperCase() || "U"}
        </div>
        <div className="text-left hidden md:block">
          <p className="text-sm font-semibold text-white">
            {user?.name || "User"}
          </p>
          <p className="text-xs text-gray-400">
            {user?.emailVerified ? "✓ Verified" : "⚠ Not verified"}
          </p>
        </div>
        <svg
          className={`w-4 h-4 text-gray-400 transition-transform ${
            showDropdown ? "rotate-180" : ""
          }`}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M19 9l-7 7-7-7"
          />
        </svg>
      </button>

      {/* Dropdown menu */}
      {showDropdown && (
        <>
          {/* Backdrop */}
          <div
            className="fixed inset-0 z-10"
            onClick={() => setShowDropdown(false)}
          />

          {/* Menu */}
          <div className="absolute right-0 mt-2 w-64 bg-darker border border-gray-800 rounded-lg shadow-2xl overflow-hidden z-20">
            {/* User info */}
            <div className="bg-gradient-to-r from-primary to-purple-600 p-4">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-full bg-white bg-opacity-20 flex items-center justify-center text-white font-bold text-lg">
                  {user?.name?.charAt(0).toUpperCase() || "U"}
                </div>
                <div>
                  <p className="text-white font-semibold">
                    {user?.name || "User"}
                  </p>
                  <p className="text-blue-100 text-xs">{user?.email || ""}</p>
                </div>
              </div>
              {/* Credits Display */}
              <div className="mt-3 flex items-center justify-between bg-white bg-opacity-10 rounded-lg p-3">
                <div className="flex items-center gap-2">
                  <Coins className="w-5 h-5 text-yellow-300" />
                  <div>
                    <p className="text-white font-bold text-lg">
                      {credits !== null ? `$${credits.toFixed(4)}` : "Loading..."}
                    </p>
                    <p className="text-blue-100 text-xs">Available Credits</p>
                  </div>
                </div>
                <button
                  onClick={() => alert("Credit purchase coming soon!")}
                  className="bg-white bg-opacity-20 hover:bg-opacity-30 text-white p-2 rounded-lg transition-all"
                  title="Add credits"
                >
                  <Plus className="w-4 h-4" />
                </button>
              </div>

              {user?.stats && (
                <div className="mt-2 grid grid-cols-3 gap-2 text-center">
                  <div className="bg-white bg-opacity-10 rounded-lg p-2">
                    <p className="text-white font-bold text-sm">
                      {user.stats.searchesToday || 0}
                    </p>
                    <p className="text-blue-100 text-xs">Today</p>
                  </div>
                  <div className="bg-white bg-opacity-10 rounded-lg p-2">
                    <p className="text-white font-bold text-sm">
                      {user.stats.totalSearches || 0}
                    </p>
                    <p className="text-blue-100 text-xs">Total</p>
                  </div>
                  <div className="bg-white bg-opacity-10 rounded-lg p-2">
                    <p className="text-white font-bold text-sm">
                      {user.stats.savedLeadsCount || 0}
                    </p>
                    <p className="text-blue-100 text-xs">Leads</p>
                  </div>
                </div>
              )}
            </div>

            {/* Menu items */}
            <div className="p-2">
              {user?.isAdmin && (
                <>
                  <button
                    onClick={() => handleMenuClick(onShowAdminDashboard)}
                    className="w-full flex items-center gap-3 px-3 py-2 hover:bg-primary hover:bg-opacity-10 rounded-lg text-primary hover:text-primary transition-colors mb-2 border border-primary/30"
                  >
                    <Activity className="w-4 h-4" />
                    <span className="text-sm font-semibold">Admin Dashboard</span>
                  </button>
                  <div className="border-t border-gray-800 my-2" />
                </>
              )}
              <button
                onClick={() => handleMenuClick(onShowSearchHistory)}
                className="w-full flex items-center gap-3 px-3 py-2 hover:bg-dark rounded-lg text-gray-300 hover:text-white transition-colors"
              >
                <SearchIcon className="w-4 h-4" />
                <span className="text-sm">Search History</span>
              </button>
              <button
                onClick={() => handleMenuClick(onShowSavedLeads)}
                className="w-full flex items-center gap-3 px-3 py-2 hover:bg-dark rounded-lg text-gray-300 hover:text-white transition-colors"
              >
                <Download className="w-4 h-4" />
                <span className="text-sm">Saved Leads</span>
              </button>
              <button
                onClick={() => handleMenuClick(onShowSettings)}
                className="w-full flex items-center gap-3 px-3 py-2 hover:bg-dark rounded-lg text-gray-300 hover:text-white transition-colors"
              >
                <Settings className="w-4 h-4" />
                <span className="text-sm">Settings</span>
              </button>
              <div className="border-t border-gray-800 my-2" />
              <button
                onClick={handleLogout}
                className="w-full flex items-center gap-3 px-3 py-2 hover:bg-red-500 hover:bg-opacity-10 rounded-lg text-red-500 transition-colors"
              >
                <LogOut className="w-4 h-4" />
                <span className="text-sm font-semibold">Logout</span>
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
};

export default UserProfile;
