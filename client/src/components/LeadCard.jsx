import React from "react";
import { ExternalLink, User, MapPin, Briefcase, Building2 } from "lucide-react";
import { motion } from "framer-motion";

const LeadCard = ({ lead, index }) => {
  const [profilePicSrc, setProfilePicSrc] = React.useState(lead.profilePic);
  const [showFallback, setShowFallback] = React.useState(!lead.profilePic);

  const handleImageError = () => {
    // Show user icon fallback
    setShowFallback(true);
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.1 }}
      className="bg-dark border border-gray-800 rounded-xl p-6 hover:border-primary/50 transition-all group"
    >
      <div className="flex justify-between items-start mb-4">
        <div className="flex items-start gap-4 flex-1 min-w-0">
          {!showFallback && profilePicSrc ? (
            <img
              src={profilePicSrc}
              alt={lead.personName}
              className="w-12 h-12 rounded-full object-cover flex-shrink-0 bg-white/5"
              onError={handleImageError}
            />
          ) : (
            <div className="w-12 h-12 bg-gray-800 rounded-full flex items-center justify-center text-primary group-hover:bg-primary/10 transition-colors flex-shrink-0">
              <User className="w-6 h-6" />
            </div>
          )}
          <div className="flex-1 min-w-0">
            <h3 className="text-lg font-semibold text-white group-hover:text-primary transition-colors truncate">
              {lead.personName}
            </h3>
            {lead.jobTitle && (
              <p className="text-gray-400 text-sm flex items-center gap-1 mt-1">
                <Briefcase className="w-3 h-3 flex-shrink-0" />
                <span className="truncate">{lead.jobTitle}</span>
              </p>
            )}
            {lead.company && (
              <p className="text-gray-500 text-xs flex items-center gap-1 mt-1">
                <Building2 className="w-3 h-3 flex-shrink-0" />
                <span className="truncate">{lead.company}</span>
              </p>
            )}
          </div>
        </div>
        <a
          href={lead.profileLink}
          target="_blank"
          rel="noopener noreferrer"
          className="text-gray-500 hover:text-white transition-colors flex-shrink-0 ml-2"
          title="View LinkedIn profile"
        >
          <ExternalLink className="w-5 h-5" />
        </a>
      </div>

      <p className="text-gray-400 text-sm line-clamp-3 mb-4">{lead.snippet}</p>

      <div className="flex flex-wrap gap-3 text-xs text-gray-500">
        {lead.location && lead.location.trim() && (
          <div className="flex items-center gap-1">
            <MapPin className="w-3 h-3 flex-shrink-0" />
            <span className="truncate max-w-[200px]" title={lead.location}>
              {lead.location}
            </span>
          </div>
        )}
      </div>
    </motion.div>
  );
};

export default LeadCard;
