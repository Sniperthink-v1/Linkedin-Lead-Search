import React, { useState } from "react";
import { Search, Loader2, Sparkles } from "lucide-react";

const SearchForm = ({ onSearch, isLoading, cooldown = 0 }) => {
  const [formData, setFormData] = useState({
    businessType: "",
    location: "",
    industry: "",
  });

  const [quickQuery, setQuickQuery] = useState("");
  const [isParsing, setIsParsing] = useState(false);

  const isDisabled = isLoading || isParsing || cooldown > 0;

  const handleSubmit = (e) => {
    e.preventDefault();
    onSearch(formData);
  };

  const handleQuickSearch = async (e) => {
    e.preventDefault();
    if (!quickQuery.trim()) return;

    setIsParsing(true);
    try {
      const response = await fetch("http://localhost:3000/api/parse-query", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query: quickQuery }),
      });

      const data = await response.json();

      if (data.success) {
        // Auto-fill form and trigger search
        const parsedData = {
          businessType: data.businessType,
          location: data.location,
          industry: data.industry || "",
        };
        setFormData(parsedData);
        onSearch(parsedData);
      } else {
        alert("Failed to parse query. Please try again.");
      }
    } catch (error) {
      console.error("Quick search error:", error);
      alert("Failed to parse query. Please use the form below.");
    } finally {
      setIsParsing(false);
    }
  };

  return (
    <div className="w-full max-w-4xl mx-auto space-y-6">
      {/* Quick Search Bar */}
      <form
        onSubmit={handleQuickSearch}
        className="bg-dark p-6 rounded-2xl shadow-2xl border border-gray-800"
      >
        <div className="flex items-center gap-2 mb-3">
          <Sparkles className="w-5 h-5 text-primary" />
          <h3 className="text-lg font-semibold text-white">Quick Search</h3>
        </div>
        <div className="flex gap-3">
          <input
            type="text"
            placeholder="e.g., Find senior ML engineers in Bangalore working on AI"
            className="flex-1 bg-darker border border-gray-700 rounded-lg px-4 py-3 text-white focus:ring-2 focus:ring-primary focus:border-transparent outline-none transition-all"
            value={quickQuery}
            onChange={(e) => setQuickQuery(e.target.value)}
            disabled={isDisabled}
          />
          <button
            type="submit"
            disabled={isDisabled || !quickQuery.trim()}
            className="bg-primary hover:bg-blue-600 text-white px-6 py-3 rounded-lg font-semibold flex items-center gap-2 transition-all disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap"
          >
            {isParsing ? (
              <>
                <Loader2 className="animate-spin w-5 h-5" />
                Parsing...
              </>
            ) : cooldown > 0 ? (
              <>
                <Loader2 className="animate-spin w-5 h-5" />
                Wait {cooldown}s
              </>
            ) : (
              <>
                <Search className="w-5 h-5" />
                Search
              </>
            )}
          </button>
        </div>
        <p className="text-xs text-gray-500 mt-2">
          {cooldown > 0
            ? ""
            : "AI will extract job title and location from your query"}
        </p>
      </form>

      {/* Divider */}
      <div className="flex items-center gap-4">
        <div className="flex-1 border-t border-gray-800"></div>
        <span className="text-sm text-gray-500">or use advanced search</span>
        <div className="flex-1 border-t border-gray-800"></div>
      </div>

      {/* Advanced Search Form */}
      <form
        onSubmit={handleSubmit}
        className="bg-dark p-8 rounded-2xl shadow-2xl border border-gray-800"
      >
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="space-y-2">
            <label className="text-sm font-medium text-gray-400">
              Job Title / Role
            </label>
            <input
              type="text"
              placeholder="e.g. Software Engineer, Marketing Manager"
              className="w-full bg-darker border border-gray-700 rounded-lg px-4 py-3 text-white focus:ring-2 focus:ring-primary focus:border-transparent outline-none transition-all"
              value={formData.businessType}
              onChange={(e) =>
                setFormData({ ...formData, businessType: e.target.value })
              }
              required
            />
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium text-gray-400">
              Location
            </label>
            <input
              type="text"
              placeholder="e.g. Delhi, Mumbai, Bangalore"
              className="w-full bg-darker border border-gray-700 rounded-lg px-4 py-3 text-white focus:ring-2 focus:ring-primary focus:border-transparent outline-none transition-all"
              value={formData.location}
              onChange={(e) =>
                setFormData({ ...formData, location: e.target.value })
              }
              required
            />
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium text-gray-400">
              Industry (Optional)
            </label>
            <input
              type="text"
              placeholder="e.g. Technology, Finance, Healthcare"
              className="w-full bg-darker border border-gray-700 rounded-lg px-4 py-3 text-white focus:ring-2 focus:ring-primary focus:border-transparent outline-none transition-all"
              value={formData.industry}
              onChange={(e) =>
                setFormData({ ...formData, industry: e.target.value })
              }
            />
          </div>
        </div>

        <div className="mt-8 flex justify-end">
          <button
            type="submit"
            disabled={isDisabled}
            className="bg-primary hover:bg-blue-600 text-white px-8 py-3 rounded-lg font-semibold flex items-center gap-2 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isLoading ? (
              <>
                <Loader2 className="animate-spin w-5 h-5" />
                Searching...
              </>
            ) : cooldown > 0 ? (
              <>
                <Loader2 className="animate-spin w-5 h-5" />
                Wait {cooldown}s
              </>
            ) : (
              <>
                <Search className="w-5 h-5" />
                Find People
              </>
            )}
          </button>
        </div>
      </form>
    </div>
  );
};

export default SearchForm;
