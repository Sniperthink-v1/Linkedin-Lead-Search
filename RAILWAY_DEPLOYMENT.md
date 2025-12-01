# Railway Deployment Guide

## Prerequisites

- Railway account (sign up at https://railway.app/)
- GitHub repository connected
- Serper API key

## Deployment Steps

### 1. Create New Project on Railway

1. Go to [Railway Dashboard](https://railway.app/dashboard)
2. Click **"New Project"**
3. Select **"Deploy from GitHub repo"**
4. Choose your repository: `Sniperthink-v1/Linkedin-Lead-Search`
5. Railway will automatically detect your Node.js application

### 2. Configure Root Directory

Since your backend is in the `server` folder:

1. In your Railway project, go to **Settings**
2. Find **"Root Directory"** setting
3. Set it to: `server`
4. Click **Save**

### 3. Add Environment Variables

1. Go to **Variables** tab in your Railway project
2. Add the following environment variables:

   - **Key**: `SERPER_API_KEY`
   - **Value**: Your Serper API key from https://serper.dev/

   - **Key**: `GEMINI_API_KEY`
   - **Value**: Your Gemini API key from https://aistudio.google.com/app/apikey

3. Railway automatically sets the `PORT` variable, so you don't need to add it

### 4. Deploy

1. Railway will automatically deploy your application
2. Once deployed, you'll get a URL like: `https://your-app-name.up.railway.app`
3. Your backend endpoints will be:
   - `https://your-app-name.up.railway.app/api/leads` (LinkedIn search)
   - `https://your-app-name.up.railway.app/api/business-leads` (Business search)

### 5. Update Frontend Configuration

After deployment, update your frontend to use the Railway backend URL:

**In `client/src/App.jsx`**, replace:

```javascript
const eventSource = new EventSource(
  `http://localhost:3000/api/leads?${params}`
);
```

With:

```javascript
const eventSource = new EventSource(
  `https://your-app-name.up.railway.app/api/leads?${params}`
);
```

And for business search, replace:

```javascript
const eventSource = new EventSource(
  `http://localhost:3001/api/business-leads?${params}`
);
```

With:

```javascript
const eventSource = new EventSource(
  `https://your-app-name.up.railway.app/api/business-leads?${params}`
);
```

### 6. Alternative: Use Environment Variable for Backend URL

**Better approach** - Create a `.env` file in your `client` folder:

```env
VITE_API_URL=https://your-app-name.up.railway.app
```

Then update your code to use:

```javascript
const API_URL = import.meta.env.VITE_API_URL || "http://localhost:3000";
const eventSource = new EventSource(`${API_URL}/api/leads?${params}`);
```

## Monitoring and Logs

1. Go to **Deployments** tab to see deployment status
2. Click on any deployment to view logs
3. Use **Metrics** tab to monitor resource usage

## Custom Domain (Optional)

1. Go to **Settings** → **Domains**
2. Click **"Generate Domain"** for a Railway subdomain
3. Or add your own custom domain

## Troubleshooting

### Build Fails

- Check **Deployments** → **Build Logs**
- Ensure `package.json` has correct start script
- Verify root directory is set to `server`

### Environment Variables Not Working

- Double-check variable names match exactly
- Redeploy after adding new variables

### CORS Issues

- The backend already has CORS enabled with `cors()` middleware
- If issues persist, specify allowed origins in CORS config

## Cost

- Railway offers:
  - $5 free credit per month for new users
  - Pay-as-you-go after free credit
  - Typically costs $5-10/month for small apps

## Production Checklist

- [ ] Backend deployed on Railway
- [ ] Environment variables configured
- [ ] Frontend updated with Railway URL
- [ ] Test both LinkedIn and Business search endpoints
- [ ] Monitor logs for errors
- [ ] Set up custom domain (optional)

## Unified Server vs Separate Servers

The deployment uses a **unified server** (`server.js`) that handles both:

- LinkedIn people search (`/api/leads`)
- Business search (`/api/business-leads`)

This is more efficient for Railway deployment (single service, single domain, lower cost).

If you prefer separate services:

1. Deploy two Railway projects
2. Use `server-serper-linkedin.js` and `server-serper-business.js`
3. Update package.json start script accordingly
