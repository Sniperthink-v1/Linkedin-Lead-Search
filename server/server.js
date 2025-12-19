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

// Cache for complete search results (including Serper data)
const resultsCache = new Map();
const RESULTS_CACHE_TTL = 60 * 60 * 1000; // 1 hour
const MAX_RESULTS_CACHE_SIZE = 200;

// In-memory cache for pin codes (reduces database calls)
const pinCodeCache = new Map();
const PINCODE_CACHE_TTL = 24 * 60 * 60 * 1000; // 24 hours (pin codes don't change often)
const MAX_PINCODE_CACHE_SIZE = 1000; // Support up to 1000 cities in memory

/**
 * Retry helper with exponential backoff for Gemini API calls
 * Handles 503 Service Unavailable errors with automatic retry and fallback models
 * @param {Object} model - The Gemini model instance
 * @param {string} prompt - The prompt to send
 * @param {Object} options - Retry configuration
 * @param {number} options.maxRetries - Maximum number of retry attempts (default: 3)
 * @param {number} options.initialDelay - Initial delay in ms (default: 1000)
 * @param {Array<string>} options.fallbackModels - Array of fallback model names to try
 * @returns {Promise} - The result from generateContent
 */
async function generateWithRetry(model, prompt, options = {}) {
  const {
    maxRetries = 3,
    initialDelay = 2000,
    fallbackModels = ["gemini-1.5-flash-latest", "gemini-1.5-flash-8b-latest"],
  } = options;

  let lastError;
  const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

  // Try primary model with retries
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      console.log(
        `🤖 Gemini API call (attempt ${attempt + 1}/${maxRetries})...`
      );
      const result = await model.generateContent(prompt);
      console.log(`✅ Gemini API call successful`);
      return result;
    } catch (error) {
      lastError = error;
      const errorMessage = error.message || String(error);

      // Check if it's a 503 or overload error
      if (
        errorMessage.includes("503") ||
        errorMessage.toLowerCase().includes("overload") ||
        errorMessage.toLowerCase().includes("temporarily unavailable") ||
        errorMessage.toLowerCase().includes("resource exhausted")
      ) {
        if (attempt < maxRetries - 1) {
          const waitTime = initialDelay * Math.pow(2, attempt);
          console.warn(
            `⚠️ Model overloaded (503). Retrying in ${waitTime}ms... (${
              attempt + 1
            }/${maxRetries})`
          );
          await new Promise((resolve) => setTimeout(resolve, waitTime));
          continue;
        } else {
          console.error(
            `❌ Primary model failed after ${maxRetries} attempts. Trying fallback models...`
          );
        }
      } else {
        // For non-503 errors, throw immediately
        throw error;
      }
    }
  }

  // Try fallback models if primary model failed
  for (const fallbackModelName of fallbackModels) {
    try {
      console.log(`🔄 Trying fallback model: ${fallbackModelName}...`);
      const fallbackModel = genAI.getGenerativeModel({
        model: fallbackModelName,
      });
      const result = await fallbackModel.generateContent(prompt);
      console.log(`✅ Fallback model ${fallbackModelName} succeeded`);
      return result;
    } catch (error) {
      console.error(
        `❌ Fallback model ${fallbackModelName} failed:`,
        error.message
      );
      lastError = error;
      continue;
    }
  }

  // All attempts failed
  console.error(
    `❌ All retry attempts and fallback models exhausted. Last error:`,
    lastError.message
  );
  throw new Error(
    `Gemini API unavailable after ${maxRetries} retries and ${fallbackModels.length} fallback attempts: ${lastError.message}`
  );
}

// Pin code database for major cities (no API calls needed)
const CITY_PIN_CODES = {
  // Delhi NCR
  delhi: [
    "110001",
    "110002",
    "110003",
    "110004",
    "110005",
    "110006",
    "110007",
    "110008",
    "110009",
    "110010",
    "110011",
    "110012",
    "110013",
    "110014",
    "110015",
    "110016",
    "110017",
    "110018",
    "110019",
    "110020",
    "110021",
    "110022",
    "110023",
    "110024",
    "110025",
    "110026",
    "110027",
    "110028",
    "110029",
    "110030",
    "110031",
    "110032",
    "110033",
    "110034",
    "110035",
    "110036",
    "110037",
    "110038",
    "110039",
    "110040",
    "110041",
    "110042",
    "110043",
    "110044",
    "110045",
    "110046",
    "110047",
    "110048",
    "110049",
    "110051",
    "110052",
    "110053",
    "110054",
    "110055",
    "110056",
    "110057",
    "110058",
    "110059",
    "110060",
    "110061",
    "110062",
    "110063",
    "110064",
    "110065",
    "110066",
    "110067",
    "110068",
    "110069",
    "110070",
    "110071",
    "110072",
    "110073",
    "110074",
    "110075",
    "110076",
    "110077",
    "110078",
    "110080",
    "110081",
    "110082",
    "110083",
    "110084",
    "110085",
    "110086",
    "110087",
    "110088",
    "110089",
    "110090",
    "110091",
    "110092",
    "110093",
    "110094",
    "110095",
    "110096",
  ],
  "new delhi": ["110001", "110002", "110003", "110011", "110021"],
  noida: [
    "201301",
    "201302",
    "201303",
    "201304",
    "201305",
    "201306",
    "201307",
    "201308",
    "201309",
    "201310",
  ],
  gurgaon: [
    "122001",
    "122002",
    "122003",
    "122004",
    "122005",
    "122006",
    "122007",
    "122008",
    "122009",
    "122010",
    "122011",
    "122015",
    "122016",
    "122017",
    "122018",
    "122022",
  ],
  gurugram: [
    "122001",
    "122002",
    "122003",
    "122004",
    "122005",
    "122006",
    "122015",
    "122016",
    "122017",
    "122018",
  ],
  faridabad: [
    "121001",
    "121002",
    "121003",
    "121004",
    "121005",
    "121006",
    "121007",
    "121008",
    "121009",
    "121010",
  ],
  ghaziabad: [
    "201001",
    "201002",
    "201003",
    "201004",
    "201005",
    "201006",
    "201009",
    "201010",
    "201011",
    "201012",
  ],

  // Mumbai
  mumbai: [
    "400001",
    "400002",
    "400003",
    "400004",
    "400005",
    "400006",
    "400007",
    "400008",
    "400009",
    "400010",
    "400011",
    "400012",
    "400013",
    "400014",
    "400015",
    "400016",
    "400017",
    "400018",
    "400019",
    "400020",
    "400021",
    "400022",
    "400023",
    "400024",
    "400025",
    "400026",
    "400027",
    "400028",
    "400029",
    "400030",
    "400031",
    "400032",
    "400033",
    "400034",
    "400035",
    "400036",
    "400037",
    "400038",
    "400039",
    "400042",
    "400043",
    "400049",
    "400050",
    "400051",
    "400052",
    "400053",
    "400054",
    "400055",
    "400056",
    "400057",
    "400058",
    "400059",
    "400060",
    "400061",
    "400062",
    "400063",
    "400064",
    "400065",
    "400066",
    "400067",
    "400068",
    "400069",
    "400070",
    "400071",
    "400072",
    "400074",
    "400075",
    "400076",
    "400077",
    "400078",
    "400079",
    "400080",
    "400081",
    "400082",
    "400083",
    "400084",
    "400085",
    "400086",
    "400087",
    "400088",
    "400089",
    "400090",
    "400091",
    "400092",
    "400093",
    "400094",
    "400095",
    "400096",
    "400097",
    "400098",
    "400099",
    "400101",
    "400102",
    "400103",
    "400104",
    "400105",
  ],
  "navi mumbai": [
    "400701",
    "400702",
    "400703",
    "400704",
    "400705",
    "400706",
    "400707",
    "400708",
    "400709",
    "400710",
  ],
  thane: [
    "400601",
    "400602",
    "400603",
    "400604",
    "400605",
    "400606",
    "400607",
    "400608",
    "400609",
    "400610",
  ],

  // Bangalore
  bangalore: [
    "560001",
    "560002",
    "560003",
    "560004",
    "560005",
    "560006",
    "560007",
    "560008",
    "560009",
    "560010",
    "560011",
    "560012",
    "560013",
    "560014",
    "560015",
    "560016",
    "560017",
    "560018",
    "560019",
    "560020",
    "560021",
    "560022",
    "560023",
    "560024",
    "560025",
    "560026",
    "560027",
    "560028",
    "560029",
    "560030",
    "560032",
    "560033",
    "560034",
    "560035",
    "560036",
    "560037",
    "560038",
    "560039",
    "560040",
    "560041",
    "560042",
    "560043",
    "560045",
    "560046",
    "560047",
    "560048",
    "560049",
    "560050",
    "560051",
    "560052",
    "560053",
    "560054",
    "560055",
    "560056",
    "560057",
    "560058",
    "560059",
    "560060",
    "560061",
    "560062",
    "560063",
    "560064",
    "560065",
    "560066",
    "560067",
    "560068",
    "560069",
    "560070",
    "560071",
    "560072",
    "560073",
    "560074",
    "560075",
    "560076",
    "560077",
    "560078",
    "560079",
    "560080",
    "560083",
    "560084",
    "560085",
    "560086",
    "560087",
    "560091",
    "560092",
    "560093",
    "560094",
    "560095",
    "560096",
    "560097",
    "560098",
    "560099",
    "560100",
  ],
  bengaluru: [
    "560001",
    "560002",
    "560003",
    "560004",
    "560005",
    "560006",
    "560007",
    "560008",
    "560009",
    "560010",
  ],

  // Hyderabad
  hyderabad: [
    "500001",
    "500002",
    "500003",
    "500004",
    "500005",
    "500006",
    "500007",
    "500008",
    "500009",
    "500010",
    "500011",
    "500012",
    "500013",
    "500015",
    "500016",
    "500017",
    "500018",
    "500020",
    "500022",
    "500023",
    "500024",
    "500025",
    "500026",
    "500027",
    "500028",
    "500029",
    "500030",
    "500031",
    "500032",
    "500033",
    "500034",
    "500035",
    "500036",
    "500038",
    "500039",
    "500040",
    "500041",
    "500042",
    "500043",
    "500044",
    "500045",
    "500046",
    "500047",
    "500048",
    "500049",
    "500050",
    "500051",
    "500052",
    "500053",
    "500054",
    "500055",
    "500056",
    "500057",
    "500058",
    "500059",
    "500060",
    "500061",
    "500062",
    "500063",
    "500064",
    "500065",
    "500066",
    "500067",
    "500068",
    "500069",
    "500070",
    "500071",
    "500072",
    "500073",
    "500074",
    "500075",
    "500076",
    "500077",
    "500078",
    "500079",
    "500080",
    "500081",
    "500082",
    "500083",
    "500084",
    "500085",
    "500086",
    "500087",
    "500088",
    "500089",
    "500090",
    "500091",
    "500092",
    "500093",
    "500094",
    "500095",
    "500096",
    "500097",
    "500098",
  ],

  // Chennai
  chennai: [
    "600001",
    "600002",
    "600003",
    "600004",
    "600005",
    "600006",
    "600007",
    "600008",
    "600009",
    "600010",
    "600011",
    "600012",
    "600013",
    "600014",
    "600015",
    "600016",
    "600017",
    "600018",
    "600019",
    "600020",
    "600021",
    "600022",
    "600023",
    "600024",
    "600025",
    "600026",
    "600027",
    "600028",
    "600029",
    "600030",
    "600031",
    "600032",
    "600033",
    "600034",
    "600035",
    "600036",
    "600037",
    "600038",
    "600039",
    "600040",
    "600041",
    "600042",
    "600043",
    "600044",
    "600045",
    "600046",
    "600047",
    "600048",
    "600049",
    "600050",
    "600051",
    "600052",
    "600053",
    "600054",
    "600055",
    "600056",
    "600057",
    "600058",
    "600059",
    "600060",
    "600061",
    "600062",
    "600063",
    "600064",
    "600065",
    "600066",
    "600067",
    "600068",
    "600069",
    "600070",
    "600071",
    "600072",
    "600073",
    "600074",
    "600075",
    "600076",
    "600077",
    "600078",
    "600079",
    "600080",
    "600081",
    "600082",
    "600083",
    "600084",
    "600085",
    "600086",
    "600087",
    "600088",
    "600089",
    "600090",
    "600091",
    "600092",
    "600093",
    "600094",
    "600095",
    "600096",
    "600097",
    "600098",
    "600099",
    "600100",
  ],

  // Kolkata
  kolkata: [
    "700001",
    "700002",
    "700003",
    "700004",
    "700005",
    "700006",
    "700007",
    "700008",
    "700009",
    "700010",
    "700011",
    "700012",
    "700013",
    "700014",
    "700015",
    "700016",
    "700017",
    "700018",
    "700019",
    "700020",
    "700021",
    "700022",
    "700023",
    "700024",
    "700025",
    "700026",
    "700027",
    "700028",
    "700029",
    "700030",
    "700031",
    "700032",
    "700033",
    "700034",
    "700035",
    "700036",
    "700037",
    "700038",
    "700039",
    "700040",
    "700041",
    "700042",
    "700043",
    "700044",
    "700045",
    "700046",
    "700047",
    "700048",
    "700049",
    "700050",
    "700051",
    "700052",
    "700053",
    "700054",
    "700055",
    "700056",
    "700057",
    "700058",
    "700059",
    "700060",
    "700061",
    "700062",
    "700063",
    "700064",
    "700065",
    "700066",
    "700067",
    "700068",
    "700069",
    "700070",
    "700071",
    "700072",
    "700073",
    "700074",
    "700075",
    "700076",
    "700077",
    "700078",
    "700079",
    "700080",
    "700081",
    "700082",
    "700083",
    "700084",
    "700085",
    "700086",
    "700087",
    "700088",
    "700089",
    "700090",
    "700091",
    "700092",
    "700093",
    "700094",
    "700095",
    "700096",
    "700097",
    "700098",
    "700099",
    "700100",
  ],

  // Pune
  pune: [
    "411001",
    "411002",
    "411003",
    "411004",
    "411005",
    "411006",
    "411007",
    "411008",
    "411009",
    "411010",
    "411011",
    "411012",
    "411013",
    "411014",
    "411015",
    "411016",
    "411017",
    "411018",
    "411019",
    "411020",
    "411021",
    "411022",
    "411023",
    "411024",
    "411025",
    "411026",
    "411027",
    "411028",
    "411029",
    "411030",
    "411031",
    "411032",
    "411033",
    "411034",
    "411035",
    "411036",
    "411037",
    "411038",
    "411039",
    "411040",
    "411041",
    "411042",
    "411043",
    "411044",
    "411045",
    "411046",
    "411047",
    "411048",
  ],

  // Ahmedabad
  ahmedabad: [
    "380001",
    "380002",
    "380003",
    "380004",
    "380005",
    "380006",
    "380007",
    "380008",
    "380009",
    "380010",
    "380013",
    "380014",
    "380015",
    "380016",
    "380018",
    "380019",
    "380021",
    "380022",
    "380023",
    "380024",
    "380025",
    "380026",
    "380027",
    "380028",
    "380050",
    "380051",
    "380052",
    "380053",
    "380054",
    "380055",
  ],

  // Jaipur
  jaipur: [
    "302001",
    "302002",
    "302003",
    "302004",
    "302005",
    "302006",
    "302012",
    "302013",
    "302015",
    "302016",
    "302017",
    "302018",
    "302019",
    "302020",
    "302021",
    "302022",
    "302023",
    "302025",
    "302026",
    "302027",
    "302028",
    "302029",
    "302031",
    "302032",
    "302033",
    "302034",
    "302036",
    "302037",
    "302038",
    "302039",
  ],

  // Lucknow
  lucknow: [
    "226001",
    "226002",
    "226003",
    "226004",
    "226005",
    "226006",
    "226007",
    "226008",
    "226009",
    "226010",
    "226011",
    "226012",
    "226013",
    "226014",
    "226015",
    "226016",
    "226017",
    "226018",
    "226019",
    "226020",
    "226021",
    "226022",
    "226023",
    "226024",
    "226025",
    "226026",
    "226027",
    "226028",
    "226029",
    "226030",
  ],

  // Bhopal
  bhopal: [
    "462001",
    "462002",
    "462003",
    "462004",
    "462005",
    "462006",
    "462007",
    "462008",
    "462009",
    "462010",
    "462011",
    "462012",
    "462013",
    "462014",
    "462015",
    "462016",
    "462017",
    "462018",
    "462019",
    "462020",
    "462021",
    "462022",
    "462023",
    "462024",
    "462025",
    "462026",
    "462027",
    "462028",
    "462029",
    "462030",
  ],

  // Indore
  indore: [
    "452001",
    "452002",
    "452003",
    "452004",
    "452005",
    "452006",
    "452007",
    "452008",
    "452009",
    "452010",
    "452011",
    "452012",
    "452013",
    "452014",
    "452015",
    "452016",
    "452017",
    "452018",
    "452020",
  ],

  // Chandigarh
  chandigarh: [
    "160001",
    "160002",
    "160003",
    "160004",
    "160005",
    "160006",
    "160007",
    "160008",
    "160009",
    "160010",
    "160011",
    "160012",
    "160014",
    "160015",
    "160016",
    "160017",
    "160018",
    "160019",
    "160020",
    "160022",
    "160023",
    "160030",
  ],

  // Surat
  surat: [
    "395001",
    "395002",
    "395003",
    "395004",
    "395005",
    "395006",
    "395007",
    "395008",
    "395009",
    "395010",
    "395011",
    "395012",
    "395013",
    "395017",
  ],

  // Nagpur
  nagpur: [
    "440001",
    "440002",
    "440003",
    "440004",
    "440005",
    "440006",
    "440008",
    "440009",
    "440010",
    "440012",
    "440013",
    "440014",
    "440015",
    "440016",
    "440017",
    "440018",
    "440020",
    "440022",
    "440023",
    "440024",
  ],

  // Vadodara
  vadodara: [
    "390001",
    "390002",
    "390003",
    "390004",
    "390005",
    "390006",
    "390007",
    "390008",
    "390009",
    "390010",
    "390011",
    "390012",
    "390013",
    "390014",
    "390015",
    "390016",
    "390017",
    "390018",
    "390019",
    "390020",
  ],

  // Coimbatore
  coimbatore: [
    "641001",
    "641002",
    "641003",
    "641004",
    "641005",
    "641006",
    "641007",
    "641008",
    "641009",
    "641010",
    "641011",
    "641012",
    "641013",
    "641014",
    "641015",
    "641016",
    "641017",
    "641018",
    "641019",
    "641020",
  ],

  // Kochi
  kochi: [
    "682001",
    "682002",
    "682003",
    "682004",
    "682005",
    "682006",
    "682007",
    "682008",
    "682009",
    "682010",
    "682011",
    "682012",
    "682013",
    "682014",
    "682015",
    "682016",
    "682017",
    "682018",
    "682019",
    "682020",
  ],
  cochin: [
    "682001",
    "682002",
    "682003",
    "682004",
    "682005",
    "682006",
    "682007",
    "682008",
    "682009",
    "682010",
  ],

  // Visakhapatnam
  visakhapatnam: [
    "530001",
    "530002",
    "530003",
    "530004",
    "530005",
    "530006",
    "530007",
    "530008",
    "530009",
    "530010",
    "530011",
    "530012",
    "530013",
    "530014",
    "530015",
    "530016",
    "530017",
    "530018",
    "530019",
    "530020",
  ],
  vizag: [
    "530001",
    "530002",
    "530003",
    "530004",
    "530005",
    "530006",
    "530007",
    "530008",
    "530009",
    "530010",
  ],
};

// Helper function to get pin codes for a location (3-tier caching: memory → database → Gemini)
async function getPinCodesForLocation(location) {
  const locationLower = location.toLowerCase().trim();

  try {
    // TIER 1: Check in-memory cache first (fastest - ~0.1ms)
    const cachedPinCodes = pinCodeCache.get(locationLower);
    if (
      cachedPinCodes &&
      Date.now() - cachedPinCodes.timestamp < PINCODE_CACHE_TTL
    ) {
      console.log(
        `⚡ Pin codes from memory cache for "${location}" (${cachedPinCodes.data.length} codes)`
      );
      return cachedPinCodes.data.slice(0, 10).join(", ");
    }

    // TIER 2: Check database (fast - ~10-20ms)
    const cityRecord = await prisma.cityPinCode.findUnique({
      where: { city: locationLower },
    });

    if (cityRecord && cityRecord.pinCodes.length > 0) {
      console.log(
        `📍 Pin codes from database for "${location}" (${cityRecord.pinCodes.length} codes, source: ${cityRecord.source})`
      );

      // Cache in memory for future requests
      pinCodeCache.set(locationLower, {
        data: cityRecord.pinCodes,
        timestamp: Date.now(),
      });

      // Clean memory cache if too large
      if (pinCodeCache.size > MAX_PINCODE_CACHE_SIZE) {
        const oldestKeys = Array.from(pinCodeCache.entries())
          .sort((a, b) => a[1].timestamp - b[1].timestamp)
          .slice(0, 100)
          .map(([key]) => key);
        oldestKeys.forEach((key) => pinCodeCache.delete(key));
        console.log(
          `🧹 Cleaned ${oldestKeys.length} old entries from pin code cache`
        );
      }

      // Return first 10 pin codes for brevity in prompts
      return cityRecord.pinCodes.slice(0, 10).join(", ");
    }

    // If not in database, fetch dynamically using Gemini
    console.log(
      `🔍 Pin codes not found for "${location}" - fetching dynamically...`
    );

    const genAI = new GoogleGenerativeAI(GEMINI_API_KEY);
    const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash-exp" });

    // Common Indian states for detection
    const indianStates = [
      "andhra pradesh",
      "arunachal pradesh",
      "assam",
      "bihar",
      "chhattisgarh",
      "goa",
      "gujarat",
      "haryana",
      "himachal pradesh",
      "jharkhand",
      "karnataka",
      "kerala",
      "madhya pradesh",
      "maharashtra",
      "manipur",
      "meghalaya",
      "mizoram",
      "nagaland",
      "odisha",
      "punjab",
      "rajasthan",
      "sikkim",
      "tamil nadu",
      "telangana",
      "tripura",
      "uttar pradesh",
      "uttarakhand",
      "west bengal",
      "andaman and nicobar",
      "chandigarh",
      "dadra and nagar haveli",
      "daman and diu",
      "delhi",
      "jammu and kashmir",
      "ladakh",
      "lakshadweep",
      "puducherry",
    ];

    // Detect if location is a state or country
    const isState = indianStates.includes(locationLower);
    const isCountry = locationLower === "india";

    // Build prompt based on location type
    let pinCodePrompt;
    if (isCountry) {
      pinCodePrompt = `You are an Indian postal code expert. Return ONLY valid JSON with ALL pin code ranges for India.

Task: Provide the COMPLETE pin code ranges that cover ALL of India as assigned by India Post.

CRITICAL REQUIREMENTS:
- India Post uses a systematic 6-digit pin code system
- First digit (1-9) represents postal region
- First 2 digits represent sub-region/circle
- First 3 digits represent sorting district
- Return RANGES that cover ENTIRE India (110001-855126 or similar complete ranges)
- Each range should cover a major region or set of states
- Ensure NO gaps - every valid Indian pin code must be included
- Format: "XXXXXX-YYYYYY" for ranges

OFFICIAL INDIAN PIN CODE SYSTEM:
- 1XXXXX: Delhi, Haryana, Punjab, Himachal Pradesh, Jammu & Kashmir, Ladakh
- 2XXXXX: Uttar Pradesh, Uttarakhand
- 3XXXXX: Rajasthan, Gujarat, Daman & Diu, Dadra & Nagar Haveli
- 4XXXXX: Maharashtra, Madhya Pradesh, Chhattisgarh, Goa
- 5XXXXX: Andhra Pradesh, Telangana, Karnataka
- 6XXXXX: Tamil Nadu, Kerala, Puducherry, Lakshadweep
- 7XXXXX: West Bengal, Odisha, Assam, North East states
- 8XXXXX: Bihar, Jharkhand, Andaman & Nicobar

OUTPUT FORMAT (provide complete ranges):
{
  "pinCodeRanges": ["110001-136156", "140001-160104", "201001-285223", ...]
}

CRITICAL: Return COMPLETE ranges covering all of India. No markdown, no explanations.`;
    } else if (isState) {
      pinCodePrompt = `You are an Indian postal code expert. Return ONLY valid JSON with ALL pin code ranges for the state.

Task: Provide the COMPLETE pin code ranges assigned to "${location}", India by India Post.

CRITICAL REQUIREMENTS:
- Provide the FULL range of pin codes officially assigned to ${location}
- Use the EXACT starting and ending pin codes for ${location}
- Format: "XXXXXX-YYYYYY" (e.g., "452001-458999" for Indore region)
- Include ALL districts and cities within ${location}
- Ensure NO gaps - every pin code assigned to ${location} must be covered
- DO NOT include neighboring states' pin codes
- Return 5-15 ranges that COMPLETELY cover the entire state

EXAMPLES OF STATE RANGES:
- Madhya Pradesh: 450001-488448 (covers Indore, Bhopal, Gwalior, Jabalpur, etc.)
- Maharashtra: 400001-445402 (covers Mumbai, Pune, Nagpur, etc.)
- Karnataka: 560001-591346 (covers Bangalore, Mysore, Mangalore, etc.)

OUTPUT FORMAT (provide complete ranges for ${location}):
{
  "pinCodeRanges": ["XXXXXX-YYYYYY", "XXXXXX-YYYYYY", ...]
}

CRITICAL: Return OFFICIAL ranges assigned to ${location} by India Post. Cover ENTIRE state. No markdown, no explanations.`;
    } else {
      // City-level search (default)
      pinCodePrompt = `You are a pin code database. Return ONLY valid JSON with pin codes for the specified Indian city.

Task: Provide the most commonly used pin codes (postal codes) for "${location}", India.

REQUIREMENTS:
- Return 20-30 most commonly used pin codes for this city
- Pin codes must be valid 6-digit Indian postal codes
- Focus on major areas within the city
- Do NOT include pin codes from nearby cities or suburbs
- If this is not a valid Indian city, return empty array

OUTPUT FORMAT:
{
  "pinCodes": ["110001", "110002", "110003", ...]
}

CRITICAL: Valid JSON only. No markdown, no explanations.`;
    }

    console.log(
      `   📍 Detected location type: ${
        isCountry ? "Country" : isState ? "State" : "City"
      }`
    );

    const result = await generateWithRetry(model, pinCodePrompt, {
      maxRetries: 3,
      initialDelay: 2000,
      fallbackModels: ["gemini-1.5-flash-latest", "gemini-1.5-flash-8b-latest"],
    });
    const response = await result.response;
    let geminiText = response.text().trim();

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

    const pinCodeData = JSON.parse(geminiText);
    const locationType = isCountry ? "country" : isState ? "state" : "city";

    // Handle ranges (state/country) vs specific codes (city)
    const fetchedRanges = pinCodeData.pinCodeRanges || [];
    const fetchedPinCodes = pinCodeData.pinCodes || [];

    if (fetchedRanges.length > 0) {
      // State/Country: Store ranges
      console.log(
        `✅ Fetched ${fetchedRanges.length} pin code ranges for "${location}" (${locationType})`
      );
      console.log(
        `   Ranges: ${fetchedRanges.slice(0, 3).join(", ")}${
          fetchedRanges.length > 3 ? "..." : ""
        }`
      );

      // Save to database for persistence
      await prisma.cityPinCode.create({
        data: {
          city: locationLower,
          pinCodes: fetchedRanges, // Store ranges as strings
          source: `dynamic-${locationType}-ranges`,
        },
      });

      // Cache in memory for immediate reuse
      pinCodeCache.set(locationLower, {
        data: fetchedRanges,
        timestamp: Date.now(),
      });

      // Return all ranges as comma-separated string for prompt
      return fetchedRanges.join(", ");
    } else if (fetchedPinCodes.length > 0) {
      // City: Store specific codes
      console.log(
        `✅ Fetched and saved ${fetchedPinCodes.length} pin codes for "${location}" (${locationType}) to database + cache`
      );
      console.log(
        `   Sample pin codes: ${fetchedPinCodes.slice(0, 5).join(", ")}`
      );

      // Save to database for persistence
      await prisma.cityPinCode.create({
        data: {
          city: locationLower,
          pinCodes: fetchedPinCodes,
          source: `dynamic-${locationType}`,
        },
      });

      // Cache in memory for immediate reuse
      pinCodeCache.set(locationLower, {
        data: fetchedPinCodes,
        timestamp: Date.now(),
      });

      // Return first 10 pin codes for cities
      return fetchedPinCodes.slice(0, 10).join(", ");
    } else {
      console.log(`⚠️ No pin codes found for "${location}"`);
      return null;
    }
  } catch (error) {
    console.error(
      `❌ Failed to fetch pin codes for "${location}":`,
      error.message
    );

    // Fallback to static in-memory data if everything fails
    const pinCodes = CITY_PIN_CODES[locationLower];
    if (pinCodes && pinCodes.length > 0) {
      console.log(`⚠️ Using fallback static data for "${location}"`);

      // Cache it for next time
      pinCodeCache.set(locationLower, {
        data: pinCodes,
        timestamp: Date.now(),
      });

      return pinCodes.slice(0, 10).join(", ");
    }

    return null;
  }
}

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
  "https://leadfinder.sniperthink.com",
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

// Import credits routes
const creditsRoutes = require("./routes/credits");
app.use("/api/credits", creditsRoutes);

// Import admin routes
const adminRoutes = require("./routes/admin");
app.use("/api/admin", adminRoutes);

// Import credit utilities
const {
  calculateSearchCost,
  checkCredits,
  deductCredits,
} = require("./utils/credits");

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

  // Check if using cached results (skip credit check)
  const useCached = req.query.useCached === "true";

  // Upfront credit check (skip if using cached results)
  if (req.user?.id && !useCached) {
    try {
      // Estimate typical cost: 2 Serper calls + 3 Gemini calls = ~$0.0023
      const estimatedCost = 0.003; // Buffer for safety
      const creditCheck = await checkCredits(req.user.id, estimatedCost);

      if (!creditCheck.sufficient) {
        res.setHeader("Content-Type", "text/event-stream");
        res.setHeader("Cache-Control", "no-cache");
        res.setHeader("Connection", "keep-alive");

        res.write(
          `data: ${JSON.stringify({
            type: "error",
            error: "Insufficient credits",
            message: `You need at least $${estimatedCost.toFixed(
              4
            )} to perform this search. Current balance: $${creditCheck.currentBalance.toFixed(
              4
            )}. Please add credits to continue.`,
          })}\n\n`
        );
        res.end();
        return;
      }
      console.log(
        `✅ Credit check passed: $${creditCheck.currentBalance.toFixed(
          4
        )} available`
      );
    } catch (error) {
      console.error("Credit check failed:", error);
      res.setHeader("Content-Type", "text/event-stream");
      res.setHeader("Cache-Control", "no-cache");
      res.setHeader("Connection", "keep-alive");

      res.write(
        `data: ${JSON.stringify({
          type: "error",
          error: "Credit check failed",
          message: "Unable to verify credit balance. Please try again.",
        })}\n\n`
      );
      res.end();
      return;
    }
  }

  console.log("\n=== LinkedIn Search (Gemini + Serper Hybrid) ===");
  console.log("Business Type:", businessType);
  console.log("Location:", location);
  console.log("Industry:", industry || "N/A");
  console.log("User ID:", req.user?.id);

  let searchRecord = null;
  let excludePeopleNames = [];

  // Credit tracking
  let serperCallsCount = 0;
  let geminiCallsCount = 0;
  let creditDeducted = false;

  // Fetch previously seen people for this user (skip if using cached results)
  if (req.user?.id && !useCached) {
    try {
      const searchQuery = `${businessType}_${location}${
        industry ? "_" + industry : ""
      }`;

      const previousLeads = await prisma.userLeadHistory.findMany({
        where: {
          userId: req.user.id,
          leadType: "people",
          searchQuery: searchQuery,
        },
        select: {
          leadIdentifier: true,
        },
      });

      // Extract names from identifiers (format: linkedin_{name}_{profileLink})
      excludePeopleNames = previousLeads
        .map((lead) => {
          const match = lead.leadIdentifier.match(/^linkedin_(.+?)_http/);
          return match ? match[1] : null;
        })
        .filter((name) => name && name.length > 0);

      if (excludePeopleNames.length > 0) {
        console.log(
          `📋 Found ${excludePeopleNames.length} previously seen people to exclude`
        );
        console.log(
          `Sample exclusions: ${excludePeopleNames.slice(0, 3).join(", ")}`
        );
      }
    } catch (error) {
      console.error("Failed to fetch previous people:", error);
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

    // Create results cache key (needed for both checking and storing)
    const resultsCacheKey = `results:people:${businessType}:${location}:${
      industry || "all"
    }`;

    // Check if complete cached results exist
    const cachedResults = resultsCache.get(resultsCacheKey);
    const hasCachedResults =
      cachedResults && Date.now() - cachedResults.timestamp < RESULTS_CACHE_TTL;

    // Check if user wants cached complete results
    if (useCached) {
      if (hasCachedResults) {
        console.log(
          `⚡ Returning cached complete people results (${cachedResults.data.length} leads)`
        );
        sendUpdate({
          type: "complete",
          leads: cachedResults.data,
          total: cachedResults.data.length,
          message: `Loaded ${cachedResults.data.length} cached results instantly`,
        });
        res.end();
        return;
      } else {
        console.log(
          "❌ No cached people results found, proceeding with fresh search..."
        );
      }
    }

    if (!GEMINI_API_KEY) {
      throw new Error("GEMINI_API_KEY not configured");
    }
    if (!SERPER_API_KEY) {
      throw new Error("SERPER_API_KEY not configured");
    }

    // Step 1: Use Gemini AI to find names and roles
    console.log("\n[Step 1] Querying Gemini AI for LinkedIn profiles...");

    const genAI = new GoogleGenerativeAI(GEMINI_API_KEY);

    // Use gemini-2.0-flash-exp (current stable/experimental model)
    let model;
    let modelName = "gemini-2.0-flash-exp";

    model = genAI.getGenerativeModel({ model: modelName });

    console.log(`Using model: ${modelName}`);

    const industryText = industry ? ` in ${industry} industry` : "";

    // Extract core keywords from business type for strict matching
    const coreKeywords = businessType
      .split(/[\s,\/]+/)
      .filter((k) => k.length > 2)
      .map((k) => k.toLowerCase());
    const keywordList = coreKeywords.join('", "');

    const exclusionList =
      excludePeopleNames.length > 0
        ? `\n\n🚫 CRITICAL EXCLUSION LIST - DO NOT INCLUDE ANY OF THESE PEOPLE:\nThe following ${
            excludePeopleNames.length
          } people have ALREADY been provided to the user.\nYou MUST provide COMPLETELY DIFFERENT people. DO NOT repeat ANY of these names:\n${excludePeopleNames
            .slice(0, 50)
            .map((name, idx) => `${idx + 1}. ${name}`)
            .join("\n")}${
            excludePeopleNames.length > 50
              ? `\n...and ${
                  excludePeopleNames.length - 50
                } more names excluded.`
              : ""
          }\n\n⚠️ IMPORTANT: Find DIFFERENT professionals who have NOT been mentioned above.\nGenerate FRESH, UNIQUE names - not variations or similar names from the exclusion list.\n`
        : "";

    const geminiPrompt = `You MUST return ONLY valid JSON. No explanations, no markdown, no text - ONLY a JSON array.

Find ${requestedLeads} professionals whose CURRENT job title matches: "${businessType}"${industryText} in "${location}".

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

EMAIL REQUIREMENT:
- ONLY provide the professional/work email address if you KNOW it with certainty
- DO NOT generate, guess, or make up email addresses
- If you don't know the EXACT email, leave it as empty string ""
- Only include real, verified email addresses you are certain about
- Better to leave blank than to provide incorrect information

OUTPUT FORMAT - Return EXACTLY this JSON structure with ${requestedLeads} profiles:
[
  {"name": "Full Name", "role": "Job Title", "email": "professional@email.com or empty string if unknown"},
  {"name": "Full Name", "role": "Job Title", "email": "professional@email.com or empty string if unknown"}
]

Sort by: Principal/Staff → Senior/Lead → Mid-level → Junior
${
  excludePeopleNames.length > 0
    ? `\n🎯 DIVERSITY REQUIREMENT: Since ${excludePeopleNames.length} people are excluded, ensure you provide a DIVERSE set of NEW individuals.\nConsider: Different companies, different seniority levels, different specializations within the role.\nThis ensures the user gets maximum value from fresh results.`
    : ""
}

CRITICAL: Response MUST be valid JSON array with name, role, AND email fields. No text before or after. Start with [ and end with ]`;

    sendUpdate({
      type: "progress",
      leads: [],
      total: 0,
      page: 0,
      message: "Searching with Gemini AI...",
    });

    // Create cache key from search parameters
    // IMPORTANT: If we have exclusions, add timestamp to force fresh results
    const cacheKey =
      excludePeopleNames.length > 0
        ? `people:${businessType}:${location}:${
            industry || "all"
          }:${Date.now()}`
        : `people:${businessType}:${location}:${industry || "all"}`;

    // useCached already defined at the top of the function (line 1666)
    // No need to redeclare it here

    // If we have exclusions, force fresh Gemini call (skip cache)
    const geminiResult =
      excludePeopleNames.length > 0
        ? await (async () => {
            geminiCallsCount++; // Count the API call
            console.log(
              `🔄 Forcing fresh Gemini call due to ${excludePeopleNames.length} exclusions`
            );
            const result = await generateWithRetry(model, geminiPrompt, {
              maxRetries: 3,
              initialDelay: 2000,
              fallbackModels: [
                "gemini-1.5-flash-latest",
                "gemini-1.5-flash-8b-latest",
              ],
            });
            return { data: result, cacheHit: false };
          })()
        : await getCachedGeminiResponse(cacheKey, async () => {
            geminiCallsCount++; // Only count if not cached
            return await generateWithRetry(model, geminiPrompt, {
              maxRetries: 3,
              initialDelay: 2000,
              fallbackModels: [
                "gemini-1.5-flash-latest",
                "gemini-1.5-flash-8b-latest",
              ],
            });
          });

    // If cache hit and user hasn't chosen yet, AND we have complete cached results, ask them
    if (
      geminiResult.cacheHit &&
      hasCachedResults &&
      !useCached &&
      req.query.useCached !== "false"
    ) {
      console.log(
        "🔔 People search: Cache hit detected with complete results available, asking user for choice..."
      );
      sendUpdate({
        type: "cache-available",
        message:
          "You searched for this recently. Would you like cached results (instant) or fresh results (with deduplication)?",
      });
      res.end();
      return;
    }

    console.log(
      `📊 People search: Processing with useCached=${useCached}, cacheHit=${geminiResult.cacheHit}`
    );

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
        const searchQuery = `${businessType}_${location}${
          industry ? "_" + industry : ""
        }`;

        const previousLeads = await prisma.userLeadHistory.findMany({
          where: {
            userId: req.user.id,
            leadType: "people",
            searchQuery: searchQuery,
          },
          select: {
            leadIdentifier: true,
          },
        });

        previousPeopleIdentifiers = new Set(
          previousLeads.map((l) => l.leadIdentifier)
        );
        console.log(
          `📋 Loaded ${previousPeopleIdentifiers.size} previous people identifiers for real-time deduplication`
        );
      } catch (error) {
        console.error(
          "Failed to load previous people for deduplication:",
          error
        );
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
        serperCallsCount++; // Track Serper API call

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
            email: basicProfile.email || "",
          };

          // Check if this person was already provided to user (real-time deduplication)
          // Skip deduplication if using cached results
          const leadIdentifier = `linkedin_${basicProfile.name
            .toLowerCase()
            .trim()}_${result.link}`;

          if (!useCached && previousPeopleIdentifiers.has(leadIdentifier)) {
            console.log(
              `⚠️ Skipping duplicate person (already in user history): ${basicProfile.name}`
            );
            continue;
          }

          enrichedLeads.push(enrichedLead);

          // Save to database immediately (non-blocking) - skip if using cached results
          if (req.user?.id && !useCached) {
            prisma.userLeadHistory
              .create({
                data: {
                  userId: req.user.id,
                  leadIdentifier: leadIdentifier,
                  searchQuery: `${businessType}_${location}${
                    industry ? "_" + industry : ""
                  }`,
                  leadType: "people",
                },
              })
              .catch((err) => {
                // Silently ignore unique constraint errors (P2002)
                if (err.code !== "P2002") {
                  console.error("Failed to save lead to history:", err);
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
    // Cache complete results for future instant retrieval
    if (enrichedLeads.length > 0) {
      const resultsCacheKey = `results:people:${businessType}:${location}:${
        industry || "all"
      }`;

      resultsCache.set(resultsCacheKey, {
        data: enrichedLeads,
        timestamp: Date.now(),
      });
      console.log(
        `💾 Cached ${enrichedLeads.length} complete people results for instant retrieval`
      );

      // Clean old results cache if needed
      if (resultsCache.size > MAX_RESULTS_CACHE_SIZE) {
        const entriesToRemove = Math.floor(MAX_RESULTS_CACHE_SIZE * 0.2);
        const sortedEntries = Array.from(resultsCache.entries()).sort(
          (a, b) => a[1].timestamp - b[1].timestamp
        );
        for (let i = 0; i < entriesToRemove; i++) {
          resultsCache.delete(sortedEntries[i][0]);
        }
        console.log(`🧹 Cleaned ${entriesToRemove} old results cache entries`);
      }
    }

    // Deduct credits for API usage (only if not using cached complete results)
    if (!useCached && req.user?.id) {
      try {
        const costs = calculateSearchCost(serperCallsCount, geminiCallsCount);
        console.log(`\n💳 Credit Deduction:`);
        console.log(`   Serper calls: ${serperCallsCount}`);
        console.log(`   Gemini calls: ${geminiCallsCount}`);
        console.log(`   Actual cost: $${costs.actualCost}`);
        console.log(`   Charged cost: $${costs.chargedCost} (1.25x markup)`);

        await deductCredits(req.user.id, {
          amount: costs.chargedCost,
          type: "search",
          description: `LinkedIn people search: ${businessType} in ${location}`,
          searchType: "people",
          apiCostActual: costs.actualCost,
          apiCostCharged: costs.chargedCost,
          serperCalls: serperCallsCount,
          geminiCalls: geminiCallsCount,
          resultCount: enrichedLeads.length,
        });
        creditDeducted = true;
        console.log(`   ✅ Credits deducted successfully`);
      } catch (creditError) {
        console.error("Failed to deduct credits:", creditError);
        // Continue anyway - don't block the search results
      }
    }

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

// PIN CODES endpoint - View all cached pin codes from database with cache stats
app.get("/api/pincodes", authenticateToken, async (req, res) => {
  try {
    // Fetch all city pin codes from database
    const allCities = await prisma.cityPinCode.findMany({
      orderBy: { city: "asc" },
    });

    const pinCodeStats = allCities.map((record) => ({
      city: record.city,
      count: record.pinCodes.length,
      sample:
        record.pinCodes.slice(0, 3).join(", ") +
        (record.pinCodes.length > 3 ? "..." : ""),
      source: record.source,
      lastUpdated: record.updatedAt,
      inMemoryCache: pinCodeCache.has(record.city),
    }));

    // Count by source
    const staticCount = allCities.filter((c) => c.source === "static").length;
    const dynamicCount = allCities.filter((c) => c.source === "dynamic").length;

    // Memory cache stats
    const memoryCachedCities = Array.from(pinCodeCache.keys());

    res.json({
      success: true,
      totalCities: allCities.length,
      staticCities: staticCount,
      dynamicCities: dynamicCount,
      memoryCache: {
        size: pinCodeCache.size,
        maxSize: MAX_PINCODE_CACHE_SIZE,
        ttl: `${PINCODE_CACHE_TTL / (60 * 60 * 1000)} hours`,
        cities: memoryCachedCities,
      },
      cities: pinCodeStats,
      message:
        "3-tier caching: Memory (instant) → Database (fast) → Gemini API (first time only)",
    });
  } catch (error) {
    console.error("Error fetching pin codes:", error);
    res.status(500).json({
      success: false,
      error: "Failed to fetch pin codes",
      details: error.message,
    });
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

  // Check if using cached results (skip credit check)
  const useCached = req.query.useCached === "true";

  // Upfront credit check (skip if using cached results)
  if (req.user?.id && !useCached) {
    try {
      // Estimate typical cost: 2 Serper calls + 1 Gemini call = ~$0.0021
      const estimatedCost = 0.003; // Buffer for safety
      const creditCheck = await checkCredits(req.user.id, estimatedCost);

      if (!creditCheck.sufficient) {
        res.setHeader("Content-Type", "text/event-stream");
        res.setHeader("Cache-Control", "no-cache");
        res.setHeader("Connection", "keep-alive");

        res.write(
          `data: ${JSON.stringify({
            type: "error",
            error: "Insufficient credits",
            message: `You need at least $${estimatedCost.toFixed(
              4
            )} to perform this search. Current balance: $${creditCheck.currentBalance.toFixed(
              4
            )}. Please add credits to continue.`,
          })}\n\n`
        );
        res.end();
        return;
      }
      console.log(
        `✅ Credit check passed: $${creditCheck.currentBalance.toFixed(
          4
        )} available`
      );
    } catch (error) {
      console.error("Credit check failed:", error);
      res.setHeader("Content-Type", "text/event-stream");
      res.setHeader("Cache-Control", "no-cache");
      res.setHeader("Connection", "keep-alive");

      res.write(
        `data: ${JSON.stringify({
          type: "error",
          error: "Credit check failed",
          message: "Unable to verify credit balance. Please try again.",
        })}\n\n`
      );
      res.end();
      return;
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

  // Credit tracking
  let serperCallsCount = 0;
  let geminiCallsCount = 0;
  let creditDeducted = false;

  // Fetch previously seen business names for this user
  if (req.user?.id && !specificBusinessName) {
    try {
      const searchQuery = ownerName
        ? `owner_${ownerName}_${location}`
        : `${businessType}_${location}`;

      const previousLeads = await prisma.userLeadHistory.findMany({
        where: {
          userId: req.user.id,
          leadType: "business",
          searchQuery: {
            contains: ownerName ? `owner_${ownerName}` : businessType,
          },
        },
        select: {
          leadIdentifier: true,
        },
      });

      // Extract business names from identifiers (format: business_{name}_{location}_{contact})
      excludeBusinessNames = previousLeads
        .map((lead) => {
          const parts = lead.leadIdentifier.split("_");
          // Skip first element ('business') and reconstruct name
          const nameEndIndex = parts.length - 2; // exclude location and contact
          return parts.slice(1, nameEndIndex).join("_");
        })
        .filter((name) => name && name.length > 0);

      if (excludeBusinessNames.length > 0) {
        console.log(
          `📋 Found ${excludeBusinessNames.length} previously seen businesses to exclude`
        );
        console.log(
          `Sample exclusions: ${excludeBusinessNames.slice(0, 3).join(", ")}`
        );
      }
    } catch (error) {
      console.error("Failed to fetch previous businesses:", error);
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

  // Create results cache key (needed for both checking and storing)
  const resultsCacheKey = specificBusinessName
    ? `results:business:specific:${specificBusinessName}:${location}`
    : ownerName
    ? `results:business:owner:${ownerName}:${location}:${requestedLeads}`
    : `results:business:${businessType}:${location}:${requestedLeads}`;

  console.log(`\n🔍 CACHE DEBUG:`);
  console.log(`   Cache key: ${resultsCacheKey}`);
  console.log(`   useCached param: ${req.query.useCached}`);
  console.log(`   useCached boolean: ${req.query.useCached === "true"}`);
  console.log(`   Total keys in resultsCache: ${resultsCache.size}`);
  console.log(
    `   Available cache keys: ${Array.from(resultsCache.keys()).join(", ")}`
  );

  // Check if complete cached results exist
  const cachedResults = resultsCache.get(resultsCacheKey);
  const hasCachedResults =
    cachedResults && Date.now() - cachedResults.timestamp < RESULTS_CACHE_TTL;

  console.log(`   Cache hit: ${!!cachedResults}`);
  console.log(`   Cache valid: ${hasCachedResults}`);
  if (cachedResults) {
    console.log(
      `   Cache age: ${Math.floor(
        (Date.now() - cachedResults.timestamp) / 1000
      )}s`
    );
    console.log(`   Cached items: ${cachedResults.data.length}`);
  }

  // Check if user wants cached complete results (already declared above)

  if (useCached) {
    if (hasCachedResults) {
      console.log(
        `⚡ Returning cached complete results (${cachedResults.data.length} leads)`
      );
      sendUpdate({
        type: "complete",
        leads: cachedResults.data,
        total: cachedResults.data.length,
        message: `Loaded ${cachedResults.data.length} cached results instantly`,
      });
      res.end();
      return;
    } else {
      console.log(
        "❌ No cached results found, proceeding with fresh search..."
      );
    }
  }

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

    // Use gemini-2.0-flash-exp (current stable/experimental model)
    let model;
    let modelName = "gemini-2.0-flash-exp";

    model = genAI.getGenerativeModel({ model: modelName });

    console.log(`Using model: ${modelName}`);

    // Create different prompts based on search type
    let geminiPrompt;

    // Get pin codes for location (dynamically fetches if not in static data)
    // For states/country, this returns ranges (e.g., "452001-458999")
    // For cities, this returns specific codes (e.g., "452001, 452010")
    const locationPinCodes = await getPinCodesForLocation(location);
    const pinCodeInfo = locationPinCodes
      ? `\n- Pin codes/ranges for ${location}: ${locationPinCodes}\n- Use these pin code references in search queries for better location accuracy`
      : "";

    if (specificBusinessName) {
      // Specific business search - just return the search query
      geminiPrompt = `You are a search query generator. Return ONLY valid JSON with a Google Maps search query and concise business description.

Task: Generate ONE search query to find "${specificBusinessName}" in "${location}" on Google Maps.

CRITICAL BUSINESS STATUS REQUIREMENTS:
- The business MUST be currently active and operational
- DO NOT suggest closed, defunct, or out-of-business establishments
- DO NOT suggest historical businesses that no longer exist
- Only suggest businesses that are currently operating as of 2025
- If you're unsure about a business's current status, DO NOT include it

CRITICAL LOCATION REQUIREMENTS:
- The business MUST be physically located ONLY in ${location} - NO exceptions
- DO NOT include businesses from nearby cities, suburbs, or surrounding areas
- If ${location} is a city, ONLY that city - not the metro region or nearby towns
- The business address must contain EXACTLY "${location}" in the city field
- Search query must include exact location: "${location}"${pinCodeInfo}

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

EMAIL REQUIREMENT:
- ONLY provide the business email if you KNOW it with certainty (from their website or public records)
- DO NOT generate, guess, or make up email addresses
- If you don't know the EXACT email, leave it as empty string ""
- Only include real, verified business email addresses you are certain about
- Better to leave blank than to provide incorrect information

OUTPUT FORMAT:
{
  "searchQueries": ["${specificBusinessName} ${location}"],
  "descriptions": ["Concise 2-line description (max 200 chars) of services and specialization, or empty string if unknown"],
  "emails": ["verified@businessemail.com or empty string if you don't know it"]
}

CRITICAL: Valid JSON only. No markdown, no explanations, no additional text.`;
    } else if (ownerName) {
      // Owner name search - use direct search approach
      const exclusionList =
        excludeBusinessNames.length > 0
          ? `\n\n🚫 CRITICAL EXCLUSION LIST - DO NOT INCLUDE ANY OF THESE BUSINESSES:\nThe following ${
              excludeBusinessNames.length
            } businesses have ALREADY been provided to the user.\nYou MUST suggest COMPLETELY DIFFERENT businesses. DO NOT repeat ANY of these:\n${excludeBusinessNames
              .slice(0, 30)
              .map((name, idx) => `${idx + 1}. ${name}`)
              .join("\n")}${
              excludeBusinessNames.length > 30
                ? `\n...and ${
                    excludeBusinessNames.length - 30
                  } more businesses excluded.`
                : ""
            }\n\n⚠️ IMPORTANT: Suggest DIFFERENT businesses that are NOT in the above list.\nGenerate NEW, UNIQUE business names - avoid any variations of excluded businesses.\n`
          : "";

      geminiPrompt = `You are a search query generator. Return ONLY valid JSON with Google Maps search queries and concise descriptions.

Task: Generate ${requestedLeads} search queries to find businesses potentially owned or founded by "${ownerName}" in "${location}".

CRITICAL BUSINESS STATUS REQUIREMENTS:
- ALL businesses MUST be currently active and operational in 2025
- DO NOT suggest any closed, defunct, or out-of-business establishments
- DO NOT suggest businesses that have shut down, relocated, or ceased operations
- ONLY suggest businesses with confirmed recent activity or online presence
- If unsure about a business's current operational status, DO NOT include it${pinCodeInfo}
- Verify the business is still operating before including it

CRITICAL LOCATION REQUIREMENTS:
- Businesses MUST be physically located in ${location} ONLY - ZERO tolerance for nearby areas
- DO NOT include businesses from nearby cities, suburbs, metropolitan areas, or neighboring regions
- If ${location} is "Delhi", do NOT include Noida, Gurgaon, Faridabad, Ghaziabad, or any NCR cities
- If ${location} is "Mumbai", do NOT include Navi Mumbai, Thane, Kalyan, or any other cities
- The business address must contain EXACTLY "${location}" as the city name
- Each search query MUST include the EXACT location: "${location}"

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

EMAIL REQUIREMENT:
- ONLY provide the business email if you KNOW it with certainty (from their website or public records)
- DO NOT generate, guess, or make up email addresses
- If you don't know the EXACT email, leave it as empty string ""
- Only include real, verified business email addresses you are certain about
- Better to leave blank than to provide incorrect information

OUTPUT FORMAT:
{
  "searchQueries": [
    "verified business name 1 ${location}",
    "verified business name 2 ${location}"
  ],
  "descriptions": [
    "Concise 2-line description (max 200 chars) of services and specialization, or empty string if unknown",
    "Concise 2-line description (max 200 chars) of services and specialization, or empty string if unknown"
  ],
  "emails": [
    "verified@business1.com or empty string if you don't know it",
    "verified@business2.com or empty string if you don't know it"
  ]
}
${
  excludeBusinessNames.length > 0
    ? `\n🎯 DIVERSITY REQUIREMENT: Since ${excludeBusinessNames.length} businesses are excluded, provide a DIVERSE set of NEW businesses.\nConsider: Different owners, different areas within ${location}, different business models/specializations.\nThis ensures the user discovers fresh opportunities.`
    : ""
}

CRITICAL: Valid JSON only. If uncertain about any business, return fewer results or empty array. No markdown, no explanations.`;
    } else {
      // General business type search - generate search queries
      const exclusionList =
        excludeBusinessNames.length > 0
          ? `\n\n🚫 CRITICAL EXCLUSION LIST - DO NOT INCLUDE ANY OF THESE BUSINESSES:\nThe following ${
              excludeBusinessNames.length
            } businesses have ALREADY been provided to the user.\nYou MUST suggest COMPLETELY DIFFERENT businesses. DO NOT repeat ANY of these:\n${excludeBusinessNames
              .slice(0, 30)
              .map((name, idx) => `${idx + 1}. ${name}`)
              .join("\n")}${
              excludeBusinessNames.length > 30
                ? `\n...and ${
                    excludeBusinessNames.length - 30
                  } more businesses excluded.`
                : ""
            }\n\n⚠️ IMPORTANT: Find DIFFERENT businesses that are NOT in the above list.\nLook for OTHER establishments - not variations or branches of excluded businesses.\n`
          : "";

      geminiPrompt = `You are a search query generator. Return ONLY valid JSON with Google Maps search queries and concise descriptions.

Task: Generate ${requestedLeads} search queries to find well-established "${businessType}" businesses in "${location}".

CRITICAL BUSINESS STATUS REQUIREMENTS:
- ALL suggested businesses MUST be currently active and operational in 2025
- DO NOT suggest any closed, defunct, bankrupt, or permanently shut down businesses
- DO NOT suggest businesses that existed historically but no longer operate
- ONLY suggest businesses with confirmed recent activity, online presence, or customer reviews
- Verify each business is still operating before including it in results
- If you have ANY doubt about a business's current operational status, DO NOT include it
- Focus on well-established businesses with proven track records of continuous operation

CRITICAL LOCATION REQUIREMENTS:
- Businesses MUST be physically located in ${location} ONLY - ABSOLUTELY NO nearby areas
- DO NOT include businesses from nearby cities, suburbs, metropolitan regions, or neighboring towns${pinCodeInfo}
- ZERO tolerance for location variations:
  * If searching "Delhi", EXCLUDE: Noida, Gurgaon, Faridabad, Ghaziabad, Greater Noida, and ALL NCR cities
  * If searching "Mumbai", EXCLUDE: Navi Mumbai, Thane, Kalyan, Panvel, Vasai, and ALL MMR cities
  * If searching "Bangalore", EXCLUDE: Whitefield, Electronic City if they're listed as separate cities
- The business address must list ${location} EXACTLY as the city - not as part of a region
- Each search query MUST include the EXACT location: "${location}"
- When generating search queries, add city-specific identifiers (e.g., "in Delhi city", "central Mumbai")

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

EMAIL REQUIREMENT:
- ONLY provide the business email if you KNOW it with certainty (from their website or public records)
- DO NOT generate, guess, or make up email addresses
- If you don't know the EXACT email, leave it as empty string ""
- Only include real, verified business email addresses you are certain about
- Better to leave blank than to provide incorrect information

OUTPUT FORMAT:
{
  "searchQueries": [
    "real business name 1 ${location}",
    "real business name 2 ${location}"
  ],
  "descriptions": [
    "Concise 2-line description (max 200 chars) focusing on services and specialization. Empty string if unknown",
    "Concise 2-line description (max 200 chars) focusing on services and specialization. Empty string if unknown"
  ],
  "emails": [
    "verified@business1.com or empty string if you don't know it",
    "verified@business2.com or empty string if you don't know it"
  ]
}
${
  excludeBusinessNames.length > 0
    ? `\n🎯 DIVERSITY REQUIREMENT: Since ${excludeBusinessNames.length} businesses are excluded, provide a DIVERSE set of NEW businesses.\nConsider: Different neighborhoods/areas, different scales (small/medium/large), different specializations.\nHelp the user discover fresh businesses they haven't seen yet.`
    : ""
}

CRITICAL: Valid JSON only. Return ONLY businesses you are absolutely certain exist. No markdown, no explanations, no hallucinations.`;
    }

    // Log pin code info if available
    if (locationPinCodes) {
      console.log(`📍 Pin codes for ${location}: ${locationPinCodes}`);
      console.log(
        `   ℹ️ Pin codes added to Gemini prompt for better location accuracy`
      );
    } else {
      console.log(
        `ℹ️ No pin codes available for "${location}" - using location name only`
      );
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
    // IMPORTANT: If we have exclusions, add timestamp to force fresh results
    const baseCacheKey = specificBusinessName
      ? `business:specific:${specificBusinessName}:${location}`
      : ownerName
      ? `business:owner:${ownerName}:${location}:${requestedLeads}`
      : `business:${businessType}:${location}:${requestedLeads}`;

    const cacheKey =
      excludeBusinessNames.length > 0
        ? `${baseCacheKey}:${Date.now()}`
        : baseCacheKey;

    // Check if user explicitly wants cached results
    const useCached = req.query.useCached === "true";

    // If we have exclusions, force fresh Gemini call (skip cache)
    const geminiResult =
      excludeBusinessNames.length > 0
        ? await (async () => {
            geminiCallsCount++; // Count the API call
            console.log(
              `🔄 Forcing fresh Gemini call due to ${excludeBusinessNames.length} exclusions`
            );
            const result = await generateWithRetry(model, geminiPrompt, {
              maxRetries: 3,
              initialDelay: 2000,
              fallbackModels: [
                "gemini-1.5-flash-latest",
                "gemini-1.5-flash-8b-latest",
              ],
            });
            return { data: result, cacheHit: false };
          })()
        : await getCachedGeminiResponse(cacheKey, async () => {
            geminiCallsCount++; // Only count if not cached
            return await generateWithRetry(model, geminiPrompt, {
              maxRetries: 3,
              initialDelay: 2000,
              fallbackModels: [
                "gemini-1.5-flash-latest",
                "gemini-1.5-flash-8b-latest",
              ],
            });
          });

    // If cache hit and user hasn't chosen yet, AND we have complete cached results, ask them
    if (
      geminiResult.cacheHit &&
      hasCachedResults &&
      !useCached &&
      req.query.useCached !== "false"
    ) {
      console.log(
        "🔔 Business search: Cache hit detected with complete results available, asking user for choice..."
      );
      sendUpdate({
        type: "cache-available",
        message:
          "You searched for this recently. Would you like cached results (instant) or fresh results (with deduplication)?",
      });
      res.end();
      return;
    }

    console.log(
      `📊 Business search: Processing with useCached=${useCached}, cacheHit=${geminiResult.cacheHit}`
    );

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

    // Parse Gemini response to get search queries, descriptions, and emails
    const searchQueriesData = JSON.parse(geminiText);
    const searchQueries = searchQueriesData.searchQueries || [];
    const descriptions = searchQueriesData.descriptions || [];
    const geminiEmails = searchQueriesData.emails || [];

    if (!Array.isArray(searchQueries) || searchQueries.length === 0) {
      throw new Error("Gemini returned empty or invalid search queries");
    }

    console.log(`Generated ${searchQueries.length} search queries from Gemini`);
    console.log(`Generated ${descriptions.length} descriptions from Gemini`);
    console.log(`Generated ${geminiEmails.length} emails from Gemini`);

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
            leadType: "business",
            searchQuery: {
              contains: ownerName ? `owner_${ownerName}` : businessType,
            },
          },
          select: {
            leadIdentifier: true,
          },
        });

        previousBusinessIdentifiers = new Set(
          previousLeads.map((l) => l.leadIdentifier)
        );
        console.log(
          `📋 Loaded ${previousBusinessIdentifiers.size} previous business identifiers for real-time deduplication`
        );
      } catch (error) {
        console.error(
          "Failed to load previous businesses for deduplication:",
          error
        );
      }
    }

    for (let i = 0; i < searchQueries.length; i++) {
      const searchQuery = searchQueries[i];
      const geminiDescription = descriptions[i] || ""; // Get corresponding description
      const geminiEmail = geminiEmails[i] || ""; // Get corresponding email
      console.log(
        `\nProcessing ${i + 1}/${searchQueries.length}: ${searchQuery}`
      );

      try {
        // Search for business details using Serper Maps API
        // Note: This returns multiple results in ONE API call
        const requestPayload = {
          q: searchQuery,
          gl: "in",
          hl: "en",
          num: 1, // Request only 1 result per query
        };

        console.log(
          `   📡 Calling Serper API with payload:`,
          JSON.stringify(requestPayload)
        );

        const serperResponse = await axios.post(
          "https://google.serper.dev/maps",
          requestPayload,
          {
            headers: {
              "X-API-KEY": SERPER_API_KEY,
              "Content-Type": "application/json",
            },
            timeout: 10000, // 10 second timeout
          }
        );
        serperCallsCount++; // Track Serper API call

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

        // INTELLIGENT LOCATION FILTERING (City/State/Country aware)
        // Parse address into structured components for precise matching
        const addressParts = businessAddress.split(",").map((p) => p.trim());
        const searchLocationLower = location.toLowerCase().trim();

        // Extract city, state, and country from address
        // Typical format: "Street, Area, City, State Pincode, Country"
        let addressCity = null;
        let addressState = null;
        let addressCountry = null;

        if (addressParts.length >= 1) {
          // Country is typically the last part
          addressCountry = addressParts[addressParts.length - 1]
            .replace(/\d+/g, "")
            .trim()
            .toLowerCase();
        }

        if (addressParts.length >= 2) {
          // State is typically 2nd from end (may include pincode)
          const statePart = addressParts[addressParts.length - 2];
          // Remove pincode from state (e.g., "Madhya Pradesh 452010" → "Madhya Pradesh")
          addressState = statePart
            .replace(/\d{5,6}/g, "")
            .trim()
            .toLowerCase();
        }

        if (addressParts.length >= 3) {
          // City is typically 3rd from end
          let potentialCity = addressParts[addressParts.length - 3];

          // Clean city name - remove postal codes and street indicators
          if (
            !/\d{5,6}/.test(potentialCity) &&
            !/^\d+/.test(potentialCity) &&
            !/\b(Rd|Road|St|Street|Ave|Avenue|Lane|Drive|Block|Sector)\b/i.test(
              potentialCity
            )
          ) {
            addressCity = potentialCity.toLowerCase().trim();
          } else {
            // Try previous parts if current has postal code
            for (let i = addressParts.length - 4; i >= 0; i--) {
              const part = addressParts[i];
              if (
                !/\d{5,6}/.test(part) &&
                !/^\d+/.test(part) &&
                !/\b(Rd|Road|St|Street|Ave|Avenue|Lane|Drive|Block|Sector)\b/i.test(
                  part
                )
              ) {
                addressCity = part.toLowerCase().trim();
                break;
              }
            }
          }
        }

        // HIERARCHICAL LOCATION MATCHING (City → State → Country)
        let locationMatch = false;
        let matchReason = "";
        let matchLevel = "";

        // Helper function to check exact match with word-by-word comparison
        const isExactMatch = (extracted, searched) => {
          if (!extracted) return false;
          if (extracted === searched) return true;

          // Check if all words match
          const extractedWords = extracted.split(/[\s-]+/);
          const searchedWords = searched.split(/[\s-]+/);

          return (
            searchedWords.length === extractedWords.length &&
            searchedWords.every((word) => extractedWords.includes(word))
          );
        };

        // Try matching at city level first
        if (addressCity && isExactMatch(addressCity, searchLocationLower)) {
          locationMatch = true;
          matchReason = "City match";
          matchLevel = "city";
        }
        // If city doesn't match, try state level
        else if (
          addressState &&
          isExactMatch(addressState, searchLocationLower)
        ) {
          locationMatch = true;
          matchReason = "State match";
          matchLevel = "state";
        }
        // If state doesn't match, try country level
        else if (
          addressCountry &&
          isExactMatch(addressCountry, searchLocationLower)
        ) {
          locationMatch = true;
          matchReason = "Country match";
          matchLevel = "country";
        }

        // Filter out if no match at any level
        if (!locationMatch) {
          console.log(`⚠️ LOCATION FILTER: Business NOT in "${location}"`);
          console.log(`   Address: "${businessAddress}"`);
          console.log(`   Extracted city: "${addressCity || "N/A"}"`);
          console.log(`   Extracted state: "${addressState || "N/A"}"`);
          console.log(`   Extracted country: "${addressCountry || "N/A"}"`);
          console.log(`   Skipping - no match at any level`);
          continue;
        }

        console.log(
          `✅ Location verified: ${matchReason} - "${
            matchLevel === "city"
              ? addressCity
              : matchLevel === "state"
              ? addressState
              : addressCountry
          }"`
        );

        // Extract detailed location (city, state, country) - only these 3 components
        let detailedLocation = location; // Default to search location
        if (businessAddress) {
          // Re-parse for display purposes
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
              extractedCity = city;
            } else {
              detailedLocation = `${state}, ${country}`;
              extractedCity = state; // Use state as fallback
            }
          } else if (addressParts.length === 2) {
            // Only state/city and country available
            const country = addressParts[addressParts.length - 1];
            const stateOrCity = addressParts[0];
            detailedLocation = `${stateOrCity}, ${country}`;
            extractedCity = stateOrCity;
          }
        }

        // Prepare phone number with source label
        let finalPhone = "-";
        if (businessPhone) {
          // Prioritize Serper/Google Maps phone
          finalPhone = businessPhone;
          console.log(`   📞 Phone from Google Maps: ${businessPhone}`);
        } else {
          console.log(`   ℹ️ No phone number available from Google Maps`);
        }

        // DISABLED: Website phone extraction to conserve Gemini API quota
        // The free tier has only 20 requests per day, and each phone extraction uses 1 call
        // This adds up quickly when searching for multiple businesses

        // Use Gemini-generated email
        const finalEmail =
          geminiEmail && geminiEmail.trim() && geminiEmail !== "-"
            ? geminiEmail
            : "-";
        if (finalEmail !== "-") {
          console.log(`   📧 Email from Gemini: ${finalEmail}`);
        } else {
          console.log(`   ℹ️ No email available`);
        }

        // Use verified data from Google Maps + Gemini
        const enrichedBusiness = {
          name: businessName,
          address: businessAddress,
          phone: finalPhone,
          email: finalEmail,
          website: place.website || "-",
          rating: place.rating?.toString() || "-",
          totalRatings: reviewCount,
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
        };

        // Check if this business was already provided to user (real-time deduplication)
        // Skip deduplication if using cached results
        const leadIdentifier = `business_${businessName
          .toLowerCase()
          .trim()}_${detailedLocation.toLowerCase().trim()}_${
          businessPhone !== "-" ? businessPhone : place.link
        }`;

        if (!useCached && previousBusinessIdentifiers.has(leadIdentifier)) {
          console.log(
            `⚠️ Skipping duplicate business (already in user history): ${businessName}`
          );
          continue;
        }

        enrichedBusinesses.push(enrichedBusiness);

        // Save to database immediately (non-blocking) - skip if using cached results
        if (req.user?.id && !useCached) {
          prisma.userLeadHistory
            .create({
              data: {
                userId: req.user.id,
                leadIdentifier: leadIdentifier,
                searchQuery: specificBusinessName
                  ? `specific_${specificBusinessName}_${location}`
                  : ownerName
                  ? `owner_${ownerName}_${location}`
                  : `${businessType}_${location}`,
                leadType: "business",
              },
            })
            .catch((err) => {
              // Silently ignore unique constraint errors (P2002)
              if (err.code !== "P2002") {
                console.error("Failed to save lead to history:", err);
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

        // Log detailed error for debugging
        if (serperError.response) {
          console.error(`   ❌ Status Code: ${serperError.response.status}`);
          console.error(
            `   ❌ Response Data:`,
            JSON.stringify(serperError.response.data)
          );
          console.error(
            `   ❌ Response Headers:`,
            JSON.stringify(serperError.response.headers)
          );

          if (serperError.response.status === 400) {
            console.error(
              `   ⚠️ Bad request - invalid query format or parameters`
            );
            console.error(`   Query: "${searchQuery}"`);
          } else if (serperError.response.status === 429) {
            console.error(`   ⚠️ Rate limit exceeded - too many requests`);
          } else if (
            serperError.response.status === 401 ||
            serperError.response.status === 403
          ) {
            console.error(`   ⚠️ Authentication failed - check Serper API key`);
            console.error(
              `   ⚠️ API Key (first 10 chars): ${SERPER_API_KEY?.substring(
                0,
                10
              )}...`
            );
          }
        } else {
          console.error(
            `   ❌ No response from server - network or timeout issue`
          );
          console.error(
            `   ❌ Error details:`,
            serperError.code,
            serperError.errno
          );
        }

        // Skip this query and continue with next one
        console.log(`   Skipping query and continuing with next business...`);
        continue;
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
    // Cache complete results for future instant retrieval
    if (enrichedBusinesses.length > 0) {
      const resultsCacheKey = specificBusinessName
        ? `results:business:specific:${specificBusinessName}:${location}`
        : ownerName
        ? `results:business:owner:${ownerName}:${location}:${requestedLeads}`
        : `results:business:${businessType}:${location}:${requestedLeads}`;

      resultsCache.set(resultsCacheKey, {
        data: enrichedBusinesses,
        timestamp: Date.now(),
      });
      console.log(
        `💾 Cached ${enrichedBusinesses.length} complete results for instant retrieval`
      );
      console.log(`   Cached under key: "${resultsCacheKey}"`);

      // Clean old results cache if needed
      if (resultsCache.size > MAX_RESULTS_CACHE_SIZE) {
        const entriesToRemove = Math.floor(MAX_RESULTS_CACHE_SIZE * 0.2);
        const sortedEntries = Array.from(resultsCache.entries()).sort(
          (a, b) => a[1].timestamp - b[1].timestamp
        );
        for (let i = 0; i < entriesToRemove; i++) {
          resultsCache.delete(sortedEntries[i][0]);
        }
        console.log(`🧹 Cleaned ${entriesToRemove} old results cache entries`);
      }
    }

    // Deduct credits for API usage
    if (req.user?.id && !useCached) {
      try {
        const costs = calculateSearchCost(serperCallsCount, geminiCallsCount);
        console.log(`\n💳 Credit Deduction:`);
        console.log(`   Serper calls: ${serperCallsCount}`);
        console.log(`   Gemini calls: ${geminiCallsCount}`);
        console.log(`   Actual cost: $${costs.actualCost}`);
        console.log(`   Charged cost: $${costs.chargedCost} (1.25x markup)`);

        await deductCredits(req.user.id, {
          amount: costs.chargedCost,
          type: "search",
          description: `Business search: ${
            specificBusinessName || businessType || `owner ${ownerName}`
          } in ${location}`,
          searchType: "business",
          apiCostActual: costs.actualCost,
          apiCostCharged: costs.chargedCost,
          serperCalls: serperCallsCount,
          geminiCalls: geminiCallsCount,
          resultCount: enrichedBusinesses.length,
        });
        creditDeducted = true;
        console.log(`   ✅ Credits deducted successfully`);
      } catch (creditError) {
        console.error("Failed to deduct credits:", creditError);
        // Continue anyway - don't block the search results
      }
    }

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
    const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash-exp" });

    const parsePrompt = `You are a query parser for both professional people search AND business search. Extract the search parameters from the user's natural language query.

User Query: "${query}"

Extract:
1. businessType: 
   - For PEOPLE: Job title/role (e.g., "ML Engineer", "Software Engineer", "Marketing Manager", "Data Scientist")
   - For BUSINESSES: Business type (e.g., "Restaurant", "Cafe", "Hotel", "Hospital", "Retail Store", "IT Company")
2. location: City, state, or region (e.g., "Bangalore", "Mumbai", "Delhi", "Maharashtra", "India")
3. industry: Optional industry if explicitly mentioned (e.g., "Technology", "Healthcare", "Finance", "Food & Beverage")

NORMALIZATION RULES:
- For job titles: "machine learning engineer" → "ML Engineer", "software dev" → "Software Engineer"
- For businesses: "restaurants" → "Restaurant", "coffee shops" → "Cafe", "clinics" → "Clinic"
- For locations: "Bengaluru" → "Bangalore", "NCR" → "Delhi", "Bombay" → "Mumbai"
- Extract industry ONLY if explicitly mentioned in the query
- If location is unclear or not mentioned, use "India" as default

EXAMPLES:
- "ML engineers in Bangalore" → businessType: "ML Engineer", location: "Bangalore", industry: ""
- "Restaurants in Mumbai" → businessType: "Restaurant", location: "Mumbai", industry: ""
- "Software companies in Pune" → businessType: "IT Company", location: "Pune", industry: ""
- "Senior data scientists working in healthcare in Delhi" → businessType: "Data Scientist", location: "Delhi", industry: "Healthcare"

Return ONLY valid JSON (no markdown, no explanation):
{
  "businessType": "extracted job title or business type",
  "location": "extracted location",
  "industry": "extracted industry or empty string"
}`;

    // Use caching for parse queries too
    const cacheKey = `parse:${query.toLowerCase().trim()}`;
    const geminiResult = await getCachedGeminiResponse(cacheKey, async () => {
      return await generateWithRetry(model, parsePrompt, {
        maxRetries: 3,
        initialDelay: 2000,
        fallbackModels: [
          "gemini-1.5-flash-latest",
          "gemini-1.5-flash-8b-latest",
        ],
      });
    });

    // getCachedGeminiResponse returns { data: result, cacheHit: boolean }
    const result = geminiResult.data;
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
