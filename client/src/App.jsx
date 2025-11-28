import React, { useState } from "react";
import axios from "axios";
import SearchForm from "./components/SearchForm";
import LeadCard from "./components/LeadCard";
import { Users } from "lucide-react";

function App() {
  const [leads, setLeads] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [searched, setSearched] = useState(false);
  const [totalResults, setTotalResults] = useState(0);

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

        // Fallback to regular API call if SSE fails
        axios
          .get("/api/leads", { params: formData })
          .then((response) => {
            setLeads(response.data.leads);
            setTotalResults(response.data.total || response.data.leads.length);
          })
          .catch((error) => {
            setError("Failed to fetch leads. Please try again.");
            console.error(error);
          })
          .finally(() => {
            setLoading(false);
          });
      };
    } catch (err) {
      setError("Failed to fetch leads. Please try again.");
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
            <Users className="w-8 h-8 text-primary" />
          </div>
          <h1 className="text-4xl md:text-5xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-white to-gray-500">
            Business Lead Finder
          </h1>
          <p className="text-gray-400 text-lg max-w-2xl mx-auto">
            Find companies and businesses directly from Google Search. Enter
            your criteria below to discover potential business leads.
          </p>
        </div>

        {/* Search Section */}
        <SearchForm onSearch={handleSearch} isLoading={loading} />

        {/* Results Section */}
        <div className="space-y-6">
          {loading && (
            <div className="text-center text-primary py-12">
              <div className="inline-flex items-center gap-3">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
                <span className="text-lg">
                  Fetching companies from multiple pages...
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
            <div className="text-center text-gray-400 pb-4">
              Found{" "}
              <span className="text-primary font-semibold">{totalResults}</span>{" "}
              companies
            </div>
          )}

          {searched && !loading && leads.length === 0 && !error && (
            <div className="text-center text-gray-500 py-12">
              No companies found. Try adjusting your search criteria.
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {leads.map((lead, index) => (
              <LeadCard key={index} lead={lead} index={index} />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

export default App;
