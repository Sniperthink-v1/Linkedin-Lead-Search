# LinkedIn Lead Search

A powerful lead generation tool that searches for LinkedIn profiles and local businesses using the Serper API.

## Features

### LinkedIn People Search

- Search for professionals by job title, location, and industry
- Advanced filtering with exact job title matching
- Export results to Excel with clickable links
- Real-time progressive results via Server-Sent Events

### Business Search

- Find local businesses using Google Maps data
- Get structured business information (phone, address, website, ratings)
- Automatic filtering of educational institutions
- Export business leads to Excel

## Tech Stack

- **Frontend**: React 18 + Vite + Tailwind CSS (Deployed on Vercel)
- **Backend**: Node.js + Express (Deployed on Railway)
- **APIs**: 
  - Serper API (LinkedIn people search via Google Web Search)
  - Gemini AI API (Business search with enriched data)
- **Data Export**: XLSX library

## 🚀 Deployment

This project is production-ready and can be deployed easily:

- **Backend**: Deploy to Railway - See [RAILWAY_DEPLOYMENT.md](./RAILWAY_DEPLOYMENT.md)
- **Frontend**: Deploy to Vercel - See [VERCEL_DEPLOYMENT.md](./VERCEL_DEPLOYMENT.md)

## Setup

### Prerequisites

- Node.js 16+ installed
- Serper API key (free tier: 2,500 searches/month)

### Installation

1. **Clone the repository**

```bash
git clone https://github.com/Sniperthink-v1/Linkedin-Lead-Search.git
cd Linkedin-Lead-Search
```

2. **Install server dependencies**

```bash
cd server
npm install
```

3. **Install client dependencies**

```bash
cd ../client
npm install
```

4. **Configure environment variables**

**Server** - Create/edit `server/.env`:

```env
SERPER_API_KEY=your_serper_api_key_here
GEMINI_API_KEY=your_gemini_api_key_here
PORT=3000
```

**Client** - Create `client/.env` (for local development):

```env
VITE_API_URL=http://localhost:3000
```

Get your API keys:
- Serper API: https://serper.dev/ (for LinkedIn people search)
- Gemini API: https://aistudio.google.com/app/apikey (for business search)

### Running the Application (Local Development)

1. **Start unified server**

```bash
cd server
npm start
# Runs on http://localhost:3000
```

2. **Start frontend**

```bash
cd client
npm run dev
# Runs on http://localhost:5173
```

## Usage

### LinkedIn People Search

1. Select "LinkedIn People" tab
2. Enter job title (e.g., "Software Developer")
3. Enter location (e.g., "Bengaluru")
4. Optionally add industry filter
5. Click "Search Leads"
6. Export results to Excel

### Business Search

1. Select "Business Leads" tab
2. Enter business type (e.g., "Restaurant", "Digital Marketing Agency", "Auto Dealer")
3. Enter location (e.g., "Noida", "Mumbai", "Delhi")
4. Click "Search Leads"
5. View enriched results with:
   - Contact details (phone, email)
   - Owner/founder names
   - Social media profiles (Instagram, Facebook)
   - Business descriptions
   - Ratings and reviews
6. Export complete data to Excel

## API Endpoints

### LinkedIn Search

- **Endpoint**: `GET /api/leads`
- **Query Parameters**:
  - `businessType` (required): Job title/role
  - `location` (required): City/location
  - `industry` (optional): Industry filter

### Business Search

- **Endpoint**: `GET /api/business-leads`
- **Technology**: Gemini AI with Google Search grounding
- **Query Parameters**:
  - `businessType` (required): Type of business
  - `location` (required): City/location
- **Enriched Data Returned**:
  - Business name and address
  - Phone number and email
  - Owner/founder name
  - Website URL
  - Google Maps rating and review count
  - Instagram and Facebook profiles
  - Business description and category
  - Direct Google Maps link

## Features in Detail

### Smart Filtering

- **Job Title**: Strict word-based matching (all keywords must be present)
- **Location**: Lenient substring matching for flexible location filtering
- **Deduplication**: Automatic removal of duplicate profiles/businesses
- **Educational Filter**: Automatically excludes colleges, universities, schools from business results

### Rate Limiting

- **LinkedIn Search**: 1 second delay between requests (Serper free tier compliance)
- **Business Search**: Single Gemini AI request (no rate limiting needed)
- Automatic handling of API responses
- Up to 10 pages (100 results) for LinkedIn search
- Up to 20 enriched results for business search

### Export Features

- Excel format with formatted columns
- Clickable hyperlinks in spreadsheet
- Proper column widths for readability
- Timestamp in filename

## Development Scripts

### Server

```bash
npm run start:linkedin    # Start LinkedIn server
npm run start:business    # Start Business server
npm run dev:linkedin      # Start with auto-reload
npm run dev:business      # Start with auto-reload
```

### Client

```bash
npm run dev      # Start development server
npm run build    # Build for production
npm run preview  # Preview production build
```

## Cost & Limits

- **Serper API Free Tier**: 2,500 searches/month
- **Pricing**: $5 per 1,000 searches beyond free tier
- **Rate Limit**: 1 request/second on free tier

## Error Handling

The application handles:

- Invalid API keys (401 errors)
- Rate limiting (429 errors)
- Network errors
- Invalid search parameters
- Empty results

## Contributing

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit your changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

## License

ISC

## Support

For issues and questions, please open an issue on GitHub.
