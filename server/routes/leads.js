const express = require("express");
const { PrismaClient } = require("@prisma/client");
const { authenticateToken } = require("../middleware/auth");

const router = express.Router();
const prisma = new PrismaClient();

// GET /api/leads/history - Get user's search history
router.get("/history", authenticateToken, async (req, res) => {
  try {
    const searches = await prisma.search.findMany({
      where: { userId: req.user.id },
      orderBy: { createdAt: "desc" },
      take: 50, // Last 50 searches
    });

    res.json({
      success: true,
      searches,
    });
  } catch (error) {
    console.error("Get search history error:", error);
    res.status(500).json({ error: "Failed to get search history" });
  }
});

// GET /api/leads/saved - Get user's saved leads
router.get("/saved", authenticateToken, async (req, res) => {
  try {
    const savedLeads = await prisma.savedLead.findMany({
      where: { userId: req.user.id },
      orderBy: { savedAt: "desc" },
    });

    res.json({
      success: true,
      leads: savedLeads,
    });
  } catch (error) {
    console.error("Get saved leads error:", error);
    res.status(500).json({ error: "Failed to get saved leads" });
  }
});

// POST /api/leads/save - Save a lead
router.post("/save", authenticateToken, async (req, res) => {
  try {
    const { leadData, leadType, searchId } = req.body;

    if (!leadData || !leadType) {
      return res.status(400).json({ error: "Lead data and type are required" });
    }

    // Check if lead already saved (by profileLink for LinkedIn, or businessName+address for business)
    let existingLead;
    if (leadType === "people") {
      existingLead = await prisma.savedLead.findFirst({
        where: {
          userId: req.user.id,
          profileLink: leadData.profileLink,
        },
      });
    } else {
      existingLead = await prisma.savedLead.findFirst({
        where: {
          userId: req.user.id,
          businessName: leadData.name,
          address: leadData.address,
        },
      });
    }

    if (existingLead) {
      return res.status(409).json({ error: "Lead already saved" });
    }

    // Prepare data based on lead type
    let saveData = {
      userId: req.user.id,
      searchId: searchId || null, // Use null instead of empty string for foreign key
      leadType,
    };

    if (leadType === "people") {
      saveData = {
        ...saveData,
        personName: leadData.personName,
        jobTitle: leadData.jobTitle,
        company: leadData.company,
        location: leadData.location,
        profileLink: leadData.profileLink,
        snippet: leadData.snippet,
        email: leadData.email || null,
      };
    } else {
      saveData = {
        ...saveData,
        businessName: leadData.name,
        address: leadData.address,
        phone: leadData.phone,
        email: leadData.email,
        website: leadData.website,
        rating:
          leadData.rating && leadData.rating !== "-"
            ? parseFloat(leadData.rating)
            : null,
        totalRatings: leadData.totalRatings,
        lastReview: leadData.lastReview,
        googleMapsLink: leadData.googleMapsLink,
        ownerName: leadData.ownerName,
        description: leadData.description,
        category: leadData.category,
        searchDate: leadData.searchDate ? new Date(leadData.searchDate) : null,
      };
    }

    // Save lead
    const savedLead = await prisma.savedLead.create({
      data: saveData,
    });

    res.json({
      success: true,
      message: "Lead saved successfully",
      lead: savedLead,
    });
  } catch (error) {
    console.error("Save lead error:", error);
    res.status(500).json({ error: "Failed to save lead" });
  }
});

// DELETE /api/leads/saved/:id - Delete a saved lead
router.delete("/saved/:id", authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;

    // Verify lead belongs to user
    const lead = await prisma.savedLead.findUnique({
      where: { id },
    });

    if (!lead) {
      return res.status(404).json({ error: "Lead not found" });
    }

    if (lead.userId !== req.user.id) {
      return res.status(403).json({ error: "Unauthorized" });
    }

    await prisma.savedLead.delete({
      where: { id },
    });

    res.json({
      success: true,
      message: "Lead deleted successfully",
    });
  } catch (error) {
    console.error("Delete saved lead error:", error);
    res.status(500).json({ error: "Failed to delete lead" });
  }
});

// DELETE /api/leads/history/:id - Delete a search from history
router.delete("/history/:id", authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;

    // Verify search belongs to user
    const search = await prisma.search.findUnique({
      where: { id },
    });

    if (!search) {
      return res.status(404).json({ error: "Search not found" });
    }

    if (search.userId !== req.user.id) {
      return res.status(403).json({ error: "Unauthorized" });
    }

    await prisma.search.delete({
      where: { id },
    });

    res.json({
      success: true,
      message: "Search deleted successfully",
    });
  } catch (error) {
    console.error("Delete search error:", error);
    res.status(500).json({ error: "Failed to delete search" });
  }
});

module.exports = router;
