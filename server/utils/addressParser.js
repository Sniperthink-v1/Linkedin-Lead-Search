const axios = require('axios');

/**
 * Indian States - for validation and matching
 */
const INDIAN_STATES = [
  'Andhra Pradesh', 'Arunachal Pradesh', 'Assam', 'Bihar', 'Chhattisgarh',
  'Goa', 'Gujarat', 'Haryana', 'Himachal Pradesh', 'Jharkhand', 'Karnataka',
  'Kerala', 'Madhya Pradesh', 'Maharashtra', 'Manipur', 'Meghalaya', 'Mizoram',
  'Nagaland', 'Odisha', 'Punjab', 'Rajasthan', 'Sikkim', 'Tamil Nadu',
  'Telangana', 'Tripura', 'Uttar Pradesh', 'Uttarakhand', 'West Bengal',
  'Delhi', 'Puducherry', 'Jammu and Kashmir', 'Ladakh',
  // Common abbreviations
  'UP', 'HP', 'MP', 'AP', 'TN', 'WB', 'UK'
];

/**
 * State name variations and mappings
 */
const STATE_MAPPINGS = {
  'UP': 'Uttar Pradesh',
  'HP': 'Himachal Pradesh',
  'MP': 'Madhya Pradesh',
  'AP': 'Andhra Pradesh',
  'TN': 'Tamil Nadu',
  'WB': 'West Bengal',
  'UK': 'Uttarakhand',
  'Delhi NCR': 'Delhi',
  'NCR': 'Delhi'
};

/**
 * Common country names (can be expanded)
 */
const COMMON_COUNTRIES = [
  'India', 'United States', 'USA', 'United Kingdom', 'UK', 'Canada',
  'Australia', 'Singapore', 'UAE', 'United Arab Emirates', 'Germany',
  'France', 'Japan', 'China', 'Pakistan', 'Bangladesh', 'Sri Lanka',
  'Nepal', 'Bhutan', 'Malaysia', 'Indonesia', 'Thailand', 'Vietnam'
];

/**
 * Extract Indian pincode from text
 * @param {string} text - Text containing potential pincode
 * @returns {string|null} - Extracted pincode or null
 */
function extractPincode(text) {
  if (!text) return null;
  
  // Indian pincodes are 6 digits
  const pincodeMatch = text.match(/\b\d{6}\b/);
  return pincodeMatch ? pincodeMatch[0] : null;
}

/**
 * Fetch location data from India Post API
 * @param {string} pincode - 6-digit Indian pincode
 * @returns {Promise<Object>} - Location data {city, district, state, country}
 */
async function fetchLocationFromPincode(pincode) {
  try {
    const response = await axios.get(`https://api.postalpincode.in/pincode/${pincode}`, {
      timeout: 5000 // 5 second timeout
    });
    
    if (response.data && response.data[0] && response.data[0].Status === 'Success') {
      const postOffice = response.data[0].PostOffice[0];
      return {
        city: postOffice.District || postOffice.Block || postOffice.Name,
        district: postOffice.District,
        state: postOffice.State,
        country: postOffice.Country || 'India',
        pincode: pincode
      };
    }
    
    return null;
  } catch (error) {
    console.error('Error fetching pincode data:', error.message);
    return null;
  }
}

/**
 * Normalize state name
 * @param {string} state - State name
 * @returns {string} - Normalized state name
 */
function normalizeState(state) {
  if (!state) return state;
  
  const trimmed = state.trim();
  
  // Check if it's an abbreviation
  if (STATE_MAPPINGS[trimmed.toUpperCase()]) {
    return STATE_MAPPINGS[trimmed.toUpperCase()];
  }
  
  // Check if it matches a known state (case-insensitive)
  const upperState = trimmed.toUpperCase();
  const matchedState = INDIAN_STATES.find(s => s.toUpperCase() === upperState);
  
  return matchedState || trimmed;
}

/**
 * Check if a string is a valid Indian state
 * @param {string} str - String to check
 * @returns {boolean}
 */
function isIndianState(str) {
  if (!str) return false;
  
  const upper = str.trim().toUpperCase();
  return INDIAN_STATES.some(state => state.toUpperCase() === upper) || 
         STATE_MAPPINGS.hasOwnProperty(upper);
}

/**
 * Check if a string is a valid country
 * @param {string} str - String to check
 * @returns {boolean}
 */
function isCountry(str) {
  if (!str) return false;
  
  const upper = str.trim().toUpperCase();
  return COMMON_COUNTRIES.some(country => country.toUpperCase() === upper);
}

/**
 * Parse address string into structured location components
 * @param {string} addressStr - Address string to parse
 * @param {boolean} useAPI - Whether to use India Post API for pincode lookup (default: true)
 * @returns {Promise<Object>} - Parsed location {city, state, country, pincode}
 */
async function parseAddress(addressStr, useAPI = true) {
  if (!addressStr || addressStr === '-') {
    return { city: null, state: null, country: null, pincode: null };
  }
  
  let result = {
    city: null,
    state: null,
    country: null,
    pincode: null
  };
  
  // Extract pincode first
  const pincode = extractPincode(addressStr);
  
  // If pincode found and API enabled, fetch from India Post
  if (pincode && useAPI) {
    const apiData = await fetchLocationFromPincode(pincode);
    if (apiData) {
      return {
        city: apiData.city,
        state: normalizeState(apiData.state),
        country: apiData.country,
        pincode: pincode
      };
    }
  }
  
  // Fallback: Parse manually
  result.pincode = pincode;
  
  // Remove pincode from address for cleaner parsing
  let cleanAddress = addressStr;
  if (pincode) {
    cleanAddress = cleanAddress.replace(pincode, '').trim();
  }
  
  // Split by comma
  const parts = cleanAddress.split(',').map(p => p.trim()).filter(p => p.length > 0);
  
  if (parts.length === 0) {
    return result;
  }
  
  // Try to identify country (usually last part)
  if (parts.length > 0) {
    const lastPart = parts[parts.length - 1];
    if (isCountry(lastPart)) {
      result.country = lastPart;
      parts.pop();
    } else {
      // Default to India if no country found and pincode is Indian
      if (pincode) {
        result.country = 'India';
      }
    }
  }
  
  // Try to identify state (usually second to last, or last if no country)
  if (parts.length > 0) {
    const potentialState = parts[parts.length - 1];
    
    // Check if it looks like a state (might have pincode with it)
    const stateWithoutPin = potentialState.replace(/\s*\d{6}\s*/, '').trim();
    
    if (isIndianState(stateWithoutPin)) {
      result.state = normalizeState(stateWithoutPin);
      parts.pop();
    } else if (isIndianState(potentialState)) {
      result.state = normalizeState(potentialState);
      parts.pop();
    }
  }
  
  // Try to identify city (usually third from last, or what's left)
  if (parts.length > 0) {
    // City is often the second or third to last meaningful part
    // Take the last remaining part as city
    result.city = parts[parts.length - 1];
    
    // Clean up city name (remove common prefixes/suffixes)
    result.city = result.city
      .replace(/^(near|opp|opposite|behind|beside)\s+/i, '')
      .trim();
  }
  
  return result;
}

/**
 * Parse location string (for people leads - simpler format)
 * @param {string} locationStr - Location string (e.g., "New York, USA")
 * @returns {Object} - Parsed location {city, state, country}
 */
function parseSimpleLocation(locationStr) {
  if (!locationStr || locationStr === '-') {
    return { city: null, state: null, country: null };
  }
  
  const parts = locationStr.split(',').map(p => p.trim()).filter(p => p.length > 0);
  
  let result = {
    city: null,
    state: null,
    country: null
  };
  
  if (parts.length === 1) {
    result.city = parts[0];
  } else if (parts.length === 2) {
    result.city = parts[0];
    // Could be city, state or city, country
    if (isIndianState(parts[1])) {
      result.state = normalizeState(parts[1]);
      result.country = 'India';
    } else {
      result.country = parts[1];
    }
  } else if (parts.length >= 3) {
    result.city = parts[0];
    result.state = normalizeState(parts[1]);
    result.country = parts[2];
  }
  
  return result;
}

module.exports = {
  parseAddress,
  parseSimpleLocation,
  extractPincode,
  fetchLocationFromPincode,
  normalizeState,
  isIndianState,
  isCountry
};
