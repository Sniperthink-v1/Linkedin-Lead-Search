const express = require("express");
const cors = require("cors");
const puppeteer = require("puppeteer");
require("dotenv").config();

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

// Basic health check
app.get("/", (req, res) => {
  res.send("LinkedIn Lead Search API is running");
});

app.get("/api/leads", async (req, res) => {
  const { businessType, location, industry } = req.query;

  if (!businessType || !location) {
    return res
      .status(400)
      .json({ error: "Business Type and Location are required" });
  }

  // Construct Google search query with proper formatting
  // Balance between specificity and finding results
  let queryParts = [];

  // Add business type without strict quotes for better results
  if (businessType.trim()) {
    queryParts.push(businessType.trim());
  }

  // Add industry if provided
  if (industry && industry.trim()) {
    queryParts.push(industry.trim());
  }

  // Add location
  queryParts.push(location.trim());

  // Add companies keyword to help find company pages
  queryParts.push("companies");

  // Add LinkedIn site restriction
  queryParts.push("site:linkedin.com/company");

  const query = queryParts.join(" ");

  console.log("Search Query:", query);
  console.log(
    "Filters - Business:",
    businessType,
    "| Industry:",
    industry || "N/A",
    "| Location:",
    location
  );

  try {
    const allLeads = [];
    const maxPagesPerQuery = 10; // Google API allows up to 100 results per query (10 pages x 10 results)
    const maxTotalResults = 1000; // Set a reasonable limit for total results
    let totalResultsEstimate = 0;
    let queryVariation = 0;

    // Function to generate query variations to bypass 100-result limit
    const getQueryVariation = (baseQuery, variation) => {
      if (variation === 0) return baseQuery;

      // Add different modifiers to get different result sets
      const modifiers = [
        "", // Original query
        " OR company",
        " OR business",
        " OR enterprise",
        " OR organization",
        " OR firm",
        " OR corporation",
        " OR startup",
        " OR agency",
        " OR solutions",
      ];

      return baseQuery + (modifiers[variation] || "");
    };

    // Keep fetching until we have enough results or run out of variations
    while (allLeads.length < maxTotalResults && queryVariation < 10) {
      const currentQuery = getQueryVariation(query, queryVariation);
      console.log(`\n=== Query Variation ${queryVariation + 1} ===`);
      console.log("Query:", currentQuery);

      let pagesForThisQuery = 0;
      let foundNewResults = false;

      // Fetch multiple pages of results for this query variation
      for (let page = 0; page < maxPagesPerQuery; page++) {
        const startIndex = page * 10 + 1; // Google API uses 1-based indexing

        try {
          const response = await axios.get(
            "https://www.googleapis.com/customsearch/v1",
            {
              params: {
                key: process.env.GOOGLE_API_KEY,
                cx: process.env.GOOGLE_CX,
                q: currentQuery,
                start: startIndex,
                num: 10, // Request 10 results per page
              },
            }
          );

          // Get total results estimate from first page
          if (page === 0 && response.data.searchInformation?.totalResults) {
            totalResultsEstimate = parseInt(
              response.data.searchInformation.totalResults
            );
            console.log(
              `Estimated total results available: ${totalResultsEstimate}`
            );
          }

          console.log(
            `Page ${page + 1}: Retrieved ${
              response.data.items?.length || 0
            } items`
          );

          const items = response.data.items || [];

          // If no items returned, we've reached the end of results for this query
          if (items.length === 0) {
            console.log(
              `No more results for query variation ${queryVariation + 1}`
            );
            break;
          }

          // Filter to only include LinkedIn links
          const linkedInItems = items.filter(
            (item) =>
              item.link &&
              (item.link.includes("linkedin.com/company/") ||
                item.link.includes("linkedin.com/in/"))
          );

          console.log(
            `Page ${page + 1}: Filtered to ${
              linkedInItems.length
            } LinkedIn results`
          );

          const leads = linkedInItems.map((item) => {
            // Parse company information from Google search result
            let companyName = "Unknown Company";
            let subtitle = "";

            // Clean up the title - various formats possible
            let cleanTitle = item.title
              .replace(/\s*\|\s*LinkedIn.*$/i, "")
              .replace(/\s*-\s*LinkedIn.*$/i, "")
              .trim();

            // Try to split by colon, dash, or use whole title
            if (cleanTitle.includes(":")) {
              const parts = cleanTitle.split(":");
              companyName = parts[0].trim();
              subtitle = parts.slice(1).join(":").trim();
            } else if (cleanTitle.includes(" - ")) {
              const parts = cleanTitle.split(" - ");
              companyName = parts[0].trim();
              subtitle = parts.slice(1).join(" - ").trim();
            } else {
              companyName = cleanTitle;
            }

            // Extract structured data from snippet
            let extractedIndustry = "";
            let companySize = "";
            let companyLocation = "";

            // Try to extract industry
            const industryPatterns = [
              /Industry[:\s]+([^·•\n|]+)/i,
              /(?:^|\n)([^·•\n|]+)industry/i,
            ];

            for (const pattern of industryPatterns) {
              const match = item.snippet.match(pattern);
              if (match) {
                extractedIndustry = match[1].replace(/[·•]/g, "").trim();
                break;
              }
            }

            // Extract company size (employees)
            const sizePatterns = [
              /(\d+[\s-]*\d*)[+\s-]*(employees?|people)/i,
              /(\d+K?)[+\s]*(employees?|people)/i,
              /Company size[:\s]+(\d+[^·•\n|]+)/i,
            ];

            for (const pattern of sizePatterns) {
              const match = item.snippet.match(pattern);
              if (match) {
                companySize = match[0].replace(/[·•]/g, "").trim();
                break;
              }
            }

            // Extract location/headquarters - NO restrictions, extract whatever is there
            const locationPatterns = [
              // Pattern 1: "Headquarters: ..." or "Location: ..."
              /(?:Headquarters|Location)[:\s]+([^·•\n|]{2,})/i,
              // Pattern 2: "Based in ..."
              /Based\s+in[:\s]+([^·•\n|]{2,})/i,
            ];

            for (const pattern of locationPatterns) {
              const match = item.snippet.match(pattern);
              if (match) {
                let loc = match[1]?.trim();
                if (loc) {
                  // Clean up location text
                  loc = loc
                    .replace(/[·•]/g, "")
                    .replace(/\s+/g, " ")
                    .replace(/\.\.\.$/, "")
                    .trim();

                  // Stop at common delimiters
                  loc = loc.split(/[|;]/)[0].trim();

                  // Remove trailing period if long text
                  if (loc.endsWith(".") && loc.length > 4) {
                    loc = loc.slice(0, -1).trim();
                  }

                  // Accept any location that has content
                  if (loc.length >= 2) {
                    companyLocation = loc;
                    break;
                  }
                }
              }
            }

            // Keep empty if no location found
            if (!companyLocation) {
              companyLocation = "";
            }

            // Get company logo/image from pagemap
            let logo = null;
            if (item.pagemap?.cse_thumbnail?.[0]?.src) {
              logo = item.pagemap.cse_thumbnail[0].src;
            } else if (item.pagemap?.cse_image?.[0]?.src) {
              logo = item.pagemap.cse_image[0].src;
            } else if (item.pagemap?.metatags?.[0]?.["og:image"]) {
              logo = item.pagemap.metatags[0]["og:image"];
            }

            // Get website URL from pagemap or displayLink
            let website = item.displayLink || "";
            if (item.pagemap?.metatags?.[0]?.["og:url"]) {
              website = item.pagemap.metatags[0]["og:url"];
            }

            return {
              companyName,
              subtitle,
              industry: extractedIndustry || subtitle,
              companySize,
              location: companyLocation,
              website,
              title: item.title,
              link: item.link,
              snippet: item.snippet,
              logo,
              displayLink: item.displayLink,
            };
          });

          console.log(
            `Page ${page + 1}: Processed ${leads.length} company results`
          );

          // Remove duplicates based on LinkedIn URL
          const existingLinks = new Set(allLeads.map((lead) => lead.link));
          const newLeads = leads.filter(
            (lead) => !existingLinks.has(lead.link)
          );

          if (newLeads.length > 0) {
            allLeads.push(...newLeads);
            foundNewResults = true;
            console.log(
              `Added ${newLeads.length} new unique leads. Total: ${allLeads.length}`
            );
          } else {
            console.log("No new unique leads found on this page");
          }

          pagesForThisQuery++;

          // If we got fewer than 10 results or no LinkedIn results, we've reached the end for this query
          if (items.length < 10 || linkedInItems.length === 0) {
            console.log(
              `Reached end of results for query variation ${queryVariation + 1}`
            );
            break;
          }

          // Stop if we've reached our target
          if (allLeads.length >= maxTotalResults) {
            console.log(
              `Reached maximum total results limit: ${maxTotalResults}`
            );
            break;
          }
        } catch (pageError) {
          // If a specific page fails, log it but continue with what we have
          console.error(`Error fetching page ${page + 1}:`, pageError.message);
          if (pageError.response) {
            console.error("API Error:", pageError.response.data);
          }
          break;
        }
      }

      // Check if we should try another query variation
      const shouldContinue =
        foundNewResults &&
        pagesForThisQuery >= maxPagesPerQuery &&
        allLeads.length < maxTotalResults &&
        totalResultsEstimate > allLeads.length + 50; // Only continue if significantly more results available

      if (!shouldContinue) {
        console.log(`\nStopping search. Reasons:`);
        console.log(`- Found new results: ${foundNewResults}`);
        console.log(
          `- Pages fetched: ${pagesForThisQuery}/${maxPagesPerQuery}`
        );
        console.log(`- Total leads: ${allLeads.length}/${maxTotalResults}`);
        console.log(`- Estimated available: ${totalResultsEstimate}`);
        break;
      }

      queryVariation++;
      console.log(`Moving to query variation ${queryVariation + 1}...`);
    }

    console.log(`\n=== Search Complete ===`);
    console.log(`Total unique leads found: ${allLeads.length}`);
    console.log(`Query variations used: ${queryVariation + 1}`);

    // Filter to only include companies that have the requested location in their profile
    const requestedLocation = location.trim().toLowerCase();
    const filteredLeads = allLeads.filter((lead) => {
      if (!lead.location || lead.location.trim().length === 0) {
        return false; // Exclude companies with no location
      }

      const companyLocation = lead.location.toLowerCase();

      // Check if the company's location contains the requested location
      // This allows for partial matches (e.g., "New York" matches "New York, USA")
      return companyLocation.includes(requestedLocation);
    });

    console.log(
      `Filtered by location "${location}": ${filteredLeads.length} out of ${allLeads.length} companies`
    );

    res.json({
      leads: filteredLeads,
      total: filteredLeads.length,
      totalAvailable: totalResultsEstimate,
      queriesUsed: queryVariation + 1,
    });
  } catch (error) {
    console.error(
      "Error fetching leads:",
      error.response ? error.response.data : error.message
    );
    res.status(500).json({
      error: "Failed to fetch leads",
      details: error.response?.data || error.message,
    });
  }
});

app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
