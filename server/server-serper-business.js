const express = require("express");
const cors = require("cors");
const axios = require("axios");
require("dotenv").config();

const app = express();
const PORT = 3001;

app.use(cors());
app.use(express.json());

const SERPER_API_KEY = process.env.SERPER_API_KEY;

// Basic health check
app.get("/", (req, res) => {
  res.send("Business Lead Search API is running (Serper Google Maps API)");
});

app.get("/api/business-leads", async (req, res) => {
  const { businessType, location } = req.query;

  if (!businessType || !location) {
    return res
      .status(400)
      .json({ error: "Business Type and Location are required" });
  }

  console.log("\n=== Business Search (Serper Maps API) ===");
  console.log("Business Type:", businessType);
  console.log("Location:", location);

  try {
    const allBusinesses = [];

    // Set headers for Server-Sent Events (SSE)
    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "keep-alive");

    // Helper function to send progressive updates
    const sendUpdate = (data) => {
      res.write(`data: ${JSON.stringify(data)}\n\n`);
    };

    console.log("\nFetching businesses from Google Maps...");

    try {
      // Use Serper's Google Maps search endpoint
      const response = await axios.post(
        "https://google.serper.dev/maps",
        {
          q: `${businessType} in ${location}`,
          limit: 20, // Maximum results
        },
        {
          headers: {
            "X-API-KEY": SERPER_API_KEY,
            "Content-Type": "application/json",
          },
        }
      );

      const places = response.data.places || [];
      console.log(`Found ${places.length} businesses from Google Maps`);

      if (places.length === 0) {
        console.log("No businesses found.");
      }

      // Keywords to filter out educational institutions
      const excludeKeywords = [
        "college",
        "university",
        "school",
        "institute",
        "academy",
        "education",
        "campus",
        "iit",
        "nit",
        "iim",
        "polytechnic",
        "vidyalaya",
        "vidyapeeth",
        "vishwavidyalaya",
        "medical college",
      ];

      // Process each place
      for (const place of places) {
        try {
          // Filter out educational institutions
          const title = place.title?.toLowerCase() || "";
          const category = place.category?.toLowerCase() || "";
          const type = place.type?.toLowerCase() || "";

          const isEducational = excludeKeywords.some(
            (keyword) =>
              title.includes(keyword) ||
              category.includes(keyword) ||
              type.includes(keyword)
          );

          if (isEducational) {
            console.log(`  ⚠️  Skipped (Educational): ${place.title}`);
            continue;
          }

          // Extract business information
          const business = {
            name: place.title || "Unknown",
            address: place.address || "-",
            phone: place.phoneNumber || place.phone || "-",
            website: place.website || "-",
            rating: place.rating || "-",
            totalRatings: place.ratingCount || "-",
            businessStatus: "OPERATIONAL",
            location: location,
            placeId: place.placeId || "",
            googleMapsLink: place.cid
              ? `https://www.google.com/maps?cid=${place.cid}`
              : place.link ||
                `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
                  place.title + " " + place.address
                )}`,
            category: place.category || place.type || "-",
            hours: place.hours || "-",
          };

          allBusinesses.push(business);
          console.log(`  ✅ Added: ${business.name}`);
        } catch (detailError) {
          console.error(`  ❌ Error processing place:`, detailError.message);
        }
      }

      // Send progressive update
      if (allBusinesses.length > 0) {
        sendUpdate({
          type: "progress",
          leads: allBusinesses,
          total: allBusinesses.length,
          page: 1,
        });
      }
    } catch (apiError) {
      console.error("Error fetching from Maps API:", apiError.message);
      if (apiError.response) {
        console.error("Response status:", apiError.response.status);
        console.error(
          "Response data:",
          JSON.stringify(apiError.response.data, null, 2)
        );
      }

      // If API key is invalid (401), report it
      if (apiError.response?.status === 401) {
        console.error("Invalid API key. Please check SERPER_API_KEY in .env");
      }

      // If rate limited (429), report it
      if (apiError.response?.status === 429) {
        console.error("Rate limited. Please wait before trying again.");
      }
    }

    console.log("\n=== Search Complete ===");
    console.log(`Total businesses found: ${allBusinesses.length}`);

    // Send final complete results
    sendUpdate({
      type: "complete",
      leads: allBusinesses,
      total: allBusinesses.length,
    });

    res.end();
  } catch (error) {
    console.error("Error fetching business leads:", error.message);
    res.write(
      `data: ${JSON.stringify({
        type: "error",
        error: "Failed to fetch business leads",
        details: error.message,
      })}\n\n`
    );
    res.end();
  }
});

app.listen(PORT, () => {
  console.log(
    `Business Search Server running on port ${PORT} (Serper Google Maps API)`
  );
  console.log(`Serper API Key configured: ${SERPER_API_KEY ? "Yes" : "No"}`);
});
