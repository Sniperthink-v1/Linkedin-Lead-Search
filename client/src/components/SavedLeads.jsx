import React, { useState, useEffect } from "react";
import {
  Bookmark,
  Trash2,
  ExternalLink,
  Download,
  Users,
  Building2,
  User,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  Mail,
  MapPin,
} from "lucide-react";
import * as XLSX from "xlsx";

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:3000";

function SavedLeads({ onClose }) {
  const [savedLeads, setSavedLeads] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [filter, setFilter] = useState("all"); // 'all', 'people', 'business'
  const [sortBy, setSortBy] = useState("date-desc"); // 'date-desc', 'date-asc', 'name-asc', 'name-desc', 'rating-desc', 'rating-asc'
  const [categoryFilter, setCategoryFilter] = useState("all"); // 'all' or specific category
  const [cityFilter, setCityFilter] = useState("all"); // 'all' or specific city
  const [stateFilter, setStateFilter] = useState("all"); // 'all' or specific state
  const [countryFilter, setCountryFilter] = useState("all"); // 'all' or specific country

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
    const filteredLeads = getFilteredAndSortedLeads();

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
        Email: l.email || "-",
        Location: l.location || "-",
        Link: l.profileLink,
        "Saved Date": new Date(l.savedAt).toLocaleDateString(),
      }));

    const businessLeads = filteredLeads
      .filter((l) => l.leadType === "business")
      .map((l) => ({
        "Business Name": l.businessName,
        Category: l.category || "-",
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

    // Generate date string for filename (YYYY-MM-DD format)
    const dateStr = new Date().toISOString().split('T')[0];
    
    // Determine lead type for filename
    let leadType = "savedleads";
    if (filter === "people") {
      leadType = "people";
    } else if (filter === "business") {
      leadType = "business";
    } else if (peopleLeads.length > 0 && businessLeads.length === 0) {
      leadType = "people";
    } else if (businessLeads.length > 0 && peopleLeads.length === 0) {
      leadType = "business";
    }
    
    // Build descriptive parts for filename
    const cleanString = (str) => {
      return str
        .toString()
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '_')
        .replace(/^_+|_+$/g, '')
        .slice(0, 30);
    };
    
    // Get category/type info
    let typeInfo = "all";
    if (categoryFilter !== "all") {
      typeInfo = cleanString(categoryFilter);
    } else if (filter !== "all") {
      typeInfo = filter;
    }
    
    // Get location info
    let locationInfo = "all";
    if (cityFilter !== "all") {
      locationInfo = cleanString(cityFilter);
    } else if (stateFilter !== "all") {
      locationInfo = cleanString(stateFilter);
    } else if (countryFilter !== "all") {
      locationInfo = cleanString(countryFilter);
    }
    
    const filename = `${leadType}_${dateStr}_${typeInfo}_${locationInfo}`;
    XLSX.writeFile(workbook, `${filename}.xlsx`);
  };

  // Helper function to parse location
  const parseLocation = (locationStr) => {
    if (!locationStr || locationStr === "-") return { city: "", state: "", country: "" };
    
    const parts = locationStr.split(",").map(p => p.trim());
    
    // For business addresses with format: "street, area, city, state pin, country"
    // We want to extract the city (usually 3rd or 4th from end), state, and country
    if (parts.length >= 3) {
      const country = parts[parts.length - 1]; // Last part is country
      const stateWithPin = parts[parts.length - 2]; // Second to last might be "State 243001"
      const city = parts[parts.length - 3]; // Third to last is usually city
      
      // Extract state (remove pin code if present)
      const state = stateWithPin.replace(/\s+\d+$/, '').trim();
      
      return { city, state, country };
    } else if (parts.length === 2) {
      return { city: parts[0], state: "", country: parts[1] };
    } else if (parts.length === 1) {
      return { city: parts[0], state: "", country: "" };
    }
    
    return { city: locationStr, state: "", country: "" };
  };

  const getFilteredAndSortedLeads = () => {
    // First filter by type
    let filtered = filter === "all" ? savedLeads : savedLeads.filter((lead) => lead.leadType === filter);
    
    // Then filter by category (for business leads)
    if (categoryFilter !== "all" && (filter === "business" || filter === "all")) {
      filtered = filtered.filter((lead) => 
        lead.leadType === "business" && lead.category === categoryFilter
      );
    }
    
    // Filter by city
    if (cityFilter !== "all") {
      filtered = filtered.filter((lead) => {
        // For business leads, use address; for people leads, use location
        const locationStr = lead.leadType === "business" ? lead.address : lead.location;
        const location = parseLocation(locationStr);
        return location.city === cityFilter;
      });
    }
    
    // Filter by state
    if (stateFilter !== "all") {
      filtered = filtered.filter((lead) => {
        // For business leads, use address; for people leads, use location
        const locationStr = lead.leadType === "business" ? lead.address : lead.location;
        const location = parseLocation(locationStr);
        return location.state === stateFilter;
      });
    }
    
    // Filter by country
    if (countryFilter !== "all") {
      filtered = filtered.filter((lead) => {
        // For business leads, use address; for people leads, use location
        const locationStr = lead.leadType === "business" ? lead.address : lead.location;
        const location = parseLocation(locationStr);
        return location.country === countryFilter;
      });
    }
    
    // Then sort
    const sorted = [...filtered].sort((a, b) => {
      switch (sortBy) {
        case "date-desc":
          return new Date(b.savedAt) - new Date(a.savedAt);
        case "date-asc":
          return new Date(a.savedAt) - new Date(b.savedAt);
        case "name-asc":
          const nameA = (a.personName || a.businessName || "").toLowerCase();
          const nameB = (b.personName || b.businessName || "").toLowerCase();
          return nameA.localeCompare(nameB);
        case "name-desc":
          const nameA2 = (a.personName || a.businessName || "").toLowerCase();
          const nameB2 = (b.personName || b.businessName || "").toLowerCase();
          return nameB2.localeCompare(nameA2);
        case "rating-desc":
          // For business leads only, put nulls at the end
          const ratingA = a.rating || 0;
          const ratingB = b.rating || 0;
          return ratingB - ratingA;
        case "rating-asc":
          const ratingA2 = a.rating || 0;
          const ratingB2 = b.rating || 0;
          return ratingA2 - ratingB2;
        default:
          return 0;
      }
    });
    
    return sorted;
  };

  // Get unique cities from all leads
  const getUniqueCities = () => {
    const cities = new Set();
    savedLeads.forEach((lead) => {
      // For business leads, use address; for people leads, use location
      const locationStr = lead.leadType === "business" ? lead.address : lead.location;
      const location = parseLocation(locationStr);
      if (location.city) cities.add(location.city);
    });
    return Array.from(cities).sort();
  };

  // Get unique states from all leads
  const getUniqueStates = () => {
    const states = new Set();
    savedLeads.forEach((lead) => {
      // For business leads, use address; for people leads, use location
      const locationStr = lead.leadType === "business" ? lead.address : lead.location;
      const location = parseLocation(locationStr);
      if (location.state) states.add(location.state);
    });
    return Array.from(states).sort();
  };

  // Get unique countries from all leads
  const getUniqueCountries = () => {
    const countries = new Set();
    savedLeads.forEach((lead) => {
      // For business leads, use address; for people leads, use location
      const locationStr = lead.leadType === "business" ? lead.address : lead.location;
      const location = parseLocation(locationStr);
      if (location.country) countries.add(location.country);
    });
    return Array.from(countries).sort();
  };

  const formatDate = (dateString) => {
    const date = new Date(dateString);
    return date.toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  };

  const formatDateTime = (dateString) => {
    const date = new Date(dateString);
    return date.toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  // Get unique business categories for filter dropdown
  const getBusinessCategories = () => {
    const categories = new Set();
    savedLeads
      .filter((lead) => lead.leadType === "business" && lead.category && lead.category !== "-")
      .forEach((lead) => categories.add(lead.category));
    return Array.from(categories).sort();
  };

  const filteredLeads = getFilteredAndSortedLeads();
  const businessCategories = getBusinessCategories();

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

          {/* Sort Options and Category Filter */}
          {filteredLeads.length > 0 && (
            <div className="mt-4 flex items-center gap-4 flex-wrap">
              {/* Sort Dropdown */}
              <div className="flex items-center gap-2">
                <span className="text-gray-400 text-sm flex items-center gap-2">
                  <ArrowUpDown className="w-4 h-4" />
                  Sort by:
                </span>
                <select
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value)}
                  className="bg-darker border border-gray-700 text-gray-300 text-sm rounded-lg px-3 py-1.5 focus:outline-none focus:border-primary transition-colors"
                >
                  <option value="date-desc">Date (Newest First)</option>
                  <option value="date-asc">Date (Oldest First)</option>
                  <option value="name-asc">Name (A-Z)</option>
                  <option value="name-desc">Name (Z-A)</option>
                  {filter === "business" && (
                    <>
                      <option value="rating-desc">Rating (High to Low)</option>
                      <option value="rating-asc">Rating (Low to High)</option>
                    </>
                  )}
                  {filter === "all" && (
                    <>
                      <option value="rating-desc">Rating (High to Low)</option>
                      <option value="rating-asc">Rating (Low to High)</option>
                    </>
                  )}
                </select>
              </div>

              {/* Category Filter - Show only for business tab or all tab with business leads */}
              {(filter === "business" || filter === "all") && businessCategories.length > 0 && (
                <div className="flex items-center gap-2">
                  <span className="text-gray-400 text-sm flex items-center gap-2">
                    <Building2 className="w-4 h-4" />
                    Category:
                  </span>
                  <select
                    value={categoryFilter}
                    onChange={(e) => setCategoryFilter(e.target.value)}
                    className="bg-darker border border-gray-700 text-gray-300 text-sm rounded-lg px-3 py-1.5 focus:outline-none focus:border-primary transition-colors"
                  >
                    <option value="all">All Categories</option>
                    {businessCategories.map((category) => (
                      <option key={category} value={category}>
                        {category}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {/* City Filter */}
              {getUniqueCities().length > 0 && (
                <div className="flex items-center gap-2">
                  <span className="text-gray-400 text-sm flex items-center gap-2">
                    <MapPin className="w-4 h-4" />
                    City:
                  </span>
                  <select
                    value={cityFilter}
                    onChange={(e) => setCityFilter(e.target.value)}
                    className="bg-darker border border-gray-700 text-gray-300 text-sm rounded-lg px-3 py-1.5 focus:outline-none focus:border-primary transition-colors"
                  >
                    <option value="all">All Cities</option>
                    {getUniqueCities().map((city) => (
                      <option key={city} value={city}>
                        {city}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {/* State Filter */}
              {getUniqueStates().length > 0 && (
                <div className="flex items-center gap-2">
                  <span className="text-gray-400 text-sm">State:</span>
                  <select
                    value={stateFilter}
                    onChange={(e) => setStateFilter(e.target.value)}
                    className="bg-darker border border-gray-700 text-gray-300 text-sm rounded-lg px-3 py-1.5 focus:outline-none focus:border-primary transition-colors"
                  >
                    <option value="all">All States</option>
                    {getUniqueStates().map((state) => (
                      <option key={state} value={state}>
                        {state}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {/* Country Filter */}
              {getUniqueCountries().length > 0 && (
                <div className="flex items-center gap-2">
                  <span className="text-gray-400 text-sm">Country:</span>
                  <select
                    value={countryFilter}
                    onChange={(e) => setCountryFilter(e.target.value)}
                    className="bg-darker border border-gray-700 text-gray-300 text-sm rounded-lg px-3 py-1.5 focus:outline-none focus:border-primary transition-colors"
                  >
                    <option value="all">All Countries</option>
                    {getUniqueCountries().map((country) => (
                      <option key={country} value={country}>
                        {country}
                      </option>
                    ))}
                  </select>
                </div>
              )}
            </div>
          )}
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
                          <div className="flex items-start justify-between">
                            <h3 className="text-white font-medium text-lg">
                              {lead.personName}
                            </h3>
                            <div className="text-right ml-4">
                              <div className="text-xs text-gray-400">Saved on</div>
                              <div className="text-sm text-gray-300 font-medium">
                                {formatDate(lead.savedAt)}
                              </div>
                            </div>
                          </div>
                          <p className="text-gray-400 text-sm mt-1">
                            {lead.jobTitle || "No title"}
                          </p>
                          {lead.company && (
                            <p className="text-gray-500 text-sm">
                              {lead.company}
                            </p>
                          )}
                          {lead.email && (
                            <a
                              href={`mailto:${lead.email}`}
                              className="text-gray-500 hover:text-primary text-sm flex items-center gap-1 mt-1"
                              onClick={(e) => e.stopPropagation()}
                            >
                              <Mail className="w-3 h-3" />
                              {lead.email}
                            </a>
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
                        <div className="flex items-start justify-between">
                          <div>
                            <h3 className="text-white font-medium text-lg">
                              {lead.businessName}
                            </h3>
                            {lead.category && lead.category !== "-" && (
                              <span className="inline-block mt-1 px-2 py-0.5 bg-primary/10 border border-primary/20 text-primary text-xs rounded-full">
                                {lead.category}
                              </span>
                            )}
                          </div>
                          <div className="text-right ml-4">
                            <div className="text-xs text-gray-400">Saved on</div>
                            <div className="text-sm text-gray-300 font-medium">
                              {formatDate(lead.savedAt)}
                            </div>
                          </div>
                        </div>
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
