import React, { useState } from "react";
import { Search, Loader2, Building2 } from "lucide-react";

const BusinessSearchForm = ({ onSearch, isLoading, cooldown = 0 }) => {
  const [formData, setFormData] = useState({
    businessType: "",
    location: "",
    leadCount: 20,
    leadPreset: "normal",
  });

  const [quickBusinessName, setQuickBusinessName] = useState("");
  const [quickLocation, setQuickLocation] = useState("");

  const isDisabled = isLoading || cooldown > 0;

  const handleSubmit = (e) => {
    e.preventDefault();
    // Map preset to concrete lead count ranges (server expects an int)
    const presetToCount = {
      few: 12, // represent 10-15
      normal: 28, // represent 25-30
      high: 50, // represent 45-50
    };

    const leadCount =
      presetToCount[formData.leadPreset] ||
      Math.min(50, Math.max(1, formData.leadCount || 20));

    onSearch({ ...formData, leadCount });
  };

  const handleQuickSearch = (e) => {
    e.preventDefault();
    if (!quickBusinessName.trim() || !quickLocation.trim()) return;

    // Send quick search with specific business name
    onSearch({
      specificBusinessName: quickBusinessName,
      location: quickLocation,
      businessType: "",
      leadCount: 1,
    });
  };


  return (
    <div className="w-full max-w-4xl mx-auto space-y-6">
      {/* Quick Business Name Search */}
      <form
        onSubmit={handleQuickSearch}
        className="bg-dark p-6 rounded-2xl shadow-2xl border border-gray-800"
      >
        <div className="flex items-center gap-2 mb-3">
          <Building2 className="w-5 h-5 text-primary" />
          <h3 className="text-lg font-semibold text-white">
            Quick Business Search
          </h3>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <input
            type="text"
            placeholder="e.g., Taj Hotel, Apollo Hospital, McDonald's"
            className="bg-darker border border-gray-700 rounded-lg px-4 py-3 text-white focus:ring-2 focus:ring-primary focus:border-transparent outline-none transition-all"
            value={quickBusinessName}
            onChange={(e) => setQuickBusinessName(e.target.value)}
            disabled={isDisabled}
          />
          <input
            type="text"
            placeholder="Location (e.g., Delhi, Karnataka, India)"
            className="bg-darker border border-gray-700 rounded-lg px-4 py-3 text-white focus:ring-2 focus:ring-primary focus:border-transparent outline-none transition-all"
          />
        </div>
        <div className="flex justify-between items-center mt-3">
          <p className="text-xs text-gray-500">
            {cooldown > 0
              ? ""
              : "Search for a specific business by name - no other details needed"}
          </p>
          <button
            type="submit"
            disabled={
              isDisabled || !quickBusinessName.trim() || !quickLocation.trim()
            }
            className="bg-primary hover:bg-blue-600 text-white px-6 py-3 rounded-lg font-semibold flex items-center gap-2 transition-all disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap"
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
                Search
              </>
            )}
          </button>
        </div>
      </form>


      {/* Divider */}
      <div className="flex items-center gap-4">
        <div className="flex-1 border-t border-gray-800"></div>
        <span className="text-sm text-gray-500">
          or search by business type
        </span>
        <div className="flex-1 border-t border-gray-800"></div>
      </div>

      {/* Advanced Search Form */}
      <form
        onSubmit={handleSubmit}
        className="bg-dark p-8 rounded-2xl shadow-2xl border border-gray-800"
      >
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="space-y-2">
            <label className="text-sm font-medium text-gray-400">
              Business Type
            </label>
            <input
              type="text"
              placeholder="e.g. Restaurant, Hospital, Auto Dealer"
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
              placeholder="e.g. Delhi, Mumbai, Karnataka, India"
              className="w-full bg-darker border border-gray-700 rounded-lg px-4 py-3 text-white focus:ring-2 focus:ring-primary focus:border-transparent outline-none transition-all"
              value={formData.location}
              onChange={(e) =>
                setFormData({ ...formData, location: e.target.value })
              }
              required
            />
            <p className="text-xs text-gray-500 mt-1">
              City, State, or Country
            </p>
          </div>
          <div className="space-y-2 md:col-span-2">
            <label className="text-sm font-medium text-gray-400">
              Number of Leads
            </label>
            <select
              className="w-full bg-darker border border-gray-700 rounded-lg px-4 py-3 text-white focus:ring-2 focus:ring-primary focus:border-transparent outline-none transition-all"
              value={formData.leadPreset}
              onChange={(e) =>
                setFormData({ ...formData, leadPreset: e.target.value })
              }
              required
            >
              <option value="few">Few Leads</option>
              <option value="normal">Normal Leads</option>
              <option value="high">High Leads</option>
            </select>
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
                Find Businesses
              </>
            )}
          </button>
        </div>
      </form>
    </div>
  );
};

export default BusinessSearchForm;
