/**
 * Lead Identifier Utility
 * Generates unique identifiers for leads to prevent duplicates
 */

/**
 * Generate a unique identifier for a LinkedIn people lead
 * @param {Object} lead - The lead object
 * @param {string} lead.personName - Person's name
 * @param {string} lead.company - Company name
 * @param {string} lead.profileLink - LinkedIn profile URL
 * @returns {string} Unique identifier
 */
function generatePeopleLeadIdentifier(lead) {
  const name = (lead.personName || "").toLowerCase().trim();
  const company = (lead.company || "").toLowerCase().trim();
  
  // Extract LinkedIn username from profile link for better uniqueness
  let linkedinId = "";
  if (lead.profileLink) {
    const match = lead.profileLink.match(/linkedin\.com\/in\/([^/?]+)/);
    if (match) {
      linkedinId = match[1];
    }
  }
  
  // Use LinkedIn ID as primary identifier, fallback to name + company
  if (linkedinId) {
    return `people:${linkedinId}`;
  }
  
  return `people:${name}:${company}`;
}

/**
 * Generate a unique identifier for a business lead
 * @param {Object} lead - The lead object
 * @param {string} lead.name - Business name
 * @param {string} lead.location - Location (city)
 * @param {string} lead.phone - Phone number
 * @param {string} lead.email - Email address
 * @param {string} lead.address - Full address
 * @returns {string} Unique identifier
 */
function generateBusinessLeadIdentifier(lead) {
  const businessName = (lead.name || "").toLowerCase().trim();
  
  // Extract city from location or address
  let city = "";
  if (lead.location) {
    // location is already city-level (e.g., "Bengaluru, Karnataka, India")
    city = lead.location.split(",")[0].toLowerCase().trim();
  } else if (lead.address) {
    // Extract city from address
    const addressParts = lead.address.split(",");
    if (addressParts.length >= 2) {
      city = addressParts[addressParts.length - 3]?.toLowerCase().trim() || "";
    }
  }
  
  // Use phone or email as additional identifier
  const phone = (lead.phone || "").replace(/[^0-9]/g, ""); // Remove non-digits
  const email = (lead.email || "").toLowerCase().trim();
  
  // Create composite identifier
  // Priority: name + city + phone, fallback to name + city + email, fallback to name + city
  if (phone && phone !== "-" && phone.length > 5) {
    return `business:${businessName}:${city}:${phone}`;
  } else if (email && email !== "-" && email.includes("@")) {
    return `business:${businessName}:${city}:${email}`;
  }
  
  return `business:${businessName}:${city}`;
}

/**
 * Check and filter out duplicate leads for a user
 * @param {string} userId - User ID
 * @param {Array} leads - Array of lead objects
 * @param {string} leadType - Type of leads ("people" or "business")
 * @param {Object} prisma - Prisma client instance
 * @returns {Promise<Array>} Filtered array of unique leads
 */
async function filterDuplicateLeads(userId, leads, leadType, prisma) {
  if (!leads || leads.length === 0) {
    return [];
  }
  
  console.log(`\n[Deduplication] Checking ${leads.length} ${leadType} leads for user ${userId}...`);
  
  // Generate identifiers for all leads
  const leadIdentifiers = leads.map((lead) => {
    if (leadType === "people") {
      return generatePeopleLeadIdentifier(lead);
    } else {
      return generateBusinessLeadIdentifier(lead);
    }
  });
  
  console.log(`[Deduplication] Generated ${leadIdentifiers.length} identifiers`);
  
  // Single batch query to check existing leads
  const existingLeads = await prisma.userLeadHistory.findMany({
    where: {
      userId: userId,
      leadIdentifier: {
        in: leadIdentifiers,
      },
    },
    select: {
      leadIdentifier: true,
    },
  });
  
  const existingIdentifiers = new Set(
    existingLeads.map((l) => l.leadIdentifier)
  );
  
  console.log(`[Deduplication] Found ${existingIdentifiers.size} existing leads in history`);
  
  // Filter out duplicates
  const uniqueLeads = leads.filter((lead, index) => {
    const identifier = leadIdentifiers[index];
    return !existingIdentifiers.has(identifier);
  });
  
  console.log(`[Deduplication] Filtered to ${uniqueLeads.length} unique leads`);
  
  return uniqueLeads;
}

/**
 * Save lead identifiers to history (async, non-blocking)
 * @param {string} userId - User ID
 * @param {Array} leads - Array of lead objects
 * @param {string} leadType - Type of leads ("people" or "business")
 * @param {string} searchQuery - Normalized search query
 * @param {Object} prisma - Prisma client instance
 */
async function saveLeadsToHistory(userId, leads, leadType, searchQuery, prisma) {
  if (!leads || leads.length === 0) {
    return;
  }
  
  try {
    console.log(`[Deduplication] Saving ${leads.length} leads to history...`);
    
    // Generate identifiers
    const leadIdentifiers = leads.map((lead) => {
      if (leadType === "people") {
        return generatePeopleLeadIdentifier(lead);
      } else {
        return generateBusinessLeadIdentifier(lead);
      }
    });
    
    // Prepare data for batch insert
    const historyRecords = leadIdentifiers.map((identifier) => ({
      userId: userId,
      leadIdentifier: identifier,
      searchQuery: searchQuery || "",
      leadType: leadType,
    }));
    
    // Batch insert with skipDuplicates to handle race conditions
    const result = await prisma.userLeadHistory.createMany({
      data: historyRecords,
      skipDuplicates: true,
    });
    
    console.log(`[Deduplication] Successfully saved ${result.count} new leads to history`);
  } catch (error) {
    // Don't fail the request if history save fails
    console.error("[Deduplication] Error saving leads to history:", error.message);
  }
}

module.exports = {
  generatePeopleLeadIdentifier,
  generateBusinessLeadIdentifier,
  filterDuplicateLeads,
  saveLeadsToHistory,
};
