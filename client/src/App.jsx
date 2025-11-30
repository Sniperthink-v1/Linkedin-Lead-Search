import React, { useState } from "react";
import axios from "axios";
import SearchForm from "./components/SearchForm";
import BusinessSearchForm from "./components/BusinessSearchForm";
import {
  Users,
  ExternalLink,
  User,
  Download,
  Building2,
  Copy,
} from "lucide-react";
import * as XLSX from "xlsx";

function App() {
  const [activeTab, setActiveTab] = useState("people"); // 'people' or 'business'
  const [leads, setLeads] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [searched, setSearched] = useState(false);
  const [totalResults, setTotalResults] = useState(0);
  const [copiedLink, setCopiedLink] = useState(null);

  const handleCopyLink = (link) => {
    navigator.clipboard.writeText(link);
    setCopiedLink(link);
    setTimeout(() => setCopiedLink(null), 2000);
  };

  const handleDownloadExcel = () => {
    // Prepare data for Excel export based on active tab
    let excelData, sheetName, filename;

    if (activeTab === "people") {
      excelData = leads.map((lead) => ({
        Name: lead.personName,
        "Job Title": lead.jobTitle || "-",
        Company: lead.company || "-",
        Link: lead.profileLink,
      }));
      sheetName = "LinkedIn Leads";
      filename = "linkedin_leads";
    } else {
      excelData = leads.map((lead) => ({
        "Business Name": lead.name,
        Address: lead.address || "-",
        Phone: lead.phone || "-",
        Website: lead.website || "-",
        Rating: lead.rating || "-",
        "Total Ratings": lead.totalRatings || "-",
        "Google Maps Link": lead.googleMapsLink,
      }));
      sheetName = "Business Leads";
      filename = "business_leads";
    }

    // Create worksheet from data
    const worksheet = XLSX.utils.json_to_sheet(excelData);

    // Set column widths for better readability
    if (activeTab === "people") {
      worksheet["!cols"] = [
        { wch: 25 }, // Name
        { wch: 30 }, // Job Title
        { wch: 30 }, // Company
        { wch: 50 }, // Link
      ];

      // Format the Link column as hyperlinks
      const range = XLSX.utils.decode_range(worksheet["!ref"]);
      for (let row = range.s.r + 1; row <= range.e.r; row++) {
        const linkCell = XLSX.utils.encode_cell({ r: row, c: 3 }); // Column D (Link)
        if (worksheet[linkCell]) {
          const url = worksheet[linkCell].v;
          worksheet[linkCell] = {
            t: "s",
            v: url,
            l: { Target: url, Tooltip: "Open LinkedIn Profile" },
          };
        }
      }
    } else {
      worksheet["!cols"] = [
        { wch: 30 }, // Business Name
        { wch: 40 }, // Address
        { wch: 18 }, // Phone
        { wch: 35 }, // Website
        { wch: 10 }, // Rating
        { wch: 15 }, // Total Ratings
        { wch: 50 }, // Google Maps Link
      ];

      // Format the Website and Google Maps Link columns as hyperlinks
      const range = XLSX.utils.decode_range(worksheet["!ref"]);
      for (let row = range.s.r + 1; row <= range.e.r; row++) {
        // Website column (column D, index 3)
        const websiteCell = XLSX.utils.encode_cell({ r: row, c: 3 });
        if (worksheet[websiteCell] && worksheet[websiteCell].v !== "-") {
          const url = worksheet[websiteCell].v;
          worksheet[websiteCell] = {
            t: "s",
            v: url,
            l: { Target: url, Tooltip: "Visit Website" },
          };
        }

        // Google Maps Link column (column G, index 6)
        const mapsCell = XLSX.utils.encode_cell({ r: row, c: 6 });
        if (worksheet[mapsCell]) {
          const url = worksheet[mapsCell].v;
          worksheet[mapsCell] = {
            t: "s",
            v: url,
            l: { Target: url, Tooltip: "Open in Google Maps" },
          };
        }
      }
    }

    // Create workbook and append sheet
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, sheetName);

    // Generate filename with timestamp
    const timestamp = new Date()
      .toISOString()
      .replace(/[:.]/g, "-")
      .slice(0, -5);
    const finalFilename = `${filename}_${timestamp}.xlsx`;

    // Download file
    XLSX.writeFile(workbook, finalFilename);
  };

  const handleSearch = async (formData) => {
    setLoading(true);
    setError(null);
    setSearched(true);
    setLeads([]);
    setTotalResults(0);

    try {
      // Use EventSource for Server-Sent Events (SSE) to receive streaming results
      const params = new URLSearchParams(formData).toString();
      const eventSource = new EventSource(`/api/leads?${params}`);

      eventSource.onmessage = (event) => {
        const data = JSON.parse(event.data);

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
          "Failed to connect to server. Please make sure the backend is running on port 3000."
        );
        setLoading(false);
      };
    } catch (err) {
      setError("Failed to fetch leads. Please try again.");
      console.error(err);
      setLoading(false);
    }
  };

  const handleBusinessSearch = async (formData) => {
    setLoading(true);
    setError(null);
    setSearched(true);
    setLeads([]);
    setTotalResults(0);

    try {
      // Use EventSource for Server-Sent Events (SSE) to receive streaming results
      const params = new URLSearchParams(formData).toString();
      const eventSource = new EventSource(
        `http://localhost:3001/api/business-leads?${params}`
      );

      eventSource.onmessage = (event) => {
        const data = JSON.parse(event.data);

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
          "Failed to connect to server. Please make sure the backend is running on port 3001."
        );
        setLoading(false);
      };
    } catch (err) {
      setError("Failed to fetch business leads. Please try again.");
      console.error(err);
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-darker p-6 md:p-12">
      <div className="max-w-7xl mx-auto space-y-12">
        {/* Header */}
        <div className="text-center space-y-4">
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
          <p className="text-gray-400 text-lg max-w-2xl mx-auto">
            {activeTab === "people"
              ? "Find professionals on LinkedIn by job title and location. Enter your search criteria below to discover potential leads."
              : "Find businesses using Google Places. Enter business type and location to discover local businesses."}
          </p>
        </div>

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

        {/* Search Section */}
        {activeTab === "people" ? (
          <SearchForm onSearch={handleSearch} isLoading={loading} />
        ) : (
          <BusinessSearchForm
            onSearch={handleBusinessSearch}
            isLoading={loading}
          />
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
              <button
                onClick={handleDownloadExcel}
                className="inline-flex items-center gap-2 px-4 py-2 bg-primary hover:bg-blue-600 text-white rounded-lg transition-colors"
              >
                <Download className="w-4 h-4" />
                Download Excel
              </button>
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
                      Address
                    </th>
                    <th className="px-6 py-4 text-left text-sm font-semibold text-gray-400">
                      Phone
                    </th>
                    <th className="px-6 py-4 text-left text-sm font-semibold text-gray-400">
                      Website
                    </th>
                    <th className="px-6 py-4 text-left text-sm font-semibold text-gray-400">
                      Rating
                    </th>
                    <th className="px-6 py-4 text-left text-sm font-semibold text-gray-400">
                      Google Maps
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {leads.map((lead, index) => (
                    <tr
                      key={index}
                      className="border-b border-gray-800 hover:bg-gray-800/50 transition-colors"
                    >
                      <td className="px-6 py-4 text-white font-medium">
                        {lead.name}
                      </td>
                      <td className="px-6 py-4 text-gray-400 max-w-xs truncate">
                        {lead.address || "-"}
                      </td>
                      <td className="px-6 py-4 text-gray-400">
                        {lead.phone || "-"}
                      </td>
                      <td className="px-6 py-4">
                        {lead.website && lead.website !== "-" ? (
                          <a
                            href={lead.website}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 text-primary hover:text-blue-400 transition-colors"
                          >
                            <ExternalLink className="w-4 h-4" />
                            <span className="text-sm">Visit</span>
                          </a>
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
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default App;
