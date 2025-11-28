import React, { useState } from "react";
import { Search, Loader2 } from "lucide-react";

const SearchForm = ({ onSearch, isLoading }) => {
  const [formData, setFormData] = useState({
    businessType: "",
    location: "",
    industry: "",
  });

  const handleSubmit = (e) => {
    e.preventDefault();
    onSearch(formData);
  };

  return (
    <form
      onSubmit={handleSubmit}
      className="w-full max-w-4xl mx-auto bg-dark p-8 rounded-2xl shadow-2xl border border-gray-800"
    >
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="space-y-2">
          <label className="text-sm font-medium text-gray-400">
            Business Type
          </label>
          <input
            type="text"
            placeholder="e.g. Manufacturing, Software Development"
            className="w-full bg-darker border border-gray-700 rounded-lg px-4 py-3 text-white focus:ring-2 focus:ring-primary focus:border-transparent outline-none transition-all"
            value={formData.businessType}
            onChange={(e) =>
              setFormData({ ...formData, businessType: e.target.value })
            }
            required
          />
        </div>
        <div className="space-y-2">
          <label className="text-sm font-medium text-gray-400">Location</label>
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
            placeholder="e.g. EdTech, FinTech, E-commerce"
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
          disabled={isLoading}
          className="bg-primary hover:bg-blue-600 text-white px-8 py-3 rounded-lg font-semibold flex items-center gap-2 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isLoading ? (
            <>
              <Loader2 className="animate-spin w-5 h-5" />
              Searching...
            </>
          ) : (
            <>
              <Search className="w-5 h-5" />
              Find Companies
            </>
          )}
        </button>
      </div>
    </form>
  );
};

export default SearchForm;
