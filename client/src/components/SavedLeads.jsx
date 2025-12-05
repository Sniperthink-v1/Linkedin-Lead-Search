import React, { useState, useEffect } from "react";
import {
  Bookmark,
  Trash2,
  ExternalLink,
  Download,
  Users,
  Building2,
  User,
} from "lucide-react";
import * as XLSX from "xlsx";

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:3000";

function SavedLeads({ onClose }) {
  const [savedLeads, setSavedLeads] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [filter, setFilter] = useState("all"); // 'all', 'people', 'business'

  useEffect(() => {
    fetchSavedLeads();
  }, []);

  const fetchSavedLeads = async () => {
    try {
      const token = localStorage.getItem("authToken");
      const response = await fetch(`${API_URL}/api/leads/saved`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      const data = await response.json();

      if (data.success) {
        setSavedLeads(data.leads);
      } else {
        setError(data.error || "Failed to fetch saved leads");
      }
    } catch (err) {
      setError("Failed to load saved leads");
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (leadId) => {
    if (!confirm("Are you sure you want to remove this saved lead?")) {
      return;
    }

    try {
      const token = localStorage.getItem("authToken");
      const response = await fetch(`${API_URL}/api/leads/saved/${leadId}`, {
        method: "DELETE",
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      const data = await response.json();

      if (data.success) {
        setSavedLeads(savedLeads.filter((l) => l.id !== leadId));
      } else {
        alert(data.error || "Failed to delete lead");
      }
    } catch (err) {
      alert("Failed to delete lead");
      console.error(err);
    }
  };

  const handleDownloadAll = () => {
    const filteredLeads = getFilteredLeads();

    if (filteredLeads.length === 0) {
      alert("No leads to export");
      return;
    }

    // Separate by type
    const peopleLeads = filteredLeads
      .filter((l) => l.leadType === "people")
      .map((l) => ({
        Name: l.personName,
        "Job Title": l.jobTitle || "-",
        Company: l.company || "-",
        Link: l.profileLink,
        "Saved Date": new Date(l.savedAt).toLocaleDateString(),
      }));

    const businessLeads = filteredLeads
      .filter((l) => l.leadType === "business")
      .map((l) => ({
        "Business Name": l.businessName,
        Address: l.address || "-",
        Phone: l.phone || "-",
        Email: l.email || "-",
        Website: l.website || "-",
        Rating: l.rating || "-",
        "Total Ratings": l.totalRatings || "-",
        Owner: l.ownerName || "-",
        Description: l.description || "-",
        Location: l.location || "-",
        "Last Review": l.lastReview || "-",
        "Google Maps": l.googleMapsLink,
        "Saved Date": new Date(l.savedAt).toLocaleDateString(),
      }));

    const workbook = XLSX.utils.book_new();

    if (peopleLeads.length > 0) {
      const worksheet = XLSX.utils.json_to_sheet(peopleLeads);
      XLSX.utils.book_append_sheet(workbook, worksheet, "People Leads");
    }

    if (businessLeads.length > 0) {
      const worksheet = XLSX.utils.json_to_sheet(businessLeads);
      XLSX.utils.book_append_sheet(workbook, worksheet, "Business Leads");
    }

    const timestamp = new Date()
      .toISOString()
      .replace(/[:.]/g, "-")
      .slice(0, -5);
    XLSX.writeFile(workbook, `saved_leads_${timestamp}.xlsx`);
  };

  const getFilteredLeads = () => {
    if (filter === "all") return savedLeads;
    return savedLeads.filter((lead) => lead.leadType === filter);
  };

  const formatDate = (dateString) => {
    const date = new Date(dateString);
    return date.toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  };

  const filteredLeads = getFilteredLeads();

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
      <div className="bg-dark border border-gray-700 rounded-xl max-w-6xl w-full max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="p-6 border-b border-gray-700">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-primary/10 rounded-lg">
                <Bookmark className="w-6 h-6 text-primary" />
              </div>
              <div>
                <h2 className="text-2xl font-bold text-white">Saved Leads</h2>
                <p className="text-gray-400 text-sm">
                  {savedLeads.length} saved lead
                  {savedLeads.length !== 1 ? "s" : ""}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {filteredLeads.length > 0 && (
                <button
                  onClick={handleDownloadAll}
                  className="flex items-center gap-2 px-4 py-2 bg-primary hover:bg-blue-600 text-white rounded-lg transition-colors"
                >
                  <Download className="w-4 h-4" />
                  Export All
                </button>
              )}
              <button
                onClick={onClose}
                className="text-gray-400 hover:text-white transition-colors p-2"
              >
                ✕
              </button>
            </div>
          </div>

          {/* Filter Tabs */}
          <div className="flex gap-2">
            <button
              onClick={() => setFilter("all")}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                filter === "all"
                  ? "bg-primary text-white"
                  : "bg-darker text-gray-400 hover:text-white"
              }`}
            >
              All ({savedLeads.length})
            </button>
            <button
              onClick={() => setFilter("people")}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                filter === "people"
                  ? "bg-primary text-white"
                  : "bg-darker text-gray-400 hover:text-white"
              }`}
            >
              <Users className="w-4 h-4" />
              People ({savedLeads.filter((l) => l.leadType === "people").length}
              )
            </button>
            <button
              onClick={() => setFilter("business")}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                filter === "business"
                  ? "bg-primary text-white"
                  : "bg-darker text-gray-400 hover:text-white"
              }`}
            >
              <Building2 className="w-4 h-4" />
              Business (
              {savedLeads.filter((l) => l.leadType === "business").length})
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {loading ? (
            <div className="text-center py-12">
              <div className="inline-flex items-center gap-3">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
                <span className="text-gray-400">Loading saved leads...</span>
              </div>
            </div>
          ) : error ? (
            <div className="bg-red-500/10 border border-red-500/20 text-red-400 p-4 rounded-lg text-center">
              {error}
            </div>
          ) : filteredLeads.length === 0 ? (
            <div className="text-center py-12">
              <Bookmark className="w-16 h-16 text-gray-600 mx-auto mb-4" />
              <p className="text-gray-400 text-lg">No saved leads yet</p>
              <p className="text-gray-500 text-sm mt-2">
                Save leads from search results to access them here
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {filteredLeads.map((lead) => (
                <div
                  key={lead.id}
                  className="bg-darker border border-gray-700 rounded-lg p-4 hover:border-gray-600 transition-colors"
                >
                  {lead.leadType === "people" ? (
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex gap-4 flex-1">
                        <div className="w-12 h-12 bg-gray-800 rounded-full flex items-center justify-center text-primary flex-shrink-0">
                          <User className="w-6 h-6" />
                        </div>
                        <div className="flex-1">
                          <h3 className="text-white font-medium text-lg">
                            {lead.personName}
                          </h3>
                          <p className="text-gray-400 text-sm mt-1">
                            {lead.jobTitle || "No title"}
                          </p>
                          {lead.company && (
                            <p className="text-gray-500 text-sm">
                              {lead.company}
                            </p>
                          )}
                          <div className="flex items-center gap-4 mt-2">
                            <a
                              href={lead.profileLink}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="flex items-center gap-1 text-primary hover:text-blue-400 text-sm"
                            >
                              <ExternalLink className="w-3 h-3" />
                              View Profile
                            </a>
                            <span className="text-xs text-gray-500">
                              Saved {formatDate(lead.savedAt)}
                            </span>
                          </div>
                        </div>
                      </div>
                      <button
                        onClick={() => handleDelete(lead.id)}
                        className="p-2 text-gray-400 hover:text-red-400 hover:bg-red-500/10 rounded transition-colors"
                        title="Remove from saved"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  ) : (
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1">
                        <h3 className="text-white font-medium text-lg">
                          {lead.businessName}
                        </h3>
                        <div className="grid grid-cols-2 gap-x-6 gap-y-1 mt-2 text-sm">
                          {lead.address && lead.address !== "-" && (
                            <p className="text-gray-400">📍 {lead.address}</p>
                          )}
                          {lead.phone && lead.phone !== "-" && (
                            <p className="text-gray-400">📞 {lead.phone}</p>
                          )}
                          {lead.rating && lead.rating !== "-" && (
                            <p className="text-gray-400">
                              ⭐ {lead.rating} ({lead.totalRatings})
                            </p>
                          )}
                          {lead.website && lead.website !== "-" && (
                            <a
                              href={lead.website}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-primary hover:text-blue-400"
                            >
                              🌐 Website
                            </a>
                          )}
                        </div>
                        <div className="flex items-center gap-4 mt-2">
                          <a
                            href={lead.googleMapsLink}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex items-center gap-1 text-primary hover:text-blue-400 text-sm"
                          >
                            <ExternalLink className="w-3 h-3" />
                            View on Maps
                          </a>
                          <span className="text-xs text-gray-500">
                            Saved {formatDate(lead.savedAt)}
                          </span>
                        </div>
                      </div>
                      <button
                        onClick={() => handleDelete(lead.id)}
                        className="p-2 text-gray-400 hover:text-red-400 hover:bg-red-500/10 rounded transition-colors"
                        title="Remove from saved"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default SavedLeads;
