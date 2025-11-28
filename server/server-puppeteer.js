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
  res.send("LinkedIn Lead Search API is running (Puppeteer Mode)");
});

app.get("/api/leads", async (req, res) => {
  const { businessType, location, industry } = req.query;

  if (!businessType || !location) {
    return res
      .status(400)
      .json({ error: "Business Type and Location are required" });
  }

  // Construct optimized Google search query
  let queryParts = [];

  // Lead with location for better geographic targeting
  queryParts.push(location.trim());

  // Add business type
  if (businessType.trim()) {
    queryParts.push(businessType.trim());
  }

  // Add industry if provided
  if (industry && industry.trim()) {
    queryParts.push(industry.trim());
  }

  // Add "company" instead of "companies" for better results
  queryParts.push("company");

  // LinkedIn site restriction at the end
  queryParts.push("site:linkedin.com/company");

  const query = queryParts.join(" ");

  console.log("Optimized Search Query:", query);
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
    const maxPages = 10;

    // Set headers for Server-Sent Events (SSE) to stream results
    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "keep-alive");

    // Helper function to send progressive updates
    const sendUpdate = (data) => {
      res.write(`data: ${JSON.stringify(data)}\n\n`);
    };

    console.log("Launching browser...");
    const browser = await puppeteer.launch({
      headless: true, // Changed to true to run in background
      args: [
        "--no-sandbox",
        "--disable-setuid-sandbox",
        "--disable-blink-features=AutomationControlled",
        "--disable-web-security",
      ],
    });

    const page = await browser.newPage();

    // Better anti-detection
    await page.evaluateOnNewDocument(() => {
      Object.defineProperty(navigator, "webdriver", {
        get: () => false,
      });
    });

    // Set realistic user agent
    await page.setUserAgent(
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
    );

    // Set viewport
    await page.setViewport({ width: 1920, height: 1080 });

    const searchUrl = `https://www.google.com/search?q=${encodeURIComponent(
      query
    )}`;

    console.log("Scraping Google search results...");

    for (let pageNum = 0; pageNum < maxPages; pageNum++) {
      try {
        const url =
          pageNum === 0 ? searchUrl : `${searchUrl}&start=${pageNum * 10}`;

        console.log(`\nFetching page ${pageNum + 1}...`);
        console.log(`URL: ${url}`);
        await page.goto(url, { waitUntil: "networkidle2", timeout: 30000 });

        // Wait a bit for page to fully load
        await new Promise((resolve) => setTimeout(resolve, 2000));

        // Extract search results with multiple selector strategies
        const results = await page.evaluate(() => {
          const items = [];

          // Try multiple selectors for search results
          let searchResults = document.querySelectorAll(".g");

          // Fallback to other possible selectors
          if (searchResults.length === 0) {
            searchResults = document.querySelectorAll(
              "div[data-sokoban-container]"
            );
          }

          if (searchResults.length === 0) {
            searchResults = document.querySelectorAll("[jscontroller]");
          }

          console.log("Found", searchResults.length, "search result elements");

          searchResults.forEach((result, idx) => {
            // Try multiple ways to find the link and title
            let linkElement = result.querySelector("a[href]");
            let titleElement = result.querySelector("h3");

            // Alternative selectors
            if (!titleElement) {
              titleElement = result.querySelector('[role="heading"]');
            }

            if (linkElement && titleElement) {
              const link = linkElement.href;
              const title =
                titleElement.innerText || titleElement.textContent || "";

              // Only include LinkedIn company pages
              if (link && link.includes("linkedin.com/company")) {
                // Try to find snippet text
                let snippet = "";
                const snippetElement = result.querySelector(
                  ".VwiC3b, .yXK7lf, .s, .lEBKkf, .IsZvec, [data-sncf]"
                );
                if (snippetElement) {
                  snippet =
                    snippetElement.innerText ||
                    snippetElement.textContent ||
                    "";
                }

                items.push({
                  title: title,
                  link: link,
                  snippet: snippet,
                  displayLink: "linkedin.com",
                });
              }
            }
          });

          return items;
        });

        console.log(
          `Page ${pageNum + 1}: Found ${
            results.length
          } LinkedIn company results`
        );

        if (results.length === 0) {
          console.log("No more results found, stopping...");
          break;
        }

        // Process each result - FAST logo generation without async calls
        const leads = results.map((item) => {
          let companyName = "";
          let subtitle = "";
          let extractedIndustry = "";
          let companySize = "";
          let companyLocation = "";

          // Extract company name from title
          const titleMatch = item.title.match(/^([^-:|]+)/);
          if (titleMatch) {
            companyName = titleMatch[1].trim();
          }

          // Extract subtitle/industry from title
          const subtitleMatch = item.title.match(/[-:|](.+?)(?:\s*-\s*|\||$)/);
          if (subtitleMatch) {
            subtitle = subtitleMatch[1].trim();
          }

          // Extract industry from snippet
          const industryPatterns = [
            /Industry[:\s]+([^·•\n|]+)/i,
            /Sector[:\s]+([^·•\n|]+)/i,
          ];

          for (const pattern of industryPatterns) {
            const match = item.snippet.match(pattern);
            if (match) {
              extractedIndustry = match[1].replace(/[·•]/g, "").trim();
              break;
            }
          }

          // Extract company size
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

          // Extract location
          const locationPatterns = [
            /(?:Headquarters|Location)[:\s]+([^·•\n|]{2,})/i,
            /Based\s+in[:\s]+([^·•\n|]{2,})/i,
          ];

          for (const pattern of locationPatterns) {
            const match = item.snippet.match(pattern);
            if (match) {
              let loc = match[1]?.trim();
              if (loc) {
                loc = loc
                  .replace(/[·•]/g, "")
                  .replace(/\s+/g, " ")
                  .replace(/\.\.\.$/, "")
                  .trim();

                loc = loc.split(/[|;]/)[0].trim();

                if (loc.endsWith(".") && loc.length > 4) {
                  loc = loc.slice(0, -1).trim();
                }

                if (loc.length >= 2) {
                  companyLocation = loc;
                  break;
                }
              }
            }
          }

          if (!companyLocation) {
            companyLocation = "";
          }

          // FAST logo generation - instant URL construction, no API calls
          let logo = null;
          let logoFallback = null;

          if (item.link) {
            const urlMatch = item.link.match(
              /linkedin\.com\/company\/([^/?]+)/
            );
            if (urlMatch) {
              const companySlug = urlMatch[1];

              // Strategy: Use company name to guess domain for Clearbit
              const cleanName = companyName
                .toLowerCase()
                .replace(/[^a-z0-9\s]/g, "")
                .replace(/\s+/g, "")
                .replace(/ltd|pvt|inc|corp|llc|limited|private|company/g, "");

              // Primary: Clearbit (instant, no API call, good quality)
              logo = `https://logo.clearbit.com/${cleanName}.com`;

              // Fallback chain: DuckDuckGo favicon (more reliable than Google)
              logoFallback = `https://icons.duckduckgo.com/ip3/${cleanName}.com.ico`;
            }
          }

          return {
            companyName,
            industry: extractedIndustry || subtitle,
            companySize,
            location: companyLocation,
            title: item.title,
            link: item.link,
            snippet: item.snippet,
            logo: logo,
            logoFallback: logoFallback,
            displayLink: item.displayLink,
          };
        });

        // Remove duplicates by both link AND company name
        const existingLinks = new Set(allLeads.map((lead) => lead.link));
        const existingNames = new Set(
          allLeads.map((lead) => lead.companyName.toLowerCase().trim())
        );

        const newLeads = leads.filter((lead) => {
          const isDuplicateLink = existingLinks.has(lead.link);
          const isDuplicateName = existingNames.has(
            lead.companyName.toLowerCase().trim()
          );
          return !isDuplicateLink && !isDuplicateName;
        });

        if (newLeads.length > 0) {
          allLeads.push(...newLeads);
          console.log(
            `Added ${newLeads.length} new unique leads. Total: ${allLeads.length}`
          );

          // Send progressive update every 2 pages (approximately 20 results)
          if ((pageNum + 1) % 2 === 0 || pageNum === 0) {
            // Filter leads before sending
            const requestedLocation = location.trim().toLowerCase();
            const filteredLeads = allLeads.filter((lead) => {
              if (!lead.location || lead.location.trim().length === 0) {
                return true;
              }
              const companyLocation = lead.location.toLowerCase();
              const locationWords = requestedLocation.split(/\s+/);
              const companyWords = companyLocation.split(/\s+/);
              return locationWords.some((word) =>
                companyWords.some(
                  (compWord) =>
                    compWord.includes(word) || word.includes(compWord)
                )
              );
            });

            sendUpdate({
              type: "progress",
              leads: filteredLeads,
              total: filteredLeads.length,
              totalAvailable: allLeads.length,
              page: pageNum + 1,
            });
          }
        }

        // Add delay between requests (2-3 seconds)
        if (pageNum < maxPages - 1) {
          const delay = 2000 + Math.random() * 1000;
          console.log(`Waiting ${Math.round(delay)}ms before next page...`);
          await new Promise((resolve) => setTimeout(resolve, delay));
        }
      } catch (pageError) {
        console.error(`Error on page ${pageNum + 1}:`, pageError.message);
        break;
      }
    }

    await browser.close();
    console.log(`Total unique leads found: ${allLeads.length}`);

    // Final filtering
    const requestedLocation = location.trim().toLowerCase();
    let filteredLeads;

    if (requestedLocation) {
      filteredLeads = allLeads.filter((lead) => {
        if (!lead.location || lead.location.trim().length === 0) {
          return true;
        }
        const companyLocation = lead.location.toLowerCase();
        const locationWords = requestedLocation.split(/\s+/);
        const companyWords = companyLocation.split(/\s+/);
        return locationWords.some((word) =>
          companyWords.some(
            (compWord) => compWord.includes(word) || word.includes(compWord)
          )
        );
      });
    } else {
      filteredLeads = allLeads;
    }

    console.log(
      `Filtered by location "${location}": ${filteredLeads.length} out of ${allLeads.length} companies`
    );

    // Send final complete results
    sendUpdate({
      type: "complete",
      leads: filteredLeads,
      total: filteredLeads.length,
      totalAvailable: allLeads.length,
      queriesUsed: 1,
    });

    res.end();
  } catch (error) {
    console.error("Error scraping leads:", error.message);
    res.status(500).json({
      error: "Failed to scrape leads",
      details: error.message,
    });
  }
});

app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT} (Puppeteer Mode - Free)`);
});
