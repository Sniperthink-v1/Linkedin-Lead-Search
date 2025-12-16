import React, { useState, useEffect } from "react";
import {
  X,
  Users,
  DollarSign,
  Search,
  TrendingUp,
  Database,
  Activity,
  RefreshCw,
  AlertCircle,
  CheckCircle,
  Clock,
  Coins,
} from "lucide-react";

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:3000";

function AdminDashboard({ onClose }) {
  const [stats, setStats] = useState(null);
  const [users, setUsers] = useState([]);
  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("overview"); // overview, users, transactions
  const [selectedUser, setSelectedUser] = useState(null);

  useEffect(() => {
    fetchStats();
    if (activeTab === "users") {
      fetchUsers();
    } else if (activeTab === "transactions") {
      fetchTransactions();
    }
  }, [activeTab]);

  const fetchStats = async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem("authToken");
      const response = await fetch(`${API_URL}/api/admin/stats`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      const data = await response.json();
      if (data.success) {
        setStats(data);
      } else {
        alert(data.error || "Failed to fetch stats");
      }
    } catch (error) {
      console.error("Fetch stats error:", error);
      alert("Failed to load dashboard");
    } finally {
      setLoading(false);
    }
  };

  const fetchUsers = async () => {
    try {
      const token = localStorage.getItem("authToken");
      const response = await fetch(`${API_URL}/api/admin/users?limit=50`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      const data = await response.json();
      if (data.success) {
        setUsers(data.users);
      }
    } catch (error) {
      console.error("Fetch users error:", error);
    }
  };

  const fetchTransactions = async () => {
    try {
      const token = localStorage.getItem("authToken");
      const response = await fetch(`${API_URL}/api/admin/transactions?limit=100`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      const data = await response.json();
      if (data.success) {
        setTransactions(data.transactions);
      }
    } catch (error) {
      console.error("Fetch transactions error:", error);
    }
  };

  const handleAddCredits = async (userId) => {
    const amount = prompt("Enter amount to add:");
    if (!amount || isNaN(amount)) return;

    const description = prompt("Enter description (optional):");

    try {
      const token = localStorage.getItem("authToken");
      const response = await fetch(`${API_URL}/api/admin/user/${userId}/credits`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          amount: parseFloat(amount),
          description,
        }),
      });

      const data = await response.json();
      if (data.success) {
        alert(`Credits added! New balance: $${data.newBalance.toFixed(4)}`);
        fetchUsers();
      } else {
        alert(data.error || "Failed to add credits");
      }
    } catch (error) {
      console.error("Add credits error:", error);
      alert("Failed to add credits");
    }
  };

  if (loading && !stats) {
    return (
      <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50">
        <div className="bg-dark border border-gray-700 rounded-xl p-8">
          <div className="flex items-center gap-3">
            <RefreshCw className="w-6 h-6 text-primary animate-spin" />
            <span className="text-white text-lg">Loading admin dashboard...</span>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
      <div className="bg-dark border border-gray-700 rounded-xl w-full max-w-7xl max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="p-6 border-b border-gray-700 bg-gradient-to-r from-primary/10 to-purple-600/10">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-primary rounded-lg">
                <Activity className="w-6 h-6 text-white" />
              </div>
              <div>
                <h2 className="text-2xl font-bold text-white">Admin Dashboard</h2>
                <p className="text-gray-400 text-sm">System Overview & Management</p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-white transition-colors p-2"
            >
              <X className="w-6 h-6" />
            </button>
          </div>

          {/* Tabs */}
          <div className="flex gap-2 mt-4">
            <button
              onClick={() => setActiveTab("overview")}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                activeTab === "overview"
                  ? "bg-primary text-white"
                  : "bg-darker text-gray-400 hover:text-white"
              }`}
            >
              Overview
            </button>
            <button
              onClick={() => setActiveTab("users")}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                activeTab === "users"
                  ? "bg-primary text-white"
                  : "bg-darker text-gray-400 hover:text-white"
              }`}
            >
              Users ({stats?.stats?.users?.total || 0})
            </button>
            <button
              onClick={() => setActiveTab("transactions")}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                activeTab === "transactions"
                  ? "bg-primary text-white"
                  : "bg-darker text-gray-400 hover:text-white"
              }`}
            >
              Transactions
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {activeTab === "overview" && stats && (
            <div className="space-y-6">
              {/* Stats Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                {/* Total Users */}
                <div className="bg-darker border border-gray-700 rounded-lg p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-gray-400 text-sm">Total Users</p>
                      <p className="text-white text-3xl font-bold mt-1">
                        {stats.stats.users.total}
                      </p>
                      <p className="text-green-400 text-xs mt-1">
                        {stats.stats.users.verified} verified
                      </p>
                    </div>
                    <Users className="w-10 h-10 text-primary" />
                  </div>
                </div>

                {/* Total Searches */}
                <div className="bg-darker border border-gray-700 rounded-lg p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-gray-400 text-sm">Total Searches</p>
                      <p className="text-white text-3xl font-bold mt-1">
                        {stats.stats.searches.total}
                      </p>
                      <p className="text-blue-400 text-xs mt-1">
                        {stats.stats.searches.today} today
                      </p>
                    </div>
                    <Search className="w-10 h-10 text-blue-500" />
                  </div>
                </div>

                {/* Revenue */}
                <div className="bg-darker border border-gray-700 rounded-lg p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-gray-400 text-sm">Total Revenue</p>
                      <p className="text-white text-3xl font-bold mt-1">
                        ${stats.stats.credits.totalRevenue.toFixed(2)}
                      </p>
                      <p className="text-gray-400 text-xs mt-1">
                        Cost: ${stats.stats.credits.totalCost.toFixed(2)}
                      </p>
                    </div>
                    <DollarSign className="w-10 h-10 text-green-500" />
                  </div>
                </div>

                {/* Profit */}
                <div className="bg-darker border border-gray-700 rounded-lg p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-gray-400 text-sm">Total Profit</p>
                      <p className="text-white text-3xl font-bold mt-1">
                        ${stats.stats.credits.totalProfit.toFixed(2)}
                      </p>
                      <p className="text-green-400 text-xs mt-1">
                        {stats.stats.credits.profitMargin}% margin
                      </p>
                    </div>
                    <TrendingUp className="w-10 h-10 text-green-400" />
                  </div>
                </div>
              </div>

              {/* API Usage */}
              <div className="bg-darker border border-gray-700 rounded-lg p-6">
                <h3 className="text-white text-lg font-semibold mb-4 flex items-center gap-2">
                  <Activity className="w-5 h-5 text-primary" />
                  API Usage Statistics
                </h3>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-gray-400 text-sm">Serper API Calls</p>
                    <p className="text-white text-2xl font-bold mt-1">
                      {stats.stats.apiUsage.serperCalls.toLocaleString()}
                    </p>
                    <p className="text-xs text-gray-500 mt-1">
                      Cost: ${(stats.stats.apiUsage.serperCalls * 0.001).toFixed(2)}
                    </p>
                  </div>
                  <div>
                    <p className="text-gray-400 text-sm">Gemini API Calls</p>
                    <p className="text-white text-2xl font-bold mt-1">
                      {stats.stats.apiUsage.geminiCalls.toLocaleString()}
                    </p>
                    <p className="text-xs text-gray-500 mt-1">
                      Cost: ${(stats.stats.apiUsage.geminiCalls * 0.0001).toFixed(2)}
                    </p>
                  </div>
                </div>
              </div>

              {/* Low Credit Users */}
              {stats.lowCreditUsers && stats.lowCreditUsers.length > 0 && (
                <div className="bg-darker border border-yellow-700/50 rounded-lg p-6">
                  <h3 className="text-white text-lg font-semibold mb-4 flex items-center gap-2">
                    <AlertCircle className="w-5 h-5 text-yellow-500" />
                    Low Credit Users
                  </h3>
                  <div className="space-y-2">
                    {stats.lowCreditUsers.map((user) => (
                      <div
                        key={user.id}
                        className="flex items-center justify-between bg-dark p-3 rounded-lg"
                      >
                        <div>
                          <p className="text-white font-medium">{user.name}</p>
                          <p className="text-gray-400 text-sm">{user.email}</p>
                        </div>
                        <div className="flex items-center gap-3">
                          <span className="text-yellow-400 font-bold">
                            ${user.credits.toFixed(4)}
                          </span>
                          <button
                            onClick={() => handleAddCredits(user.id)}
                            className="bg-primary hover:bg-blue-600 text-white px-3 py-1 rounded text-sm"
                          >
                            Add Credits
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Recent Searches */}
              <div className="bg-darker border border-gray-700 rounded-lg p-6">
                <h3 className="text-white text-lg font-semibold mb-4 flex items-center gap-2">
                  <Clock className="w-5 h-5 text-primary" />
                  Recent Searches
                </h3>
                <div className="space-y-2">
                  {stats.recentSearches.map((search) => (
                    <div key={search.id} className="flex items-center justify-between bg-dark p-3 rounded-lg">
                      <div>
                        <p className="text-white font-medium">
                          {search.searchType === "people" ? "People" : "Business"} Search
                        </p>
                        <p className="text-gray-400 text-sm">
                          {search.businessType} in {search.location}
                        </p>
                        <p className="text-gray-500 text-xs">
                          by {search.user.name} ({search.user.email})
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="text-primary font-semibold">{search.resultCount} results</p>
                        <p className="text-gray-500 text-xs">
                          {new Date(search.createdAt).toLocaleString()}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {activeTab === "users" && (
            <div className="space-y-4">
              <div className="bg-darker border border-gray-700 rounded-lg overflow-hidden">
                <table className="w-full">
                  <thead className="bg-dark">
                    <tr>
                      <th className="text-left text-gray-400 text-sm font-semibold p-4">User</th>
                      <th className="text-left text-gray-400 text-sm font-semibold p-4">Status</th>
                      <th className="text-left text-gray-400 text-sm font-semibold p-4">Credits</th>
                      <th className="text-left text-gray-400 text-sm font-semibold p-4">Searches</th>
                      <th className="text-left text-gray-400 text-sm font-semibold p-4">Joined</th>
                      <th className="text-left text-gray-400 text-sm font-semibold p-4">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {users.map((user) => (
                      <tr key={user.id} className="border-t border-gray-700 hover:bg-dark/50">
                        <td className="p-4">
                          <div>
                            <p className="text-white font-medium">{user.name}</p>
                            <p className="text-gray-400 text-sm">{user.email}</p>
                            {user.isAdmin && (
                              <span className="text-xs bg-yellow-500/20 text-yellow-400 px-2 py-0.5 rounded">
                                Admin
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="p-4">
                          <div className="flex items-center gap-2">
                            {user.emailVerified ? (
                              <CheckCircle className="w-4 h-4 text-green-400" />
                            ) : (
                              <AlertCircle className="w-4 h-4 text-yellow-400" />
                            )}
                            <span className="text-gray-300 text-sm">
                              {user.accountStatus}
                            </span>
                          </div>
                        </td>
                        <td className="p-4">
                          <span className="text-white font-mono">
                            ${user.credits.toFixed(4)}
                          </span>
                        </td>
                        <td className="p-4">
                          <span className="text-gray-300">{user._count.searches}</span>
                        </td>
                        <td className="p-4">
                          <span className="text-gray-400 text-sm">
                            {new Date(user.createdAt).toLocaleDateString()}
                          </span>
                        </td>
                        <td className="p-4">
                          <button
                            onClick={() => handleAddCredits(user.id)}
                            className="bg-primary hover:bg-blue-600 text-white px-3 py-1 rounded text-sm flex items-center gap-1"
                          >
                            <Coins className="w-3 h-3" />
                            Add
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {activeTab === "transactions" && (
            <div className="space-y-4">
              <div className="bg-darker border border-gray-700 rounded-lg overflow-hidden">
                <table className="w-full">
                  <thead className="bg-dark">
                    <tr>
                      <th className="text-left text-gray-400 text-sm font-semibold p-4">User</th>
                      <th className="text-left text-gray-400 text-sm font-semibold p-4">Type</th>
                      <th className="text-left text-gray-400 text-sm font-semibold p-4">Amount</th>
                      <th className="text-left text-gray-400 text-sm font-semibold p-4">API Costs</th>
                      <th className="text-left text-gray-400 text-sm font-semibold p-4">Calls</th>
                      <th className="text-left text-gray-400 text-sm font-semibold p-4">Date</th>
                    </tr>
                  </thead>
                  <tbody>
                    {transactions.map((tx) => (
                      <tr key={tx.id} className="border-t border-gray-700 hover:bg-dark/50">
                        <td className="p-4">
                          <div>
                            <p className="text-white text-sm">{tx.user.name}</p>
                            <p className="text-gray-400 text-xs">{tx.user.email}</p>
                          </div>
                        </td>
                        <td className="p-4">
                          <span className={`text-xs px-2 py-1 rounded ${
                            tx.type === "search" ? "bg-blue-500/20 text-blue-400" :
                            tx.type === "purchase" ? "bg-green-500/20 text-green-400" :
                            "bg-gray-500/20 text-gray-400"
                          }`}>
                            {tx.type}
                          </span>
                        </td>
                        <td className="p-4">
                          <span className={`font-mono font-semibold ${
                            tx.amount < 0 ? "text-red-400" : "text-green-400"
                          }`}>
                            {tx.amount < 0 ? "-" : "+"}${Math.abs(tx.amount).toFixed(4)}
                          </span>
                        </td>
                        <td className="p-4">
                          {tx.apiCostActual !== null && (
                            <div className="text-sm">
                              <p className="text-gray-400">
                                Actual: ${tx.apiCostActual.toFixed(4)}
                              </p>
                              <p className="text-gray-300">
                                Charged: ${tx.apiCostCharged.toFixed(4)}
                              </p>
                            </div>
                          )}
                        </td>
                        <td className="p-4">
                          {tx.serperCalls !== null && (
                            <div className="text-xs text-gray-400">
                              <p>Serper: {tx.serperCalls}</p>
                              <p>Gemini: {tx.geminiCalls}</p>
                            </div>
                          )}
                        </td>
                        <td className="p-4">
                          <span className="text-gray-400 text-xs">
                            {new Date(tx.createdAt).toLocaleString()}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default AdminDashboard;
