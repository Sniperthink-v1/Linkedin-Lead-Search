import React, { useState, useEffect } from "react";
import SearchForm from "./components/SearchForm";
import BusinessSearchForm from "./components/BusinessSearchForm";
import AuthModal from "./components/AuthModal";
import UserProfile from "./components/UserProfile";
import SearchHistory from "./components/SearchHistory";
import SavedLeads from "./components/SavedLeads";
import Settings from "./components/Settings";
import EmailVerificationBanner from "./components/EmailVerificationBanner";
import AdminDashboard from "./components/AdminDashboard";
import {
  Users,
  ExternalLink,
  User,
  Download,
  Building2,
  Copy,
  LogIn,
  UserPlus,
  Bookmark,
  BookmarkCheck,
  Loader2,
} from "lucide-react";
import * as XLSX from "xlsx";

// Get API URL from environment variable or use localhost as fallback
const API_URL = import.meta.env.VITE_API_URL || "http://localhost:3000";

function App() {
  const [activeTab, setActiveTab] = useState("people"); // 'people' or 'business'
  const [leads, setLeads] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [searched, setSearched] = useState(false);
  const [totalResults, setTotalResults] = useState(0);
  const [copiedLink, setCopiedLink] = useState(null);
  const [savedLeads, setSavedLeads] = useState(new Set());
  const [savingLead, setSavingLead] = useState(null);

  // Rate limiting state
  const [lastSearchTime, setLastSearchTime] = useState(0);
  const [searchCooldown, setSearchCooldown] = useState(0);
  const SEARCH_COOLDOWN_MS = 15000; // 15 seconds between searches

  // Authentication state
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [user, setUser] = useState(null);
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [showSearchHistory, setShowSearchHistory] = useState(false);
  const [showSavedLeads, setShowSavedLeads] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [showAdminDashboard, setShowAdminDashboard] = useState(false);
  
  // Track last search parameters for "Load More" functionality
  const [lastSearchParams, setLastSearchParams] = useState(null);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [showCacheDialog, setShowCacheDialog] = useState(false);
  const [pendingSearchParams, setPendingSearchParams] = useState(null);

  // Rate limiting cooldown timer
  useEffect(() => {
    if (searchCooldown > 0) {
      const timer = setInterval(() => {
        setSearchCooldown((prev) => Math.max(0, prev - 1));
      }, 1000);
      return () => clearInterval(timer);
    }
  }, [searchCooldown]);

  // Check if user is logged in on mount
  useEffect(() => {
    const token = localStorage.getItem("authToken");
    const storedUser = localStorage.getItem("user");

    if (token && storedUser) {
      setIsAuthenticated(true);
      setUser(JSON.parse(storedUser));
      // Optionally fetch fresh user data
      fetchUserData(token);
    }
  }, []);

  const fetchUserData = async (token) => {
    try {
      const response = await fetch(`${API_URL}/api/auth/me`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });
      const data = await response.json();
      if (data.success) {
        setUser(data.user);
        localStorage.setItem("user", JSON.stringify(data.user));
      }
    } catch (error) {
      console.error("Failed to fetch user data:", error);
    }
  };

  const handleLoginSuccess = (userData, token) => {
    setIsAuthenticated(true);
    setUser(userData);
    fetchUserData(token); // Get fresh data with stats
  };

  const handleLogout = () => {
    setIsAuthenticated(false);
    setUser(null);
    setLeads([]);
    setSearched(false);
  };

  const handleCopyLink = (link) => {
    navigator.clipboard.writeText(link);
    setCopiedLink(link);
    setTimeout(() => setCopiedLink(null), 2000);
  };

  const handleSaveLead = async (lead) => {
    console.log("Save button clicked, lead:", lead);
    console.log("Active tab:", activeTab);

    const token = localStorage.getItem("authToken");
    if (!token) {
      console.log("No token found, showing auth modal");
      setShowAuthModal(true);
      return;
    }

    // Create unique key for the lead
    const leadKey =
      activeTab === "people" ? lead.profileLink : lead.googleMapsLink;

    console.log("Lead key:", leadKey);
    console.log("Already saved?", savedLeads.has(leadKey));

    if (savedLeads.has(leadKey)) {
      return; // Already saved
    }

    setSavingLead(leadKey);

    try {
      console.log("Sending save request...");
      const response = await fetch(`${API_URL}/api/leads/save`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          leadData: lead,
          leadType: activeTab,
        }),
      });

      console.log("Response status:", response.status);
      const data = await response.json();
      console.log("Response data:", data);

      if (data.success) {
        setSavedLeads((prev) => new Set([...prev, leadKey]));
        console.log("Lead saved successfully!");
        // Optionally show success message
      } else {
        console.error("Failed to save lead:", data.error);
        if (response.status === 409) {
          // Already saved
          setSavedLeads((prev) => new Set([...prev, leadKey]));
        }
      }
    } catch (error) {
      console.error("Error saving lead:", error);
    } finally {
      setSavingLead(null);
    }
  };

  const handleDownloadExcel = () => {
    // Prepare data for Excel export based on active tab
    let excelData, sheetName, filename;
    
    // Generate date string for filename (YYYY-MM-DD format)
    const dateStr = new Date().toISOString().split('T')[0];
    
    // Get search parameters for filename
    const businessType = lastSearchParams?.businessType || lastSearchParams?.specificBusinessName || lastSearchParams?.industry || "unknown";
    const location = lastSearchParams?.location || "unknown";
    
    // Clean strings for filename (remove special characters, limit length)
    const cleanString = (str) => {
      return str
        .toString()
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '_')
        .replace(/^_+|_+$/g, '')
        .slice(0, 30);
    };

    if (activeTab === "people") {
      excelData = leads.map((lead) => ({
        Name: lead.personName,
        "Job Title": lead.jobTitle || "-",
        Company: lead.company || "-",
        Email: lead.email || "-",
        Location: lead.location || "-",
        Link: lead.profileLink,
      }));
      sheetName = "LinkedIn Leads";
      filename = `people_${dateStr}_${cleanString(businessType)}_${cleanString(location)}`;
    } else {
      excelData = leads.map((lead) => ({
        "Business Name": lead.name,
        Location: lead.location || "-",
        Description: lead.description || lead.category || "-",
        Address: lead.address || "-",
        Phone: lead.phone || "-",
        Email: lead.email || "-",
        Website: lead.website || "-",
        Rating: lead.rating || "-",
        "Total Ratings": lead.totalRatings || "-",
        "Search Date": lead.searchDate
          ? new Date(lead.searchDate).toLocaleDateString()
          : "-",
        "Google Maps Link": lead.googleMapsLink,
      }));
      sheetName = "Business Leads";
      filename = `business_${dateStr}_${cleanString(businessType)}_${cleanString(location)}`;
    }

    // Create workbook and worksheet
    const worksheet = XLSX.utils.json_to_sheet(excelData);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, sheetName);

    // Download file
    XLSX.writeFile(workbook, `${filename}.xlsx`);
  };

  const handleSaveAll = async () => {
    if (leads.length === 0) {
      setError("No leads to save");
      return;
    }

    if (!confirm(`Save all ${leads.length} leads to your saved leads?`)) {
      return;
    }

    setSavingLead("all");
    let savedCount = 0;
    let failedCount = 0;

    try {
      for (const lead of leads) {
        try {
          await handleSaveLead(lead, true); // Pass true to skip individual messages
          savedCount++;
        } catch (error) {
          console.error("Failed to save lead:", error);
          failedCount++;
        }
      }

      if (savedCount > 0) {
        alert(
          `Successfully saved ${savedCount} leads!${
            failedCount > 0 ? ` (${failedCount} already saved or failed)` : ""
          }`
        );
      } else {
        alert("All leads were already saved or failed to save.");
      }
    } catch (error) {
      console.error("Error saving all leads:", error);
      setError("Failed to save all leads");
    } finally {
      setSavingLead(null);
    }
  };

  const handleSearch = async (formData, useCached = null) => {
    // Require authentication
    if (!isAuthenticated) {
      setShowAuthModal(true);
      return;
    }

    // Check rate limiting (skip for cached results)
    if (useCached === null) {
      const now = Date.now();
      const timeSinceLastSearch = now - lastSearchTime;
      if (timeSinceLastSearch < SEARCH_COOLDOWN_MS) {
        const remainingSeconds = Math.ceil(
          (SEARCH_COOLDOWN_MS - timeSinceLastSearch) / 1000
        );
        setError("");
        setSearchCooldown(remainingSeconds);
        return;
      }
    }

    setLoading(true);
    setError(null);
    setSearched(true);
    setLeads([]);
    setTotalResults(0);
    setLastSearchTime(now);
    setSearchCooldown(SEARCH_COOLDOWN_MS / 1000);

    try {
      // Use EventSource for Server-Sent Events (SSE) to receive streaming results
      const params = new URLSearchParams({
        ...formData,
        ...(useCached !== null && { useCached: useCached.toString() })
      }).toString();
      const token = localStorage.getItem("authToken");
      const eventSource = new EventSource(
        `${API_URL}/api/search/people?${params}&token=${token}`
      );

      eventSource.onmessage = (event) => {
        const data = JSON.parse(event.data);

        if (data.type === "cache-available") {
          eventSource.close();
          setShowCacheDialog(true);
          setPendingSearchParams(formData);
          setLoading(false);
          return;
        }

        if (data.type === "error") {
          eventSource.close();
          setError(data.error || data.message || "An error occurred");
          setLoading(false);
          return;
        }

        if (data.type === "progress" || data.type === "complete") {
          setLeads(data.leads);
          setTotalResults(data.total || data.leads.length);

          if (data.type === "complete") {
            eventSource.close();
            setLoading(false);
          }
        }
      };

      eventSource.onerror = (err) => {
        console.error("EventSource error:", err);
        eventSource.close();
        setError(
          "Failed to connect to server. Please check your internet connection and try again."
        );
        setLoading(false);
      };
    } catch (err) {
      setError("Failed to fetch leads. Please try again.");
      console.error(err);
      setLoading(false);
    }
  };

  const handleBusinessSearch = async (formData, isLoadMore = false, useCached = null) => {
    // Require authentication
    if (!isAuthenticated) {
      setShowAuthModal(true);
      return;
    }

    // Check rate limiting (skip for load more and cached results)
    if (!isLoadMore && useCached === null) {
      const now = Date.now();
      const timeSinceLastSearch = now - lastSearchTime;
      if (timeSinceLastSearch < SEARCH_COOLDOWN_MS) {
        const remainingSeconds = Math.ceil(
          (SEARCH_COOLDOWN_MS - timeSinceLastSearch) / 1000
        );
        setError("");
        setSearchCooldown(remainingSeconds);
        return;
      }
    }

    if (isLoadMore) {
      setIsLoadingMore(true);
    } else {
      setLoading(true);
      setError(null);
      setSearched(true);
      setLeads([]);
      setTotalResults(0);
      setLastSearchTime(Date.now());
      setSearchCooldown(SEARCH_COOLDOWN_MS / 1000);
      setLastSearchParams(formData);
    }

    try {
      // Use EventSource for Server-Sent Events (SSE) to receive streaming results
      console.log(`📡 Building business search params with useCached=${useCached}`);
      const params = new URLSearchParams({
        ...formData,
        leadCount: formData.leadCount || 20,
        ...(useCached !== null && { useCached: useCached.toString() })
      }).toString();
      console.log(`📡 Final URL params: ${params}`);
      const token = localStorage.getItem("authToken");
      const eventSource = new EventSource(
        `${API_URL}/api/search/business?${params}&token=${token}`
      );

      eventSource.onmessage = (event) => {
        const data = JSON.parse(event.data);

        if (data.type === "cache-available") {
          eventSource.close();
          setShowCacheDialog(true);
          setPendingSearchParams(formData);
          if (isLoadMore) {
            setIsLoadingMore(false);
          } else {
            setLoading(false);
          }
          return;
        }

        if (data.type === "error") {
          eventSource.close();
          setError(data.error || data.message || "An error occurred");
          if (isLoadMore) {
            setIsLoadingMore(false);
          } else {
            setLoading(false);
          }
          return;
        }

        if (data.type === "progress" || data.type === "complete") {
          if (isLoadMore) {
            // Append new leads to existing ones
            setLeads(prevLeads => [...prevLeads, ...data.leads]);
            setTotalResults(prevTotal => prevTotal + (data.leads.length || 0));
          } else {
            setLeads(data.leads);
            setTotalResults(data.total || data.leads.length);
          }

          if (data.type === "complete") {
            eventSource.close();
            if (isLoadMore) {
              setIsLoadingMore(false);
            } else {
              setLoading(false);
            }
          }
        }
      };

      eventSource.onerror = (err) => {
        console.error("EventSource error:", err);
        eventSource.close();
        setError(
          "Failed to connect to server. Please check your internet connection and try again."
        );
        if (isLoadMore) {
          setIsLoadingMore(false);
        } else {
          setLoading(false);
        }
      };
    } catch (err) {
      setError("Failed to fetch business leads. Please try again.");
      console.error(err);
      if (isLoadMore) {
        setIsLoadingMore(false);
      } else {
        setLoading(false);
      }
    }
  };

  const handleLoadMoreBusinesses = () => {
    if (lastSearchParams && !isLoadingMore) {
      handleBusinessSearch(lastSearchParams, true);
    }
  };

  const handleCachedChoice = (useCached) => {
    console.log(`🎯 User chose cached: ${useCached}`);
    console.log(`   Active tab: ${activeTab}`);
    console.log(`   Pending params:`, pendingSearchParams);
    setShowCacheDialog(false);
    if (pendingSearchParams) {
      if (activeTab === "business") {
        console.log(`   Calling handleBusinessSearch with useCached=${useCached}`);
        handleBusinessSearch(pendingSearchParams, false, useCached);
      } else {
        console.log(`   Calling handleSearch with useCached=${useCached}`);
        handleSearch(pendingSearchParams, useCached);
      }
      setPendingSearchParams(null);
    }
  };

  return (
    <div className="min-h-screen bg-darker p-6 md:p-12">
      <div className="max-w-7xl mx-auto space-y-12">
        {/* Header with Auth */}
        <div className="flex justify-between items-start mb-8">
          <div className="flex-1">
            <div className="inline-flex items-center justify-center p-3 bg-primary/10 rounded-full mb-4">
              {activeTab === "people" ? (
                <Users className="w-8 h-8 text-primary" />
              ) : (
                <Building2 className="w-8 h-8 text-primary" />
              )}
            </div>
            <h1 className="text-4xl md:text-5xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-white to-gray-500">
              {activeTab === "people"
                ? "LinkedIn People Finder"
                : "Business Lead Finder"}
            </h1>
            <p className="text-gray-400 text-lg max-w-2xl mt-2">
              {activeTab === "people"
                ? "Find professionals on LinkedIn by job title and location. Enter your search criteria below to discover potential leads."
                : "Find businesses using Google Places. Enter business type and location to discover local businesses."}
            </p>
          </div>

          {/* Auth Section */}
          <div className="ml-4">
            {isAuthenticated ? (
              <UserProfile
                user={user}
                onLogout={handleLogout}
                onShowSearchHistory={() => setShowSearchHistory(true)}
                onShowSavedLeads={() => setShowSavedLeads(true)}
                onShowSettings={() => setShowSettings(true)}
                onShowAdminDashboard={() => setShowAdminDashboard(true)}
              />
            ) : (
              <div className="flex gap-2">
                <button
                  onClick={() => setShowAuthModal(true)}
                  className="flex items-center gap-2 bg-dark hover:bg-darker border border-gray-700 hover:border-primary rounded-lg px-4 py-2 text-white transition-all"
                >
                  <LogIn className="w-4 h-4" />
                  Sign In
                </button>
                <button
                  onClick={() => setShowAuthModal(true)}
                  className="flex items-center gap-2 bg-primary hover:bg-blue-600 rounded-lg px-4 py-2 text-white font-semibold transition-all"
                >
                  <UserPlus className="w-4 h-4" />
                  Sign Up
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Email Verification Banner */}
        <EmailVerificationBanner user={user} onUpdate={setUser} />

        {/* Tabs */}
        <div className="flex justify-center gap-4">
          <button
            onClick={() => {
              setActiveTab("people");
              setLeads([]);
              setSearched(false);
              setError(null);
            }}
            className={`flex items-center gap-2 px-6 py-3 rounded-lg font-semibold transition-all ${
              activeTab === "people"
                ? "bg-primary text-white"
                : "bg-dark text-gray-400 hover:bg-gray-800"
            }`}
          >
            <Users className="w-5 h-5" />
            LinkedIn People
          </button>
          <button
            onClick={() => {
              setActiveTab("business");
              setLeads([]);
              setSearched(false);
              setError(null);
            }}
            className={`flex items-center gap-2 px-6 py-3 rounded-lg font-semibold transition-all ${
              activeTab === "business"
                ? "bg-primary text-white"
                : "bg-dark text-gray-400 hover:bg-gray-800"
            }`}
          >
            <Building2 className="w-5 h-5" />
            Business Leads
          </button>
        </div>

        {/* Login Prompt for Unauthenticated Users */}
        {!isAuthenticated && (
          <div className="bg-dark border border-gray-700 rounded-xl p-8 text-center">
            <div className="inline-flex items-center justify-center p-3 bg-primary/10 rounded-full mb-4">
              <LogIn className="w-8 h-8 text-primary" />
            </div>
            <h3 className="text-2xl font-bold text-white mb-2">
              Sign in to Start Searching
            </h3>
            <p className="text-gray-400 mb-6">
              Please log in or create an account to access the lead search tool.
            </p>
            <button
              onClick={() => setShowAuthModal(true)}
              className="inline-flex items-center gap-2 bg-primary hover:bg-blue-600 rounded-lg px-6 py-3 text-white font-semibold transition-all"
            >
              <UserPlus className="w-5 h-5" />
              Get Started
            </button>
          </div>
        )}

        {/* Search Section - Only show when authenticated */}
        {isAuthenticated && (
          <>
            {activeTab === "people" ? (
              <SearchForm
                onSearch={handleSearch}
                isLoading={loading}
                cooldown={searchCooldown}
              />
            ) : (
              <BusinessSearchForm
                onSearch={handleBusinessSearch}
                isLoading={loading}
                cooldown={searchCooldown}
              />
            )}
          </>
        )}

        {/* Results Section */}
        <div className="space-y-6">
          {loading && (
            <div className="text-center text-primary py-12">
              <div className="inline-flex items-center gap-3">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
                <span className="text-lg">
                  {activeTab === "people"
                    ? "Searching for people on LinkedIn..."
                    : "Searching for businesses..."}
                </span>
              </div>
            </div>
          )}

          {error && (
            <div className="bg-red-500/10 border border-red-500/20 text-red-400 p-4 rounded-lg text-center">
              {error}
            </div>
          )}

          {searched && !loading && leads.length > 0 && (
            <div className="flex items-center justify-between pb-4">
              <div className="text-gray-400">
                Found{" "}
                <span className="text-primary font-semibold">
                  {totalResults}
                </span>{" "}
                {activeTab === "people" ? "people" : "businesses"}
              </div>
              <div className="flex items-center gap-3">
                {activeTab === "business" && lastSearchParams && (
                  <button
                    onClick={handleLoadMoreBusinesses}
                    disabled={isLoadingMore}
                    className="inline-flex items-center gap-2 px-4 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {isLoadingMore ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        Loading More...
                      </>
                    ) : (
                      <>
                        <Building2 className="w-4 h-4" />
                        Load More
                      </>
                    )}
                  </button>
                )}
                <button
                  onClick={handleSaveAll}
                  disabled={savingLead === "all"}
                  className="inline-flex items-center gap-2 px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {savingLead === "all" ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Saving...
                    </>
                  ) : (
                    <>
                      <BookmarkCheck className="w-4 h-4" />
                      Save All
                    </>
                  )}
                </button>
                <button
                  onClick={handleDownloadExcel}
                  className="inline-flex items-center gap-2 px-4 py-2 bg-primary hover:bg-blue-600 text-white rounded-lg transition-colors"
                >
                  <Download className="w-4 h-4" />
                  Download Excel
                </button>
              </div>
            </div>
          )}

          {searched && !loading && leads.length === 0 && !error && (
            <div className="text-center text-gray-500 py-12">
              {activeTab === "people"
                ? "No people found. Try adjusting your search criteria."
                : "No businesses found. Try adjusting your search criteria."}
            </div>
          )}

          {/* Table View */}
          {leads.length > 0 && activeTab === "people" && (
            <div className="overflow-x-auto bg-dark rounded-xl border border-gray-800">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-gray-800">
                    <th className="px-6 py-4 text-left text-sm font-semibold text-gray-400">
                      Profile
                    </th>
                    <th className="px-6 py-4 text-left text-sm font-semibold text-gray-400">
                      Name
                    </th>
                    <th className="px-6 py-4 text-left text-sm font-semibold text-gray-400">
                      Job Title
                    </th>
                    <th className="px-6 py-4 text-left text-sm font-semibold text-gray-400">
                      Company
                    </th>
                    <th className="px-6 py-4 text-left text-sm font-semibold text-gray-400">
                      Link
                    </th>
                    <th className="px-6 py-4 text-left text-sm font-semibold text-gray-400">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {leads.map((lead, index) => (
                    <tr
                      key={index}
                      className="border-b border-gray-800 hover:bg-gray-800/50 transition-colors"
                    >
                      <td className="px-6 py-4">
                        {lead.profilePic ? (
                          <img
                            src={lead.profilePic}
                            alt={lead.personName}
                            className="w-10 h-10 rounded-full object-cover"
                            onError={(e) => {
                              e.target.style.display = "none";
                              e.target.nextSibling.style.display = "flex";
                            }}
                          />
                        ) : null}
                        <div
                          className="w-10 h-10 bg-gray-800 rounded-full flex items-center justify-center text-primary"
                          style={{ display: lead.profilePic ? "none" : "flex" }}
                        >
                          <User className="w-5 h-5" />
                        </div>
                      </td>
                      <td className="px-6 py-4 text-white font-medium">
                        {lead.personName}
                      </td>
                      <td className="px-6 py-4 text-gray-400">
                        {lead.jobTitle || "-"}
                      </td>
                      <td className="px-6 py-4 text-gray-400">
                        {lead.company || "-"}
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-2">
                          <a
                            href={lead.profileLink}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-primary hover:text-blue-400 transition-colors text-sm truncate max-w-md"
                          >
                            {lead.profileLink}
                          </a>
                          <button
                            onClick={() => handleCopyLink(lead.profileLink)}
                            className="p-1 hover:bg-gray-800 rounded transition-colors"
                            title="Copy link"
                          >
                            {copiedLink === lead.profileLink ? (
                              <span className="text-green-400 text-xs">✓</span>
                            ) : (
                              <Copy className="w-4 h-4 text-gray-400 hover:text-primary" />
                            )}
                          </button>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <button
                          onClick={() => handleSaveLead(lead)}
                          disabled={
                            savedLeads.has(lead.profileLink) ||
                            savingLead === lead.profileLink
                          }
                          className={`p-2 rounded transition-colors ${
                            savedLeads.has(lead.profileLink)
                              ? "bg-green-500/20 text-green-400"
                              : "hover:bg-gray-800 text-gray-400 hover:text-primary"
                          }`}
                          title={
                            savedLeads.has(lead.profileLink)
                              ? "Saved"
                              : "Save lead"
                          }
                        >
                          {savedLeads.has(lead.profileLink) ? (
                            <BookmarkCheck className="w-4 h-4" />
                          ) : (
                            <Bookmark className="w-4 h-4" />
                          )}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Business Table View */}
          {leads.length > 0 && activeTab === "business" && (
            <div className="overflow-x-auto bg-dark rounded-xl border border-gray-800">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-gray-800">
                    <th className="px-6 py-4 text-left text-sm font-semibold text-gray-400">
                      Business Name
                    </th>
                    <th className="px-6 py-4 text-left text-sm font-semibold text-gray-400">
                      Location
                    </th>
                    <th className="px-6 py-4 text-left text-sm font-semibold text-gray-400 w-96">
                      Description
                    </th>
                    <th className="px-6 py-4 text-left text-sm font-semibold text-gray-400">
                      Contact
                    </th>
                    <th className="px-6 py-4 text-left text-sm font-semibold text-gray-400">
                      Website
                    </th>
                    <th className="px-6 py-4 text-left text-sm font-semibold text-gray-400">
                      Rating
                    </th>
                    <th className="px-6 py-4 text-left text-sm font-semibold text-gray-400">
                      Search Date
                    </th>
                    <th className="px-6 py-4 text-left text-sm font-semibold text-gray-400">
                      Google Maps
                    </th>
                    <th className="px-6 py-4 text-left text-sm font-semibold text-gray-400">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {leads.map((lead, index) => (
                    <tr
                      key={index}
                      className="border-b border-gray-800 hover:bg-gray-800/50 transition-colors"
                    >
                      <td className="px-6 py-4">
                        <div>
                          <div className="text-white font-medium">
                            {lead.name}
                          </div>
                          <div className="text-gray-400 text-xs mt-1 max-w-xs truncate">
                            {lead.address || "-"}
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 text-gray-400 text-sm">
                        {lead.location || "-"}
                      </td>
                      <td className="px-6 py-4 text-gray-400 text-sm w-96">
                        <div className="whitespace-normal break-words">
                          {lead.description || lead.category || "-"}
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="space-y-1">
                          <div className="text-gray-400 text-sm">
                            📞 {lead.phone || "-"}
                          </div>
                          {lead.email && lead.email !== "-" && (
                            <div className="text-gray-400 text-sm">
                              ✉️ {lead.email}
                            </div>
                          )}
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        {lead.website && lead.website !== "-" ? (
                          <div className="flex items-center gap-2">
                            <a
                              href={lead.website}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-primary hover:text-blue-400 transition-colors text-sm truncate max-w-xs"
                            >
                              {lead.website}
                            </a>
                            <button
                              onClick={() => handleCopyLink(lead.website)}
                              className="p-1 hover:bg-gray-800 rounded transition-colors"
                              title="Copy link"
                            >
                              {copiedLink === lead.website ? (
                                <span className="text-green-400 text-xs">
                                  ✓
                                </span>
                              ) : (
                                <Copy className="w-4 h-4 text-gray-400 hover:text-primary" />
                              )}
                            </button>
                          </div>
                        ) : (
                          <span className="text-gray-400">-</span>
                        )}
                      </td>
                      <td className="px-6 py-4 text-gray-400">
                        {lead.rating !== "-" ? (
                          <span>
                            ⭐ {lead.rating} ({lead.totalRatings})
                          </span>
                        ) : (
                          "-"
                        )}
                      </td>
                      <td className="px-6 py-4 text-gray-400 text-sm">
                        {lead.searchDate
                          ? new Date(lead.searchDate).toLocaleDateString()
                          : "-"}
                      </td>
                      <td className="px-6 py-4">
                        <a
                          href={lead.googleMapsLink}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 text-primary hover:text-blue-400 transition-colors"
                        >
                          <ExternalLink className="w-4 h-4" />
                          <span className="text-sm">View</span>
                        </a>
                      </td>
                      <td className="px-6 py-4">
                        <button
                          onClick={() => handleSaveLead(lead)}
                          disabled={
                            savedLeads.has(lead.googleMapsLink) ||
                            savingLead === lead.googleMapsLink
                          }
                          className={`p-2 rounded transition-colors ${
                            savedLeads.has(lead.googleMapsLink)
                              ? "bg-green-500/20 text-green-400"
                              : "hover:bg-gray-800 text-gray-400 hover:text-primary"
                          }`}
                          title={
                            savedLeads.has(lead.googleMapsLink)
                              ? "Saved"
                              : "Save lead"
                          }
                        >
                          {savedLeads.has(lead.googleMapsLink) ? (
                            <BookmarkCheck className="w-4 h-4" />
                          ) : (
                            <Bookmark className="w-4 h-4" />
                          )}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* Auth Modal */}
      <AuthModal
        isOpen={showAuthModal}
        onClose={() => setShowAuthModal(false)}
        onLoginSuccess={handleLoginSuccess}
      />

      {/* Cache Choice Dialog */}
      {showCacheDialog && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-dark border border-gray-800 rounded-xl p-6 max-w-md w-full">
            <div className="flex items-start gap-4 mb-4">
              <div className="flex-shrink-0 w-12 h-12 bg-blue-500/10 rounded-full flex items-center justify-center">
                <svg className="w-6 h-6 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <div className="flex-1">
                <h3 className="text-xl font-semibold text-white mb-2">
                  Search Recently Performed
                </h3>
                <p className="text-gray-400 mb-4">
                  You searched for this recently. Choose how you'd like to proceed:
                </p>
              </div>
            </div>
            
            <div className="space-y-3">
              <button
                onClick={() => handleCachedChoice(true)}
                className="w-full flex items-start gap-3 p-4 bg-green-600/10 hover:bg-green-600/20 border border-green-600/30 rounded-lg transition-all text-left group"
              >
                <div className="flex-shrink-0 w-10 h-10 bg-green-600/20 rounded-full flex items-center justify-center mt-1">
                  <svg className="w-5 h-5 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                  </svg>
                </div>
                <div className="flex-1">
                  <div className="font-semibold text-white mb-1">⚡ Instant Results (Fully Cached)</div>
                  <div className="text-sm text-gray-400">
                    Show the exact same results from your recent search. Completely instant, zero API calls, but will include any previously seen leads from that search.
                  </div>
                </div>
              </button>

              <button
                onClick={() => handleCachedChoice(false)}
                className="w-full flex items-start gap-3 p-4 bg-blue-600/10 hover:bg-blue-600/20 border border-blue-600/30 rounded-lg transition-all text-left group"
              >
                <div className="flex-shrink-0 w-10 h-10 bg-blue-600/20 rounded-full flex items-center justify-center mt-1">
                  <svg className="w-5 h-5 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                  </svg>
                </div>
                <div className="flex-1">
                  <div className="font-semibold text-white mb-1">Fresh Results (With Deduplication)</div>
                  <div className="text-sm text-gray-400">
                    Generate new leads while automatically excluding ones you've already seen. Takes a few seconds but ensures unique results.
                  </div>
                </div>
              </button>
            </div>

            <button
              onClick={() => {
                setShowCacheDialog(false);
                setPendingSearchParams(null);
              }}
              className="mt-4 w-full px-4 py-2 bg-gray-800 hover:bg-gray-700 text-gray-300 rounded-lg transition-colors"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Search History Modal */}
      {showSearchHistory && (
        <SearchHistory onClose={() => setShowSearchHistory(false)} />
      )}

      {/* Saved Leads Modal */}
      {showSavedLeads && (
        <SavedLeads onClose={() => setShowSavedLeads(false)} />
      )}

      {/* Settings Modal */}
      {showSettings && (
        <Settings user={user} onClose={() => setShowSettings(false)} />
      )}

      {/* Admin Dashboard Modal */}
      {showAdminDashboard && user?.isAdmin && (
        <AdminDashboard onClose={() => setShowAdminDashboard(false)} />
      )}
    </div>
  );
}

export default App;
