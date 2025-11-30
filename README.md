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

- **Frontend**: React 18 + Vite + Tailwind CSS
- **Backend**: Node.js + Express
- **API**: Serper API (Web Search + Maps)
- **Data Export**: XLSX library

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

Create/edit `server/.env`:

```env
SERPER_API_KEY=your_serper_api_key_here
PORT=3000
```

Get your free API key at: https://serper.dev/

### Running the Application

1. **Start LinkedIn search server** (Terminal 1)

```bash
cd server
npm run start:linkedin
# Runs on http://localhost:3000
```

2. **Start Business search server** (Terminal 2)

```bash
cd server
npm run start:business
# Runs on http://localhost:3001
```

3. **Start frontend** (Terminal 3)

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
2. Enter business type (e.g., "Restaurant", "Digital Marketing")
3. Enter location (e.g., "Noida")
4. Click "Search Leads"
5. Export results to Excel

## API Endpoints

### LinkedIn Search

- **Endpoint**: `GET /api/leads`
- **Query Parameters**:
  - `businessType` (required): Job title/role
  - `location` (required): City/location
  - `industry` (optional): Industry filter

### Business Search

- **Endpoint**: `GET /api/business-leads`
- **Query Parameters**:
  - `businessType` (required): Type of business
  - `location` (required): City/location

## Features in Detail

### Smart Filtering

- **Job Title**: Strict word-based matching (all keywords must be present)
- **Location**: Lenient substring matching for flexible location filtering
- **Deduplication**: Automatic removal of duplicate profiles/businesses
- **Educational Filter**: Automatically excludes colleges, universities, schools from business results

### Rate Limiting

- 1 second delay between requests (Serper free tier compliance)
- Automatic handling of 429 (rate limit) responses
- Up to 10 pages (100 results) for LinkedIn search
- Up to 20 results for business search

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
