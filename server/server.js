const express = require("express");
const cors = require("cors");
const axios = require("axios");
const { GoogleGenerativeAI } = require("@google/generative-ai");
const cookieParser = require("cookie-parser");
require("dotenv").config();

const app = express();
const PORT = process.env.PORT || 3000;

// Simple in-memory cache for Gemini responses
const geminiCache = new Map();
const CACHE_TTL = 60 * 60 * 1000; // 1 hour (reduced from 24 hours for fresher data)
const MAX_CACHE_SIZE = 500; // Increased from 100

// Helper function to get cached or fetch from Gemini
async function getCachedGeminiResponse(cacheKey, geminiFunction) {
  // Check cache first
  const cached = geminiCache.get(cacheKey);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
    console.log(`✅ Cache HIT for: ${cacheKey.substring(0, 50)}...`);
    console.log(
      `📊 Cache Stats: ${geminiCache.size}/${MAX_CACHE_SIZE} entries`
    );
    return cached.data;
  }

  console.log(`❌ Cache MISS for: ${cacheKey.substring(0, 50)}...`);

  // Fetch from Gemini with retry logic
  let lastError;
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      console.log(`🔄 Gemini API attempt ${attempt}/3...`);
      const result = await geminiFunction();

      // Cache the successful result
      geminiCache.set(cacheKey, {
        data: result,
        timestamp: Date.now(),
      });

      console.log(`💾 Cached response for: ${cacheKey.substring(0, 50)}...`);

      // Clean old cache entries if exceeds max size
      if (geminiCache.size > MAX_CACHE_SIZE) {
        // Remove oldest 20% of entries
        const entriesToRemove = Math.floor(MAX_CACHE_SIZE * 0.2);
        const sortedEntries = Array.from(geminiCache.entries()).sort(
          (a, b) => a[1].timestamp - b[1].timestamp
        );

        for (let i = 0; i < entriesToRemove; i++) {
          geminiCache.delete(sortedEntries[i][0]);
        }
        console.log(`🧹 Cleaned ${entriesToRemove} old cache entries`);
      }

      return result;
    } catch (error) {
      lastError = error;
      console.error(`❌ Attempt ${attempt} failed:`, error.message);

      if (attempt < 3) {
        const delay = attempt * 3000; // 3s, 6s
        console.log(`⏳ Waiting ${delay}ms before retry...`);
        await new Promise((resolve) => setTimeout(resolve, delay));
      }
    }
  }

  throw lastError;
}

// CORS configuration - Allow both production and local development
const allowedOrigins = [
  process.env.FRONTEND_URL,
  "http://localhost:5173",
  "http://localhost:5174",
  "https://linkedin-lead-search.vercel.app",
].filter(Boolean); // Remove undefined values

app.use(
  cors({
    credentials: true,
    origin: (origin, callback) => {
      // Allow requests with no origin (like mobile apps or curl requests)
      if (!origin) return callback(null, true);

      if (allowedOrigins.includes(origin)) {
        callback(null, true);
      } else {
        console.warn(`🚫 Blocked CORS request from origin: ${origin}`);
        callback(new Error("Not allowed by CORS"));
      }
    },
  })
);
app.use(express.json());
app.use(cookieParser());

const SERPER_API_KEY = process.env.SERPER_API_KEY;
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;

// Import middleware
const { authenticateToken } = require("./middleware/auth");
const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

// Import auth routes
const authRoutes = require("./routes/auth");
app.use("/api/auth", authRoutes);

// Import leads routes
const leadsRoutes = require("./routes/leads");
app.use("/api/leads", leadsRoutes);

// Basic health check
app.get("/", (req, res) => {
  res.json({
    status: "running",
    message: "LinkedIn Lead Search API (Hybrid: Gemini + Serper)",
    endpoints: [
      "POST /api/auth/signup - Register new user",
      "POST /api/auth/login - Login user",
      "GET /api/auth/verify-email - Verify email",
      "GET /api/auth/me - Get current user",
      "GET /api/leads - LinkedIn people search",
      "GET /api/business-leads - Business search",
    ],
  });
});

// LinkedIn People Search Endpoint (Hybrid: Gemini AI + Serper API)
app.get("/api/search/people", authenticateToken, async (req, res) => {
  const { businessType, location, industry } = req.query;

  if (!businessType || !location) {
    return res
      .status(400)
      .json({ error: "Business Type and Location are required" });
  }

  console.log("\n=== LinkedIn Search (Gemini + Serper Hybrid) ===");
  console.log("Business Type:", businessType);
  console.log("Location:", location);
  console.log("Industry:", industry || "N/A");
  console.log("User ID:", req.user?.id);

  let searchRecord = null;

  try {
    // Set headers for Server-Sent Events (SSE)
    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "keep-alive");

    // Helper function to send progressive updates
    const sendUpdate = (data) => {
      res.write(`data: ${JSON.stringify(data)}\n\n`);
    };

    if (!GEMINI_API_KEY) {
      throw new Error("GEMINI_API_KEY not configured");
    }
    if (!SERPER_API_KEY) {
      throw new Error("SERPER_API_KEY not configured");
    }

    // Step 1: Use Gemini AI to find names and roles
    console.log("\n[Step 1] Querying Gemini AI for LinkedIn profiles...");

    const genAI = new GoogleGenerativeAI(GEMINI_API_KEY);

    // Use gemini-2.5-flash (latest stable model)
    let model;
    let modelName = "gemini-2.5-flash";

    model = genAI.getGenerativeModel({ model: modelName });

    console.log(`Using model: ${modelName}`);

    const industryText = industry ? ` in ${industry} industry` : "";

    // Extract core keywords from business type for strict matching
    const coreKeywords = businessType
      .split(/[\s,\/]+/)
      .filter((k) => k.length > 2)
      .map((k) => k.toLowerCase());
    const keywordList = coreKeywords.join('", "');

    const geminiPrompt = `You MUST return ONLY valid JSON. No explanations, no markdown, no text - ONLY a JSON array.

Find 100 professionals whose CURRENT job title matches: "${businessType}"${industryText} in "${location}".

JOB TITLE RULES - Core Keywords Required: [${keywordList}]

✅ INCLUDE if title contains at least 2 keywords from [${keywordList}]:
- "${businessType}"
- "Senior ${businessType}"
- "Lead ${businessType}"  
- "Staff ${businessType}"
- "Principal ${businessType}"

❌ EXCLUDE ALL:
- Different roles (Data Scientist, Software Engineer, Product Manager)
- Generic titles (Manager, Director, VP) without [${keywordList}]
- Adjacent roles (if "ML Engineer", exclude "Data Engineer", "Software Engineer")
- Students/Interns (unless title has all keywords)
- Founders/CEOs (unless title has all keywords)

LOCATION: Only people currently in ${location}

OUTPUT FORMAT - Return EXACTLY this JSON structure with 100 profiles:
[
  {"name": "Full Name", "role": "Job Title"},
  {"name": "Full Name", "role": "Job Title"}
]

Sort by: Principal/Staff → Senior/Lead → Mid-level → Junior

CRITICAL: Response MUST be valid JSON array. No text before or after. Start with [ and end with ]`;

    sendUpdate({
      type: "progress",
      leads: [],
      total: 0,
      page: 0,
      message: "Searching with Gemini AI...",
    });

    // Create cache key from search parameters
    const cacheKey = `people:${businessType}:${location}:${industry || "all"}`;

    // Use cached response or fetch from Gemini
    const geminiResult = await getCachedGeminiResponse(cacheKey, async () => {
      return await model.generateContent(geminiPrompt);
    });

    const geminiResponse = await geminiResult.response;
    let geminiText = geminiResponse.text().trim();

    console.log("Gemini AI Response received");
    console.log("First 200 characters:", geminiText.substring(0, 200));

    // Remove markdown code blocks if present
    if (geminiText.startsWith("```json")) {
      geminiText = geminiText.replace(/^```json\n/, "").replace(/\n```$/, "");
    } else if (geminiText.startsWith("```")) {
      geminiText = geminiText.replace(/^```\n/, "").replace(/\n```$/, "");
    }

    // Extract JSON if there's text before/after
    const jsonMatch = geminiText.match(/\[[\s\S]*\]/);
    if (jsonMatch) {
      geminiText = jsonMatch[0];
    }

    // Validate it looks like JSON before parsing
    if (!geminiText.trim().startsWith("[")) {
      throw new Error(
        `Gemini returned non-JSON response. First 100 chars: ${geminiText.substring(
          0,
          100
        )}`
      );
    }

    // Parse Gemini response
    const basicProfiles = JSON.parse(geminiText);

    if (!Array.isArray(basicProfiles) || basicProfiles.length === 0) {
      throw new Error("Gemini returned empty or invalid array");
    }

    console.log(`Parsed ${basicProfiles.length} profiles from Gemini`);

    // Filter profiles to ensure role relevance (require at least 2 core keywords)
    const filteredProfiles = basicProfiles.filter((profile) => {
      const role = profile.role.toLowerCase();
      const searchTerms = businessType
        .toLowerCase()
        .split(/[\s,\/]+/)
        .filter((t) => t.length > 2);

      // Count how many core keywords are present in the role
      const keywordMatches = searchTerms.filter((term) =>
        role.includes(term)
      ).length;

      // Require at least 2 keywords to match (or all keywords if searching for single keyword)
      const minRequired =
        searchTerms.length === 1 ? 1 : Math.min(2, searchTerms.length);
      const isRelevant = keywordMatches >= minRequired;

      if (!isRelevant) {
        console.log(
          `⚠️ Filtered out irrelevant role: ${profile.name} - ${profile.role} (only ${keywordMatches}/${searchTerms.length} keywords matched)`
        );
      }

      return isRelevant;
    });

    console.log(`Filtered to ${filteredProfiles.length} relevant profiles`);

    // Step 2: Enrich each profile with Serper API
    console.log("\n[Step 2] Enriching with Serper API...");

    const enrichedLeads = [];

    for (let i = 0; i < filteredProfiles.length; i++) {
      const basicProfile = filteredProfiles[i];
      console.log(
        `\nProcessing ${i + 1}/${filteredProfiles.length}: ${basicProfile.name}`
      );

      try {
        // Single search query to find LinkedIn profile
        const roleKeywords = businessType
          .split(/[\s,\/]+/)
          .filter((k) => k.length > 2)
          .join(" ");

        const serperResponse = await axios.post(
          "https://google.serper.dev/search",
          {
            q: `site:linkedin.com/in/ "${basicProfile.name}" "${roleKeywords}" "${location}"`,
            num: 3,
          },
          {
            headers: {
              "X-API-KEY": SERPER_API_KEY,
              "Content-Type": "application/json",
            },
          }
        );

        const results = serperResponse.data.organic || [];

        if (results.length > 0) {
          const result = results[0];

          // Extract job title from LinkedIn title
          let extractedJobTitle = "";
          const titleParts = result.title.split(/\s*[-–]\s*/);
          if (titleParts.length >= 2) {
            extractedJobTitle = titleParts[1]
              .replace(/\s*\|\s*LinkedIn.*$/i, "")
              .replace(/\s+at\s+.*$/i, "")
              .trim();
          }

          // Extract company from title
          let company = "";
          if (titleParts.length >= 3) {
            company = titleParts[2].replace(/\s*\|\s*LinkedIn.*$/i, "").trim();
          }

          // Extract location from snippet
          let personLocation = "";
          const locationPatterns = [
            /(?:Location|Based in)[:\s]+([^·•\n.]+?)(?:\s*[·•.]|$)/i,
            /\b([A-Z][a-z]+(?:\s+[A-Z][a-z]+)?),\s*India\b/,
          ];

          for (const pattern of locationPatterns) {
            const match = result.snippet?.match(pattern);
            if (match) {
              personLocation = match[1]
                ?.trim()
                .replace(/[·•]/g, "")
                .replace(/\s+/g, " ")
                .trim();
              break;
            }
          }

          // VALIDATION: Cross-check job title and location
          const searchTerms = businessType
            .toLowerCase()
            .split(/[\s,\/]+/)
            .filter((t) => t.length > 2);
          const titleToCheck = extractedJobTitle.toLowerCase();
          const locationToCheck = personLocation.toLowerCase();
          const requestedLocation = location.toLowerCase();

          // Check if extracted job title matches search terms (require at least 2 keywords or all if single)
          const keywordMatchCount = searchTerms.filter((term) =>
            titleToCheck.includes(term)
          ).length;
          const minRequired =
            searchTerms.length === 1 ? 1 : Math.min(2, searchTerms.length);
          const titleMatches = keywordMatchCount >= minRequired;

          // Check if location matches (flexible matching with city-to-state mapping)
          const cityToState = {
            // Major Indian cities
            bengaluru: "karnataka",
            bangalore: "karnataka",
            mumbai: "maharashtra",
            bombay: "maharashtra",
            pune: "maharashtra",
            nagpur: "maharashtra",
            delhi: "delhi",
            "new delhi": "delhi",
            gurgaon: "haryana",
            gurugram: "haryana",
            noida: "uttar pradesh",
            hyderabad: "telangana",
            chennai: "tamil nadu",
            madras: "tamil nadu",
            coimbatore: "tamil nadu",
            kolkata: "west bengal",
            calcutta: "west bengal",
            ahmedabad: "gujarat",
            surat: "gujarat",
            vadodara: "gujarat",
            jaipur: "rajasthan",
            kota: "rajasthan",
            lucknow: "uttar pradesh",
            kanpur: "uttar pradesh",
            agra: "uttar pradesh",
            chandigarh: "chandigarh",
            mohali: "punjab",
            panchkula: "haryana",
            kochi: "kerala",
            cochin: "kerala",
            thiruvananthapuram: "kerala",
            trivandrum: "kerala",
            indore: "madhya pradesh",
            bhopal: "madhya pradesh",
            visakhapatnam: "andhra pradesh",
            vijayawada: "andhra pradesh",
            patna: "bihar",
            bhubaneswar: "odisha",
            guwahati: "assam",
            ranchi: "jharkhand",
            raipur: "chhattisgarh",
          };

          const locationWords = requestedLocation.split(/[\s,]+/);
          const requestedState =
            cityToState[requestedLocation] || requestedLocation;

          const locationMatches =
            !personLocation ||
            locationWords.some((word) => locationToCheck.includes(word)) ||
            locationToCheck.includes(requestedLocation) ||
            (requestedState !== requestedLocation &&
              locationToCheck.includes(requestedState));

          if (!titleMatches) {
            console.log(
              `⚠️ REJECTED: Job title mismatch - "${extractedJobTitle}" has only ${keywordMatchCount}/${searchTerms.length} keywords from "${businessType}" for ${basicProfile.name}`
            );
            continue; // Skip this profile
          }

          if (!locationMatches && personLocation) {
            console.log(
              `⚠️ REJECTED: Location mismatch - "${personLocation}" doesn't match "${location}" for ${basicProfile.name}`
            );
            continue; // Skip this profile
          }

          console.log(
            `✅ VALIDATED: ${basicProfile.name} - ${extractedJobTitle} in ${
              personLocation || location
            }`
          );

          const enrichedLead = {
            personName: basicProfile.name,
            jobTitle: extractedJobTitle || basicProfile.role,
            company: company || "",
            location: personLocation || location,
            profileLink: result.link,
            snippet: result.snippet || "No description available",
            profilePic: `https://ui-avatars.com/api/?name=${encodeURIComponent(
              basicProfile.name
            )}&background=0D8ABC&color=fff&size=128`,
            title: result.title,
          };

          enrichedLeads.push(enrichedLead);

          // Send progressive update
          sendUpdate({
            type: "progress",
            leads: enrichedLeads,
            total: enrichedLeads.length,
            page: i + 1,
            message: `Found ${i + 1}/${basicProfiles.length} profiles...`,
          });

          console.log(`✅ Enriched lead ${i + 1}/${basicProfiles.length}`);
        } else {
          console.log(
            `❌ No Serper results for ${basicProfile.name}, skipping...`
          );
          // Skip profiles without LinkedIn links - non-negotiable requirement
          continue;
        }

        // Delay to respect rate limits
        await new Promise((resolve) => setTimeout(resolve, 500));
      } catch (serperError) {
        console.error(
          `Serper API error for ${basicProfile.name}:`,
          serperError.message
        );
        // Skip profiles with errors - no LinkedIn link means skip
        continue;
      }
    }

    console.log(`\n=== LinkedIn Search Complete ===`);
    console.log(`Total leads: ${enrichedLeads.length}`);

    // Save search to database if user is authenticated
    if (req.user?.id) {
      try {
        searchRecord = await prisma.search.create({
          data: {
            userId: req.user.id,
            searchType: "people",
            businessType,
            location,
            industry: industry || "",
            resultCount: enrichedLeads.length,
          },
        });
        console.log(`✅ Search saved to history: ${searchRecord.id}`);
      } catch (dbError) {
        console.error("Failed to save search:", dbError);
        // Don't fail the request if DB save fails
      }
    }

    // Send final complete results
    sendUpdate({
      type: "complete",
      leads: enrichedLeads,
      total: enrichedLeads.length,
      searchId: searchRecord?.id,
    });

    res.end();
  } catch (error) {
    console.error("Error fetching LinkedIn leads:");
    console.error("Error message:", error.message);
    console.error("Error stack:", error.stack);

    let errorMessage = "Failed to fetch LinkedIn leads";
    if (error.message.includes("API key")) {
      errorMessage = "API key not configured";
    } else if (error.message.includes("quota")) {
      errorMessage = "API quota exceeded";
    } else if (error.message.includes("JSON")) {
      errorMessage = "AI returned invalid format. Please try again.";
    }

    res.write(
      `data: ${JSON.stringify({
        type: "error",
        error: errorMessage,
        details: error.message,
      })}\n\n`
    );
    res.end();
  }
});

// Business Search Endpoint (Hybrid: Gemini AI + Serper API)
app.get("/api/search/business", authenticateToken, async (req, res) => {
  const { businessType, location, leadCount } = req.query;

  if (!businessType || !location) {
    return res
      .status(400)
      .json({ error: "Business Type and Location are required" });
  }

  // Validate and cap leadCount
  const requestedLeads = Math.min(50, Math.max(1, parseInt(leadCount) || 20));

  console.log("\n=== Business Search (Gemini + Serper Hybrid) ===");
  console.log("Business Type:", businessType);
  console.log("Location:", location);
  console.log("Lead Count:", requestedLeads);
  console.log("User ID:", req.user?.id);

  let searchRecord = null;
  console.log("Location:", location);

  // Set headers for Server-Sent Events (SSE)
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");

  // Helper function to send progressive updates
  const sendUpdate = (data) => {
    res.write(`data: ${JSON.stringify(data)}\n\n`);
  };

  try {
    if (!GEMINI_API_KEY) {
      throw new Error("GEMINI_API_KEY not configured in environment variables");
    }
    if (!SERPER_API_KEY) {
      throw new Error("SERPER_API_KEY not configured in environment variables");
    }

    // Step 1: Use Gemini AI to find basic business info
    console.log("\n[Step 1] Querying Gemini AI for basic business info...");

    const genAI = new GoogleGenerativeAI(GEMINI_API_KEY);

    // Use gemini-2.5-flash (latest stable model)
    let model;
    let modelName = "gemini-2.5-flash";

    model = genAI.getGenerativeModel({ model: modelName });

    console.log(`Using model: ${modelName}`);

    const geminiPrompt = `Return ONLY valid JSON. No text, no explanations - ONLY a JSON array.

Find EXACTLY ${requestedLeads} businesses for "${businessType}" in "${location}".

REQUIREMENTS:
1. Return STRICTLY ${requestedLeads} results - no more, no less
2. Sort by quality (HIGHEST to LOWEST): established → good reputation → complete info
3. Real businesses only from ${location}
4. Include complete address with area/locality
5. If available, include the date/time of their most recent review
6. If available, include the owner's name or founder's name

OUTPUT FORMAT - Return EXACTLY this JSON:
[
  {
    "name": "Business Name",
    "address": "Complete address with area, ${location}",
    "phone": "+91-XXXXXXXXXX or N/A",
    "email": "email@example.com or N/A",
    "ownerName": "Owner/Founder full name or N/A",
    "lastReview": "Recent review date/time (e.g., '2 days ago', '1 week ago', '3 months ago') or N/A"
  }
]

CRITICAL: Valid JSON array only. Start with [ and end with ]. No markdown, no text before/after.`;

    sendUpdate({
      type: "progress",
      leads: [],
      total: 0,
      page: 0,
      message: "Searching with Gemini AI...",
    });

    // Create cache key from search parameters
    const cacheKey = `business:${businessType}:${location}:${requestedLeads}`;

    // Use cached response or fetch from Gemini
    const geminiResult = await getCachedGeminiResponse(cacheKey, async () => {
      return await model.generateContent(geminiPrompt);
    });

    const geminiResponse = await geminiResult.response;
    let geminiText = geminiResponse.text().trim();

    console.log("Gemini AI Response received");
    console.log("First 200 characters:", geminiText.substring(0, 200));

    // Remove markdown code blocks if present
    if (geminiText.startsWith("```json")) {
      geminiText = geminiText.replace(/^```json\n/, "").replace(/\n```$/, "");
    } else if (geminiText.startsWith("```")) {
      geminiText = geminiText.replace(/^```\n/, "").replace(/\n```$/, "");
    }

    // Extract JSON if there's text before/after
    const jsonMatch = geminiText.match(/\[[\s\S]*\]/);
    if (jsonMatch) {
      geminiText = jsonMatch[0];
    }

    // Validate it looks like JSON before parsing
    if (!geminiText.trim().startsWith("[")) {
      throw new Error(
        `Gemini returned non-JSON response. First 100 chars: ${geminiText.substring(
          0,
          100
        )}`
      );
    }

    // Parse Gemini response
    const basicBusinesses = JSON.parse(geminiText);

    if (!Array.isArray(basicBusinesses) || basicBusinesses.length === 0) {
      throw new Error("Gemini returned empty or invalid array");
    }

    console.log(`Parsed ${basicBusinesses.length} businesses from Gemini`);

    // Step 2: Enrich each business with Serper API
    console.log("\n[Step 2] Enriching with Serper API...");

    const enrichedBusinesses = [];

    for (let i = 0; i < basicBusinesses.length; i++) {
      const basicBusiness = basicBusinesses[i];
      console.log(
        `\nProcessing ${i + 1}/${basicBusinesses.length}: ${basicBusiness.name}`
      );

      try {
        // Search for business details using Serper Maps API
        const serperResponse = await axios.post(
          "https://google.serper.dev/maps",
          {
            q: `${basicBusiness.name} ${location}`,
            gl: "in",
            hl: "en",
          },
          {
            headers: {
              "X-API-KEY": SERPER_API_KEY,
              "Content-Type": "application/json",
            },
          }
        );

        const places = serperResponse.data.places || [];
        const place = places[0]; // Get first match

        // Log available fields for debugging (first business only)
        if (i === 0 && place) {
          console.log("Available Serper fields:", Object.keys(place));
          console.log("Place data sample:", JSON.stringify(place, null, 2));
        }

        // Extract reviews count - try multiple field names
        let reviewCount = "-";
        if (place?.reviews) reviewCount = place.reviews.toString();
        else if (place?.reviewsCount)
          reviewCount = place.reviewsCount.toString();
        else if (place?.ratingCount) reviewCount = place.ratingCount.toString();
        else if (place?.totalReviews)
          reviewCount = place.totalReviews.toString();
        else if (place?.numberOfReviews)
          reviewCount = place.numberOfReviews.toString();

        // Merge Gemini data with Serper data
        const businessAddress = place?.address || basicBusiness.address || "-";

        // Extract detailed location (city, state, country)
        let detailedLocation = location; // Default to search location
        if (place?.address) {
          // Try to extract city, state, country from address
          const addressParts = place.address.split(",").map((p) => p.trim());
          if (addressParts.length >= 2) {
            // Last part is usually country, second last is state/region
            const country = addressParts[addressParts.length - 1];
            const state = addressParts[addressParts.length - 2];
            // City might be in earlier parts or could be the first part
            const city = addressParts[0];
            detailedLocation = `${city}, ${state}, ${country}`;
          }
        }

        const enrichedBusiness = {
          name: basicBusiness.name,
          address: businessAddress,
          phone:
            basicBusiness.phone !== "N/A"
              ? basicBusiness.phone
              : place?.phoneNumber || "-",
          email: basicBusiness.email || "-",
          website: place?.website || "-",
          rating: place?.rating?.toString() || "-",
          totalRatings: reviewCount,
          ownerName:
            basicBusiness.ownerName && basicBusiness.ownerName !== "N/A"
              ? basicBusiness.ownerName
              : "-",
          googleMapsLink:
            place?.link ||
            (businessAddress !== "-"
              ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
                  basicBusiness.name + " " + businessAddress
                )}`
              : "-"),
          instagram: "-",
          facebook: "-",
          description: place?.category || place?.type || businessType,
          category: place?.category || businessType,
          location: detailedLocation,
          searchDate: new Date().toISOString(),
          lastReview:
            (basicBusiness.lastReview && basicBusiness.lastReview !== "N/A"
              ? basicBusiness.lastReview
              : null) ||
            place?.lastReview ||
            place?.recentReview ||
            place?.reviewDate ||
            "-",
        };

        enrichedBusinesses.push(enrichedBusiness);

        // Send progressive update
        sendUpdate({
          type: "progress",
          leads: enrichedBusinesses,
          total: enrichedBusinesses.length,
          page: i + 1,
          message: `Enriched ${i + 1}/${basicBusinesses.length} businesses...`,
        });

        console.log(`✅ Enriched business ${i + 1}/${basicBusinesses.length}`);

        // Delay to respect rate limits
        await new Promise((resolve) => setTimeout(resolve, 500));
      } catch (serperError) {
        console.error(
          `Serper API error for ${basicBusiness.name}:`,
          serperError.message
        );

        // Send basic info if Serper fails
        const fallbackAddress = basicBusiness.address || "-";
        const fallbackBusiness = {
          name: basicBusiness.name,
          address: fallbackAddress,
          phone: basicBusiness.phone || "-",
          email: basicBusiness.email || "-",
          website: "-",
          rating: "-",
          totalRatings: "-",
          ownerName:
            basicBusiness.ownerName && basicBusiness.ownerName !== "N/A"
              ? basicBusiness.ownerName
              : "-",
          googleMapsLink:
            fallbackAddress !== "-"
              ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
                  basicBusiness.name + " " + fallbackAddress
                )}`
              : "-",
          instagram: "-",
          facebook: "-",
          description: businessType,
          category: businessType,
          location: location,
          searchDate: new Date().toISOString(),
          lastReview: "-",
        };

        enrichedBusinesses.push(fallbackBusiness);

        // Send progressive update
        sendUpdate({
          type: "progress",
          leads: enrichedBusinesses,
          total: enrichedBusinesses.length,
          page: i + 1,
          message: `Processing ${i + 1}/${
            basicBusinesses.length
          } businesses...`,
        });
      }
    }

    console.log(`\n=== Business Search Complete ===`);
    console.log(`Total businesses: ${enrichedBusinesses.length}`);

    // Save search to database if user is authenticated
    if (req.user?.id) {
      try {
        searchRecord = await prisma.search.create({
          data: {
            userId: req.user.id,
            searchType: "business",
            businessType,
            location,
            industry: "",
            resultCount: enrichedBusinesses.length,
          },
        });
        console.log(`✅ Search saved to history: ${searchRecord.id}`);
      } catch (dbError) {
        console.error("Failed to save search:", dbError);
        // Don't fail the request if DB save fails
      }
    }

    // Send final complete results
    sendUpdate({
      type: "complete",
      leads: enrichedBusinesses,
      total: enrichedBusinesses.length,
      searchId: searchRecord?.id,
    });

    res.end();
  } catch (error) {
    console.error("Error fetching business leads:");
    console.error("Error message:", error.message);
    console.error("Error stack:", error.stack);

    // Provide more specific error messages
    let errorMessage = "Failed to fetch business leads";
    if (error.message.includes("API key")) {
      errorMessage =
        "API key not configured. Please add API keys to environment variables.";
    } else if (error.message.includes("JSON")) {
      errorMessage = "Failed to parse AI response. Please try again.";
    } else if (error.message.includes("API_KEY_INVALID")) {
      errorMessage = "Invalid API key. Please check your API keys.";
    } else if (
      error.message.includes("quota") ||
      error.message.includes("429")
    ) {
      errorMessage = "API quota exceeded. Please try again later.";
    }

    res.write(
      `data: ${JSON.stringify({
        type: "error",
        error: errorMessage,
        details: error.message,
      })}\n\n`
    );
    res.end();
  }
});

// Parse Natural Language Query Endpoint
app.post("/api/parse-query", async (req, res) => {
  const { query } = req.body;

  if (!query) {
    return res.status(400).json({ success: false, error: "Query is required" });
  }

  console.log("\n=== Parsing Natural Language Query ===");
  console.log("Query:", query);

  try {
    const genAI = new GoogleGenerativeAI(GEMINI_API_KEY);
    const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });

    const parsePrompt = `You are a query parser. Extract job role and location from the user's natural language query.

User Query: "${query}"

Extract:
1. businessType: The job title/role (e.g., "ML Engineer", "Software Engineer", "Marketing Manager")
2. location: The city or region (e.g., "Bangalore", "Mumbai", "Delhi")
3. industry: Optional industry if mentioned (e.g., "Technology", "Healthcare", "Finance")

Rules:
- Normalize job titles (e.g., "machine learning engineer" → "ML Engineer")
- Normalize locations (e.g., "Bengaluru" → "Bangalore", "NCR" → "Delhi")
- Extract industry only if explicitly mentioned
- If location is unclear, use "India" as default

Return ONLY valid JSON (no markdown, no explanation):
{
  "businessType": "extracted job title",
  "location": "extracted location",
  "industry": "extracted industry or empty string"
}`;

    // Use caching for parse queries too
    const cacheKey = `parse:${query.toLowerCase().trim()}`;
    const result = await getCachedGeminiResponse(cacheKey, async () => {
      return await model.generateContent(parsePrompt);
    });

    const response = await result.response;
    let text = response.text().trim();

    console.log("Gemini response:", text.substring(0, 200));

    // Clean markdown if present
    if (text.startsWith("```json")) {
      text = text.replace(/^```json\n/, "").replace(/\n```$/, "");
    } else if (text.startsWith("```")) {
      text = text.replace(/^```\n/, "").replace(/\n```$/, "");
    }

    // Extract JSON object
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      text = jsonMatch[0];
    }

    const parsed = JSON.parse(text);

    console.log("Parsed result:", parsed);

    res.json({
      success: true,
      businessType: parsed.businessType || "",
      location: parsed.location || "India",
      industry: parsed.industry || "",
    });
  } catch (error) {
    console.error("Query parsing error:", error);
    res.status(500).json({
      success: false,
      error: "Failed to parse query. Please use the advanced search form.",
    });
  }
});

// Cache management endpoints
app.get("/api/cache/stats", (req, res) => {
  const now = Date.now();
  const entries = Array.from(geminiCache.entries()).map(([key, value]) => ({
    key: key.substring(0, 50),
    age: Math.floor((now - value.timestamp) / 1000 / 60), // age in minutes
    expiresIn: Math.floor((CACHE_TTL - (now - value.timestamp)) / 1000 / 60), // minutes until expiry
  }));

  res.json({
    success: true,
    stats: {
      totalEntries: geminiCache.size,
      maxSize: MAX_CACHE_SIZE,
      utilizationPercent: Math.floor((geminiCache.size / MAX_CACHE_SIZE) * 100),
      cacheTTL: CACHE_TTL / 1000 / 60, // in minutes
    },
    entries: entries.slice(0, 20), // Show first 20 entries
  });
});

app.post("/api/cache/clear", (req, res) => {
  const sizeBefore = geminiCache.size;
  geminiCache.clear();
  console.log(`🧹 Cache cleared. Removed ${sizeBefore} entries.`);

  res.json({
    success: true,
    message: `Cache cleared. Removed ${sizeBefore} entries.`,
  });
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  console.log(`Serper API Key configured: ${SERPER_API_KEY ? "Yes" : "No"}`);
  console.log(`Gemini API Key configured: ${GEMINI_API_KEY ? "Yes" : "No"}`);
  console.log(
    `Cache enabled: TTL=${
      CACHE_TTL / 1000 / 60
    }min, Max=${MAX_CACHE_SIZE} entries`
  );
});
