const express = require("express");
const cors = require("cors");
const axios = require("axios");
require("dotenv").config();

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

const SERPER_API_KEY = process.env.SERPER_API_KEY;

// Basic health check
app.get("/", (req, res) => {
  res.send("LinkedIn Lead Search API is running (Serper API)");
});

app.get("/api/leads", async (req, res) => {
  const { businessType, location, industry } = req.query;

  if (!businessType || !location) {
    return res
      .status(400)
      .json({ error: "Business Type and Location are required" });
  }

  // Construct query for individual people on LinkedIn
  let queryParts = [];

  // Add job title/role with quotes for exact phrase matching
  if (businessType.trim()) {
    const jobTitles = businessType
      .split(/[,/|]/)
      .map((t) => t.trim())
      .filter((t) => t);
    if (jobTitles.length > 1) {
      queryParts.push(
        `(${jobTitles.map((title) => `"${title}"`).join(" OR ")})`
      );
    } else {
      queryParts.push(`"${businessType.trim()}"`);
    }
  }

  // Add industry if provided
  if (industry && industry.trim()) {
    queryParts.push(`"${industry.trim()}"`);
  }

  // Add location - use intitle operator for better filtering
  queryParts.push(`intitle:"${location.trim()}"`);

  // Target LinkedIn profiles (people, not companies)
  queryParts.push("site:linkedin.com/in");

  const query = queryParts.join(" ");

  console.log("\n=== LinkedIn People Search (Serper API) ===");
  console.log("Business Type:", businessType);
  console.log("Location:", location);
  console.log("Industry:", industry || "N/A");
  console.log("Search Query:", query);

  try {
    const allLeads = [];
    const maxPages = 10; // 10 pages = 100 results

    // Set headers for Server-Sent Events (SSE)
    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "keep-alive");

    // Helper function to send progressive updates
    const sendUpdate = (data) => {
      res.write(`data: ${JSON.stringify(data)}\n\n`);
    };

    // Fetch results from Serper API
    for (let page = 1; page <= maxPages; page++) {
      console.log(`\nFetching page ${page}...`);

      try {
        const response = await axios.post(
          "https://google.serper.dev/search",
          {
            q: query,
            page: page,
            num: 10,
          },
          {
            headers: {
              "X-API-KEY": SERPER_API_KEY,
              "Content-Type": "application/json",
            },
          }
        );

        const results = response.data.organic || [];
        console.log(`Page ${page}: Found ${results.length} results`);

        if (results.length === 0) {
          console.log("No more results, stopping...");
          break;
        }

        // Process each result - extract person information
        const leads = results
          .filter((item) => item.link && item.link.includes("linkedin.com/in/"))
          .map((item) => {
            let personName = "";
            let jobTitle = "";
            let company = "";
            let personLocation = "";

            // Extract person name from title
            const titleMatch = item.title.match(/^([^-|]+)/);
            if (titleMatch) {
              personName = titleMatch[1]
                .trim()
                .replace(" | LinkedIn", "")
                .replace(" - LinkedIn", "");
            }

            // Extract job title and company from title
            const titleParts = item.title.split(/\s*[-–]\s*/);
            if (titleParts.length >= 2) {
              let jobPart = titleParts[1]
                .replace(/\s*\|\s*LinkedIn.*$/i, "")
                .trim();

              if (jobPart.includes(" at ")) {
                const atSplit = jobPart.split(" at ");
                jobTitle = atSplit[0].trim();
                company = atSplit.slice(1).join(" at ").trim();
              } else {
                jobTitle = jobPart;
                if (titleParts.length >= 3) {
                  company = titleParts[2]
                    .replace(/\s*\|\s*LinkedIn.*$/i, "")
                    .trim();
                }
              }
            }

            // Extract location from snippet
            const locationPatterns = [
              /(?:Location|Based in)[:\s]+([^·•\n.]+?)(?:\s*[·•.]|$)/i,
              /\b([A-Z][a-z]+(?:\s+[A-Z][a-z]+)?),\s*([A-Z][a-z]+(?:\s+[A-Z][a-z]+)?),\s*India\b/,
              /\b([A-Z][a-z]+(?:\s+[A-Z][a-z]+)?),\s*India\b/,
            ];

            for (const pattern of locationPatterns) {
              const match = item.snippet?.match(pattern);
              if (match) {
                let loc = match[1]?.trim();
                if (
                  loc &&
                  loc.length >= 3 &&
                  loc.length < 50 &&
                  /^[A-Z]/.test(loc)
                ) {
                  personLocation = loc
                    .replace(/[·•]/g, "")
                    .replace(/\s+/g, " ")
                    .replace(/\.+$/g, "")
                    .trim();
                  break;
                }
              }
            }

            // Generate profile picture URL
            let profilePic = `https://ui-avatars.com/api/?name=${encodeURIComponent(
              personName
            )}&background=0D8ABC&color=fff&size=128`;

            return {
              personName: personName || "Unknown",
              jobTitle: jobTitle || "",
              company: company || "",
              location: personLocation || "",
              profileLink: item.link,
              snippet: item.snippet || "",
              profilePic: profilePic,
              title: item.title,
            };
          })
          .filter((lead) => {
            // Location filtering - lenient approach
            if (lead.location) {
              const requestedLocation = location.trim().toLowerCase();
              const leadLocation = lead.location.toLowerCase();
              const locationWords = requestedLocation.split(/[\s,]+/);

              const hasAnyMatch = locationWords.some((word) =>
                leadLocation.includes(word)
              );
              const isSubstring = requestedLocation.includes(leadLocation);

              if (!hasAnyMatch && !isSubstring) {
                console.log(
                  `  ❌ Rejected (incorrect location): ${lead.personName} - Location: "${lead.location}" (expected: "${location}")`
                );
                return false;
              }
            } else {
              console.log(
                `  ⚠️ No location extracted, trusting query filter: ${lead.personName} - "${lead.jobTitle}"`
              );
            }

            return true;
          })
          .filter((lead) => {
            // Job title filtering
            if (!lead.jobTitle) {
              console.log(`  ❌ Rejected (no job title): ${lead.personName}`);
              return false;
            }

            const requestedJobTitle = businessType.trim().toLowerCase();
            const leadJobTitle = lead.jobTitle.toLowerCase();

            const requestedTitles = requestedJobTitle
              .split(/[,/|]/)
              .map((t) => t.trim())
              .filter((t) => t);

            const titleMatches = requestedTitles.some((reqTitle) => {
              const reqWords = reqTitle.split(/\s+/);
              return reqWords.every((word) => leadJobTitle.includes(word));
            });

            if (!titleMatches) {
              console.log(
                `  ❌ Rejected (job title mismatch): ${lead.personName} - Job: "${lead.jobTitle}" (expected: "${businessType}")`
              );
              return false;
            }

            console.log(`  ✅ Accepted: ${lead.personName} - ${lead.jobTitle}`);
            return true;
          });

        // Remove duplicates by profile link
        const existingLinks = new Set(allLeads.map((lead) => lead.profileLink));
        const newLeads = leads.filter(
          (lead) => !existingLinks.has(lead.profileLink)
        );

        if (newLeads.length > 0) {
          allLeads.push(...newLeads);
          console.log(
            `Added ${newLeads.length} new unique leads. Total: ${allLeads.length}`
          );

          // Send progressive update every 2 pages
          if (page % 2 === 0 || page === 1) {
            sendUpdate({
              type: "progress",
              leads: allLeads,
              total: allLeads.length,
              page: page,
            });
          }
        } else {
          console.log(
            `No leads matched filters (location: "${location}", job title: "${businessType}")`
          );
        }

        // Rate limit: 1 second delay between requests (Serper free tier = 1 req/sec)
        if (page < maxPages) {
          await new Promise((resolve) => setTimeout(resolve, 1000));
        }
      } catch (pageError) {
        console.error(`Error on page ${page}:`, pageError.message);
        if (pageError.response) {
          console.error("Response status:", pageError.response.status);
          console.error(
            "Response data:",
            JSON.stringify(pageError.response.data, null, 2)
          );
        }

        // If we get a 429 (rate limit), stop trying
        if (pageError.response?.status === 429) {
          console.error("Rate limited. Stopping...");
          break;
        }

        // If API key is invalid (401), stop
        if (pageError.response?.status === 401) {
          console.error("Invalid API key. Please check SERPER_API_KEY in .env");
          break;
        }
      }
    }

    console.log("\n=== Search Complete ===");
    console.log(`Total leads found: ${allLeads.length}`);

    // Send final complete results
    sendUpdate({
      type: "complete",
      leads: allLeads,
      total: allLeads.length,
    });

    res.end();
  } catch (error) {
    console.error("Error fetching leads:", error.message);
    res.write(
      `data: ${JSON.stringify({
        type: "error",
        error: "Failed to fetch leads",
        details: error.message,
      })}\n\n`
    );
    res.end();
  }
});

app.listen(PORT, () => {
  console.log(`LinkedIn Search Server running on port ${PORT} (Serper API)`);
  console.log(`Serper API Key configured: ${SERPER_API_KEY ? "Yes" : "No"}`);
});
