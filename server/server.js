const express = require("express");
const cors = require("cors");
const axios = require("axios");
const { GoogleGenerativeAI } = require("@google/generative-ai");
require("dotenv").config();

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

const SERPER_API_KEY = process.env.SERPER_API_KEY;
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;

// Basic health check
app.get("/", (req, res) => {
  res.json({
    status: "running",
    message: "LinkedIn Lead Search API (Hybrid: Gemini + Serper)",
    endpoints: [
      "GET /api/leads - LinkedIn people search",
      "GET /api/business-leads - Business search",
    ],
  });
});

// LinkedIn People Search Endpoint (Hybrid: Gemini AI + Serper API)
app.get("/api/leads", async (req, res) => {
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
    const model = genAI.getGenerativeModel({
      model: "gemini-2.5-flash",
    });

    const industryText = industry ? ` in ${industry} industry` : "";
    const geminiPrompt = `Find 15 real LinkedIn profiles for "${businessType}"${industryText} in "${location}". 

For each profile, provide ONLY:
1. Person's full name
2. Their current job role/title

Return ONLY a valid JSON array:
[
  {
    "name": "Full Name",
    "role": "Job Title/Role"
  }
]

Requirements:
- Return ONLY valid JSON, no markdown or explanations
- All profiles must be real professionals from ${location}
- Focus on accuracy
- Include diverse profiles`;

    sendUpdate({
      type: "progress",
      leads: [],
      total: 0,
      page: 0,
      message: "Searching with Gemini AI...",
    });

    const geminiResult = await model.generateContent(geminiPrompt);
    const geminiResponse = await geminiResult.response;
    let geminiText = geminiResponse.text().trim();

    console.log("Gemini AI Response received");

    // Remove markdown code blocks if present
    if (geminiText.startsWith("```json")) {
      geminiText = geminiText.replace(/^```json\n/, "").replace(/\n```$/, "");
    } else if (geminiText.startsWith("```")) {
      geminiText = geminiText.replace(/^```\n/, "").replace(/\n```$/, "");
    }

    // Parse Gemini response
    const basicProfiles = JSON.parse(geminiText);
    console.log(`Parsed ${basicProfiles.length} profiles from Gemini`);

    // Step 2: Enrich each profile with Serper API
    console.log("\n[Step 2] Enriching with Serper API...");

    const enrichedLeads = [];

    for (let i = 0; i < basicProfiles.length; i++) {
      const basicProfile = basicProfiles[i];
      console.log(
        `\nProcessing ${i + 1}/${basicProfiles.length}: ${basicProfile.name}`
      );

      try {
        // Try multiple search queries to find LinkedIn profile
        let results = [];
        const searchQueries = [
          `site:linkedin.com/in/ "${basicProfile.name}" "${basicProfile.role}" "${location}"`,
          `site:linkedin.com/in/ "${basicProfile.name}" "${location}"`,
          `site:linkedin.com/in/ "${basicProfile.name}" ${basicProfile.role}`,
        ];

        for (const query of searchQueries) {
          try {
            const serperResponse = await axios.post(
              "https://google.serper.dev/search",
              {
                q: query,
                num: 3,
              },
              {
                headers: {
                  "X-API-KEY": SERPER_API_KEY,
                  "Content-Type": "application/json",
                },
              }
            );

            results = serperResponse.data.organic || [];
            if (results.length > 0) {
              console.log(`Found profile with query: ${query}`);
              break;
            }
          } catch (queryError) {
            console.log(`Query failed: ${query}`);
            continue;
          }
        }

        if (results.length > 0) {
          const result = results[0];

          // Extract company from title
          let company = "";
          const titleParts = result.title.split(/\s*[-–]\s*/);
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

          const enrichedLead = {
            personName: basicProfile.name,
            jobTitle: basicProfile.role,
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
          console.log(`❌ No Serper results for ${basicProfile.name}, skipping...`);
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

    // Send final complete results
    sendUpdate({
      type: "complete",
      leads: enrichedLeads,
      total: enrichedLeads.length,
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
      errorMessage = "Failed to parse AI response";
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
app.get("/api/business-leads", async (req, res) => {
  const { businessType, location } = req.query;

  if (!businessType || !location) {
    return res
      .status(400)
      .json({ error: "Business Type and Location are required" });
  }

  console.log("\n=== Business Search (Gemini + Serper Hybrid) ===");
  console.log("Business Type:", businessType);
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
    const model = genAI.getGenerativeModel({
      model: "gemini-2.5-flash",
    });

    const geminiPrompt = `Find 15 real businesses for "${businessType}" in "${location}". 

For each business, provide ONLY these 4 essential details:
1. Business name
2. Complete address with area name
3. Contact phone number (with country code if available)
4. Email address

Return ONLY a valid JSON array:
[
  {
    "name": "Business Name",
    "address": "Complete address with area, ${location}",
    "phone": "+91-XXXXXXXXXX or N/A",
    "email": "email@example.com or N/A"
  }
]

Requirements:
- Return ONLY valid JSON, no markdown or explanations
- All businesses must be real and from ${location}
- Include complete address with area/locality
- Use "N/A" if phone or email not available
- Focus on accuracy`;

    sendUpdate({
      type: "progress",
      leads: [],
      total: 0,
      page: 0,
      message: "Searching with Gemini AI...",
    });

    const geminiResult = await model.generateContent(geminiPrompt);
    const geminiResponse = await geminiResult.response;
    let geminiText = geminiResponse.text().trim();

    console.log("Gemini AI Response received");

    // Remove markdown code blocks if present
    if (geminiText.startsWith("```json")) {
      geminiText = geminiText.replace(/^```json\n/, "").replace(/\n```$/, "");
    } else if (geminiText.startsWith("```")) {
      geminiText = geminiText.replace(/^```\n/, "").replace(/\n```$/, "");
    }

    // Parse Gemini response
    const basicBusinesses = JSON.parse(geminiText);
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

        // Merge Gemini data with Serper data
        const businessAddress = place?.address || basicBusiness.address || "-";
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
          totalRatings: place?.reviews?.toString() || "-",
          ownerName: "-",
          googleMapsLink: place?.link || (businessAddress !== "-" ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(basicBusiness.name + " " + businessAddress)}` : "-"),
          instagram: "-",
          facebook: "-",
          description: place?.category || businessType,
          category: place?.category || businessType,
          location: location,
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
          ownerName: "-",
          googleMapsLink: fallbackAddress !== "-" ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(basicBusiness.name + " " + fallbackAddress)}` : "-",
          instagram: "-",
          facebook: "-",
          description: businessType,
          category: businessType,
          location: location,
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

    // Send final complete results
    sendUpdate({
      type: "complete",
      leads: enrichedBusinesses,
      total: enrichedBusinesses.length,
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

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  console.log(`Serper API Key configured: ${SERPER_API_KEY ? "Yes" : "No"}`);
  console.log(`Gemini API Key configured: ${GEMINI_API_KEY ? "Yes" : "No"}`);
});
