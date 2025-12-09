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
    return { data: cached.data, cacheHit: true };
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

      return { data: result, cacheHit: false };
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

  // Check if user's email is verified
  if (!req.user.emailVerified) {
    // Set headers for SSE
    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "keep-alive");

    res.write(
      `data: ${JSON.stringify({
        type: "error",
        error: "Email verification required",
        message:
          "Please verify your email address before searching for leads. Check your inbox for the verification link.",
      })}\n\n`
    );
    res.end();
    return;
  }

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
  let excludePeopleNames = [];

  // Fetch previously seen people for this user (skip if using cached results)
  const useCached = req.query.useCached === 'true';
  
  if (req.user?.id && !useCached) {
    try {
      const searchQuery = `${businessType}_${location}${industry ? '_' + industry : ''}`;
      
      const previousLeads = await prisma.userLeadHistory.findMany({
        where: {
          userId: req.user.id,
          leadType: 'people',
          searchQuery: searchQuery
        },
        select: {
          leadIdentifier: true
        }
      });

      // Extract names from identifiers (format: linkedin_{name}_{profileLink})
      excludePeopleNames = previousLeads
        .map(lead => {
          const match = lead.leadIdentifier.match(/^linkedin_(.+?)_http/);
          return match ? match[1] : null;
        })
        .filter(name => name && name.length > 0);

      if (excludePeopleNames.length > 0) {
        console.log(`📋 Found ${excludePeopleNames.length} previously seen people to exclude`);
        console.log(`Sample exclusions: ${excludePeopleNames.slice(0, 3).join(', ')}`);
      }
    } catch (error) {
      console.error('Failed to fetch previous people:', error);
      // Continue without exclusions if query fails
    }
  }

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

    const exclusionList = excludePeopleNames.length > 0 
      ? `\n\n❌ EXCLUDE THESE PEOPLE (already provided to user):\n${excludePeopleNames.slice(0, 50).map(name => `- ${name}`).join('\n')}${excludePeopleNames.length > 50 ? '\n...and ' + (excludePeopleNames.length - 50) + ' more' : ''}\n`
      : '';

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
- Founders/CEOs (unless title has all keywords)${exclusionList}

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

    // Check if user explicitly wants cached results
    const useCached = req.query.useCached === 'true';

    // Use cached response or fetch from Gemini
    const geminiResult = await getCachedGeminiResponse(cacheKey, async () => {
      return await model.generateContent(geminiPrompt);
    });

    // If cache hit and user hasn't chosen yet, ask them
    if (geminiResult.cacheHit && !useCached && req.query.useCached !== 'false') {
      sendUpdate({
        type: 'cache-available',
        message: 'You searched for this recently. Would you like cached results (instant) or fresh results (with deduplication)?'
      });
      res.end();
      return;
    }

    const geminiResponse = await geminiResult.data.response;
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
    
    // Fetch user's previous people identifiers for deduplication (skip if using cached results)
    let previousPeopleIdentifiers = new Set();
    if (req.user?.id && !useCached) {
      try {
        const searchQuery = `${businessType}_${location}${industry ? '_' + industry : ''}`;
        
        const previousLeads = await prisma.userLeadHistory.findMany({
          where: {
            userId: req.user.id,
            leadType: 'people',
            searchQuery: searchQuery
          },
          select: {
            leadIdentifier: true
          }
        });

        previousPeopleIdentifiers = new Set(previousLeads.map(l => l.leadIdentifier));
        console.log(`📋 Loaded ${previousPeopleIdentifiers.size} previous people identifiers for real-time deduplication`);
      } catch (error) {
        console.error('Failed to load previous people for deduplication:', error);
      }
    }

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

          // Check if this person was already provided to user (real-time deduplication)
          // Skip deduplication if using cached results
          const leadIdentifier = `linkedin_${basicProfile.name.toLowerCase().trim()}_${result.link}`;
          
          if (!useCached && previousPeopleIdentifiers.has(leadIdentifier)) {
            console.log(`⚠️ Skipping duplicate person (already in user history): ${basicProfile.name}`);
            continue;
          }

          enrichedLeads.push(enrichedLead);
          
          // Save to database immediately (non-blocking) - skip if using cached results
          if (req.user?.id && !useCached) {
            prisma.userLeadHistory.create({
              data: {
                userId: req.user.id,
                leadIdentifier: leadIdentifier,
                searchQuery: `${businessType}_${location}${industry ? '_' + industry : ''}`,
                leadType: 'people'
              }
            }).catch(err => {
              // Silently ignore unique constraint errors (P2002)
              if (err.code !== 'P2002') {
                console.error('Failed to save lead to history:', err);
              }
            });
          }

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
  const { businessType, location, leadCount, specificBusinessName, ownerName } =
    req.query;

  // Check if user's email is verified
  if (!req.user.emailVerified) {
    // Set headers for SSE
    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "keep-alive");

    res.write(
      `data: ${JSON.stringify({
        type: "error",
        error: "Email verification required",
        message:
          "Please verify your email address before searching for leads. Check your inbox for the verification link.",
      })}\n\n`
    );
    res.end();
    return;
  }

  // Validation logic based on search type
  if (ownerName) {
    // Owner name search - only location required
    if (!location) {
      return res
        .status(400)
        .json({ error: "Location is required when searching by owner name" });
    }
  } else if (specificBusinessName) {
    // Specific business name search - only location required
    if (!location) {
      return res.status(400).json({
        error: "Location is required when searching for a specific business",
      });
    }
  } else {
    // General business type search - both businessType and location required
    if (!businessType || !location) {
      return res
        .status(400)
        .json({ error: "Business Type and Location are required" });
    }
  }

  // Validate and cap leadCount based on search type
  const requestedLeads = specificBusinessName
    ? 1
    : ownerName
    ? Math.min(20, Math.max(1, parseInt(leadCount) || 10))
    : Math.min(50, Math.max(1, parseInt(leadCount) || 20));

  console.log("\n=== Business Search (Gemini + Serper Hybrid) ===");
  console.log("Specific Business Name:", specificBusinessName || "N/A");
  console.log("Owner Name:", ownerName || "N/A");
  console.log("Business Type:", businessType || "N/A");
  console.log("Location:", location);
  console.log("Lead Count:", requestedLeads);
  console.log("User ID:", req.user?.id);

  let searchRecord = null;
  let excludeBusinessNames = [];

  // Fetch previously seen business names for this user
  if (req.user?.id && !specificBusinessName) {
    try {
      const searchQuery = ownerName
        ? `owner_${ownerName}_${location}`
        : `${businessType}_${location}`;
      
      const previousLeads = await prisma.userLeadHistory.findMany({
        where: {
          userId: req.user.id,
          leadType: 'business',
          searchQuery: {
            contains: ownerName ? `owner_${ownerName}` : businessType
          }
        },
        select: {
          leadIdentifier: true
        }
      });

      // Extract business names from identifiers (format: business_{name}_{location}_{contact})
      excludeBusinessNames = previousLeads
        .map(lead => {
          const parts = lead.leadIdentifier.split('_');
          // Skip first element ('business') and reconstruct name
          const nameEndIndex = parts.length - 2; // exclude location and contact
          return parts.slice(1, nameEndIndex).join('_');
        })
        .filter(name => name && name.length > 0);

      if (excludeBusinessNames.length > 0) {
        console.log(`📋 Found ${excludeBusinessNames.length} previously seen businesses to exclude`);
        console.log(`Sample exclusions: ${excludeBusinessNames.slice(0, 3).join(', ')}`);
      }
    } catch (error) {
      console.error('Failed to fetch previous businesses:', error);
      // Continue without exclusions if query fails
    }
  }
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
    console.log("\n[Step 1] Generating search queries with Gemini AI...");

    const genAI = new GoogleGenerativeAI(GEMINI_API_KEY);

    // Use gemini-2.5-flash (latest stable model)
    let model;
    let modelName = "gemini-2.5-flash";

    model = genAI.getGenerativeModel({ model: modelName });

    console.log(`Using model: ${modelName}`);

    // Create different prompts based on search type
    let geminiPrompt;
    if (specificBusinessName) {
      // Specific business search - just return the search query
      geminiPrompt = `You are a search query generator. Return ONLY valid JSON with a Google Maps search query and concise business description.

Task: Generate ONE search query to find "${specificBusinessName}" in "${location}" on Google Maps.

CRITICAL INSTRUCTIONS:
- DO NOT make up or invent business names
- DO NOT add extra details you're not certain about
- ONLY return the exact business name provided plus location
- Use the EXACT business name as given: "${specificBusinessName}"
- Provide a MAXIMUM 2-line description (approximately 150-200 characters) focusing on:
  * Primary services/products offered
  * Key specialization or what they're known for
- ONLY include description if you know this business well
- Keep description concise and informative
- If this business has a well-known website, base description on their actual services

OUTPUT FORMAT:
{
  "searchQueries": ["${specificBusinessName} ${location}"],
  "descriptions": ["Concise 2-line description (max 200 chars) of services and specialization, or empty string if unknown"]
}

CRITICAL: Valid JSON only. No markdown, no explanations, no additional text.`;
    } else if (ownerName) {
      // Owner name search - use direct search approach
      const exclusionList = excludeBusinessNames.length > 0 
        ? `\n\n❌ EXCLUDE THESE BUSINESSES (already provided to user):\n${excludeBusinessNames.slice(0, 30).map(name => `- ${name}`).join('\n')}${excludeBusinessNames.length > 30 ? '\n...and ' + (excludeBusinessNames.length - 30) + ' more' : ''}`
        : '';
      
      geminiPrompt = `You are a search query generator. Return ONLY valid JSON with Google Maps search queries and concise descriptions.

Task: Generate ${requestedLeads} search queries to find businesses potentially owned or founded by "${ownerName}" in "${location}".

CRITICAL INSTRUCTIONS:
- ONLY suggest well-known, publicly documented businesses
- DO NOT invent or guess business names
- If you don't know any businesses owned by this person, return empty array []
- ONLY include businesses where ownership is publicly verified and well-documented
- Focus on major, established businesses with clear ownership records
- For each business description, provide MAXIMUM 2 lines (approximately 150-200 characters) focusing on:
  * Core services or products offered
  * Key specialization or market position
- Keep descriptions concise and informative
- Base descriptions on what you know about their actual business operations${exclusionList}

OUTPUT FORMAT:
{
  "searchQueries": [
    "verified business name 1 ${location}",
    "verified business name 2 ${location}"
  ],
  "descriptions": [
    "Concise 2-line description (max 200 chars) of services and specialization, or empty string if unknown",
    "Concise 2-line description (max 200 chars) of services and specialization, or empty string if unknown"
  ]
}

CRITICAL: Valid JSON only. If uncertain about any business, return fewer results or empty array. No markdown, no explanations.`;
    } else {
      // General business type search - generate search queries
      const exclusionList = excludeBusinessNames.length > 0 
        ? `\n\n❌ EXCLUDE THESE BUSINESSES (already provided to user):\n${excludeBusinessNames.slice(0, 30).map(name => `- ${name}`).join('\n')}${excludeBusinessNames.length > 30 ? '\n...and ' + (excludeBusinessNames.length - 30) + ' more' : ''}`
        : '';
      
      geminiPrompt = `You are a search query generator. Return ONLY valid JSON with Google Maps search queries and concise descriptions.

Task: Generate ${requestedLeads} search queries to find well-established "${businessType}" businesses in "${location}".

CRITICAL INSTRUCTIONS:
- ONLY suggest real, well-known, established businesses in ${location}
- DO NOT invent or make up business names
- Use ONLY businesses you are CERTAIN exist in ${location}
- If you don't know ${requestedLeads} businesses, return fewer results
- Focus on reputable, long-standing businesses
- Each business name must be REAL and VERIFIED
- For each business, provide MAXIMUM 2-line description (approximately 150-200 characters) that includes:
  * Primary services or products offered
  * Key specialization within ${businessType}
- Keep descriptions concise and informative
- Base descriptions on what you know from their website or public information
- ONLY add descriptions for businesses you know well${exclusionList}

OUTPUT FORMAT:
{
  "searchQueries": [
    "real business name 1 ${location}",
    "real business name 2 ${location}"
  ],
  "descriptions": [
    "Concise 2-line description (max 200 chars) focusing on services and specialization. Empty string if unknown",
    "Concise 2-line description (max 200 chars) focusing on services and specialization. Empty string if unknown"
  ]
}

CRITICAL: Valid JSON only. Return ONLY businesses you are absolutely certain exist. No markdown, no explanations, no hallucinations.`;
    }

    sendUpdate({
      type: "progress",
      leads: [],
      total: 0,
      page: 0,
      message: specificBusinessName
        ? `Searching for ${specificBusinessName}...`
        : ownerName
        ? `Searching businesses owned by ${ownerName}...`
        : "Generating search queries...",
    });

    // Create cache key from search parameters
    const cacheKey = specificBusinessName
      ? `business:specific:${specificBusinessName}:${location}`
      : ownerName
      ? `business:owner:${ownerName}:${location}:${requestedLeads}`
      : `business:${businessType}:${location}:${requestedLeads}`;

    // Check if user explicitly wants cached results
    const useCached = req.query.useCached === 'true';

    // Use cached response or fetch from Gemini
    const geminiResult = await getCachedGeminiResponse(cacheKey, async () => {
      return await model.generateContent(geminiPrompt);
    });

    // If cache hit and user hasn't chosen yet, ask them
    if (geminiResult.cacheHit && !useCached && req.query.useCached !== 'false') {
      sendUpdate({
        type: 'cache-available',
        message: 'You searched for this recently. Would you like cached results (instant) or fresh results (with deduplication)?'
      });
      res.end();
      return;
    }

    const geminiResponse = await geminiResult.data.response;
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
    const jsonMatch = geminiText.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      geminiText = jsonMatch[0];
    }

    // Validate it looks like JSON before parsing
    if (!geminiText.trim().startsWith("{")) {
      throw new Error(
        `Gemini returned non-JSON response. First 100 chars: ${geminiText.substring(
          0,
          100
        )}`
      );
    }

    // Parse Gemini response to get search queries and descriptions
    const searchQueriesData = JSON.parse(geminiText);
    const searchQueries = searchQueriesData.searchQueries || [];
    const descriptions = searchQueriesData.descriptions || [];

    if (!Array.isArray(searchQueries) || searchQueries.length === 0) {
      throw new Error("Gemini returned empty or invalid search queries");
    }

    console.log(`Generated ${searchQueries.length} search queries from Gemini`);
    console.log(`Generated ${descriptions.length} descriptions from Gemini`);

    // Step 2: Fetch all business data from Google Maps (Serper API)
    console.log(
      "\n[Step 2] Fetching verified business data from Google Maps..."
    );

    const enrichedBusinesses = [];
    const seenBusinesses = new Set(); // Track duplicates in current search
    
    // Fetch user's previous business identifiers for deduplication (skip if using cached results)
    let previousBusinessIdentifiers = new Set();
    if (req.user?.id && !specificBusinessName && !useCached) {
      try {
        const searchQuery = ownerName
          ? `owner_${ownerName}_${location}`
          : `${businessType}_${location}`;
        
        const previousLeads = await prisma.userLeadHistory.findMany({
          where: {
            userId: req.user.id,
            leadType: 'business',
            searchQuery: {
              contains: ownerName ? `owner_${ownerName}` : businessType
            }
          },
          select: {
            leadIdentifier: true
          }
        });

        previousBusinessIdentifiers = new Set(previousLeads.map(l => l.leadIdentifier));
        console.log(`📋 Loaded ${previousBusinessIdentifiers.size} previous business identifiers for real-time deduplication`);
      } catch (error) {
        console.error('Failed to load previous businesses for deduplication:', error);
      }
    }

    for (let i = 0; i < searchQueries.length; i++) {
      const searchQuery = searchQueries[i];
      const geminiDescription = descriptions[i] || ""; // Get corresponding description
      console.log(
        `\nProcessing ${i + 1}/${searchQueries.length}: ${searchQuery}`
      );

      try {
        // Search for business details using Serper Maps API
        // Note: This returns multiple results in ONE API call
        const serperResponse = await axios.post(
          "https://google.serper.dev/maps",
          {
            q: searchQuery,
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

        // Skip if no place found
        if (places.length === 0) {
          console.log(`⚠️ No business found for query: ${searchQuery}`);
          continue;
        }

        // Get the first result and validate it has essential data
        const place = places[0];

        // Validate that the place has essential information
        if (!place.title && !place.name) {
          console.log(`⚠️ No business name in result for: ${searchQuery}`);
          continue;
        }
        if (!place.address) {
          console.log(`⚠️ No address in result for: ${searchQuery}`);
          continue;
        }

        // Check if this business was already added (by address)
        const businessKey = `${place.title || place.name}_${place.address}`;
        if (seenBusinesses.has(businessKey)) {
          console.log(
            `⚠️ Duplicate business skipped: ${place.title || place.name}`
          );
          continue;
        }

        // Mark this business as seen
        seenBusinesses.add(businessKey);

        // Log available fields for debugging (first business only)
        if (i === 0) {
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

        // Validate essential data
        const businessName = place.title || place.name;
        const businessAddress = place.address;
        const businessPhone = place.phoneNumber;

        if (!businessName || !businessAddress) {
          console.log(
            `⚠️ Skipping business with incomplete data: ${
              businessName || "Unknown"
            }`
          );
          continue;
        }

        console.log(`✅ Valid business found: ${businessName}`);
        console.log(`   Address: ${businessAddress}`);
        console.log(`   Phone: ${businessPhone || "Not available"}`);

        // Extract detailed location (city, state, country) - only these 3 components
        let detailedLocation = location; // Default to search location
        if (businessAddress) {
          // Try to extract city, state, country from address
          const addressParts = businessAddress.split(",").map((p) => p.trim());

          if (addressParts.length >= 3) {
            // Get country (last part)
            const country = addressParts[addressParts.length - 1];
            // Get state (second last part)
            const state = addressParts[addressParts.length - 2];

            // Get city (third last part) - skip if it contains postal code or looks like street address
            let city = addressParts[addressParts.length - 3];

            // If city contains postal code, skip backward to find actual city
            if (/\d{5,6}/.test(city) || /^\d+/.test(city)) {
              // Try to find city in remaining parts
              for (let i = addressParts.length - 4; i >= 0; i--) {
                const part = addressParts[i];
                if (
                  !/\d{5,6}/.test(part) &&
                  !/^\d+/.test(part) &&
                  !/\b(Rd|Road|St|Street|Ave|Avenue|Lane|Drive)\b/i.test(part)
                ) {
                  city = part;
                  break;
                }
              }
            }

            // Final validation - if city still has numbers/postal codes, skip it
            if (!/\d{5,6}/.test(city) && !/^\d+/.test(city)) {
              detailedLocation = `${city}, ${state}, ${country}`;
            } else {
              detailedLocation = `${state}, ${country}`;
            }
          } else if (addressParts.length === 2) {
            // Only state/city and country available
            const country = addressParts[addressParts.length - 1];
            const stateOrCity = addressParts[0];
            detailedLocation = `${stateOrCity}, ${country}`;
          }
        }

        // Use ONLY verified Google Maps data
        const enrichedBusiness = {
          name: businessName,
          address: businessAddress,
          phone: businessPhone || "-",
          email: "-", // Google Maps doesn't provide email
          website: place.website || "-",
          rating: place.rating?.toString() || "-",
          totalRatings: reviewCount,
          ownerName: "-", // Google Maps doesn't provide owner info
          googleMapsLink:
            place.link ||
            `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
              searchQuery
            )}`,
          instagram: "-",
          facebook: "-",
          description:
            geminiDescription ||
            place.category ||
            place.type ||
            businessType ||
            "-",
          category: place.category || businessType || "-",
          location: detailedLocation,
          searchDate: new Date().toISOString(),
          lastReview: "-", // Google Maps doesn't provide review dates in this format
        };

        // Check if this business was already provided to user (real-time deduplication)
        // Skip deduplication if using cached results
        const leadIdentifier = `business_${businessName.toLowerCase().trim()}_${detailedLocation.toLowerCase().trim()}_${businessPhone !== '-' ? businessPhone : place.link}`;
        
        if (!useCached && previousBusinessIdentifiers.has(leadIdentifier)) {
          console.log(`⚠️ Skipping duplicate business (already in user history): ${businessName}`);
          continue;
        }

        enrichedBusinesses.push(enrichedBusiness);
        
        // Save to database immediately (non-blocking) - skip if using cached results
        if (req.user?.id && !useCached) {
          prisma.userLeadHistory.create({
            data: {
              userId: req.user.id,
              leadIdentifier: leadIdentifier,
              searchQuery: specificBusinessName 
                ? `specific_${specificBusinessName}_${location}`
                : ownerName
                ? `owner_${ownerName}_${location}`
                : `${businessType}_${location}`,
              leadType: 'business'
            }
          }).catch(err => {
            // Silently ignore unique constraint errors (P2002)
            if (err.code !== 'P2002') {
              console.error('Failed to save lead to history:', err);
            }
          });
        }

        // Send progressive update
        sendUpdate({
          type: "progress",
          leads: enrichedBusinesses,
          total: enrichedBusinesses.length,
          page: i + 1,
          message: `Found ${enrichedBusinesses.length} verified ${
            enrichedBusinesses.length === 1 ? "business" : "businesses"
          }...`,
        });

        console.log(
          `✅ Added business ${enrichedBusinesses.length}: ${businessName}`
        );

        // Delay to respect rate limits
        await new Promise((resolve) => setTimeout(resolve, 500));
      } catch (serperError) {
        console.error(
          `Serper API error for query "${searchQuery}":`,
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
