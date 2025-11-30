# Vercel Deployment Guide for Frontend

## Prerequisites

- Vercel account (sign up at https://vercel.com/)
- Backend deployed on Railway with URL
- GitHub repository

## Deployment Steps

### 1. Install Vercel CLI (Optional)

```bash
npm install -g vercel
```

### 2. Deploy via Vercel Dashboard (Recommended)

1. Go to [Vercel Dashboard](https://vercel.com/dashboard)
2. Click **"Add New..."** → **"Project"**
3. Import your GitHub repository: `Sniperthink-v1/Linkedin-Lead-Search`
4. Configure project:
   - **Framework Preset**: Vite
   - **Root Directory**: `client`
   - **Build Command**: `npm run build` (auto-detected)
   - **Output Directory**: `dist` (auto-detected)
   - **Install Command**: `npm install` (auto-detected)

### 3. Add Environment Variable

In the **Environment Variables** section, add:

**Variable Name**: `VITE_API_URL`  
**Value**: Your Railway backend URL (e.g., `https://linkedin-lead-search-production.up.railway.app`)

⚠️ **Important**:

- Do NOT include a trailing slash
- Example: `https://your-app.up.railway.app` ✅
- NOT: `https://your-app.up.railway.app/` ❌

### 4. Deploy

1. Click **"Deploy"**
2. Vercel will build and deploy your application
3. You'll get a URL like: `https://linkedin-lead-search.vercel.app`

### 5. Test Your Deployment

Visit your Vercel URL and test:

1. LinkedIn People search
2. Business Leads search
3. Excel export functionality
4. Copy link feature

## Alternative: Deploy via CLI

```bash
cd client
vercel
```

Follow the prompts:

- Link to existing project or create new
- Set up and deploy

Add environment variable:

```bash
vercel env add VITE_API_URL
```

Paste your Railway URL when prompted.

Then redeploy:

```bash
vercel --prod
```

## Environment Variables

### Production (.env)

Create `client/.env` (local development only, DO NOT commit):

```env
VITE_API_URL=http://localhost:3000
```

### Vercel Dashboard

Set in project settings:

```
VITE_API_URL=https://your-railway-backend.up.railway.app
```

## Custom Domain (Optional)

1. Go to your Vercel project
2. Click **"Settings"** → **"Domains"**
3. Add your custom domain
4. Update DNS records as instructed

## Troubleshooting

### Build Fails

- Check **Deployments** → **Build Logs**
- Ensure `package.json` has all dependencies
- Verify root directory is set to `client`

### API Not Working

- Verify `VITE_API_URL` is set correctly in Vercel
- Check Railway backend is running
- Open browser console for errors
- Ensure no trailing slash in API URL

### CORS Errors

- Backend already has CORS enabled
- If issues persist, check Railway logs
- Ensure API_URL is correct (https://, not http://)

### Environment Variable Not Working

- Redeploy after adding environment variables
- Use exact name: `VITE_API_URL`
- Check it's not in `.gitignore`

## Local Development

Create `client/.env` for local testing:

```env
VITE_API_URL=http://localhost:3000
```

Or test with Railway backend:

```env
VITE_API_URL=https://your-railway-backend.up.railway.app
```

Run locally:

```bash
cd client
npm run dev
```

## Automatic Deployments

Vercel automatically redeploys when you push to GitHub:

- **Production**: Pushes to `main` branch
- **Preview**: Pull requests and other branches

## Production Checklist

- [ ] Backend deployed on Railway and working
- [ ] Frontend code updated to use `VITE_API_URL`
- [ ] Environment variable added in Vercel dashboard
- [ ] Deployment successful
- [ ] Test LinkedIn search
- [ ] Test Business search
- [ ] Test Excel export
- [ ] Test copy link feature
- [ ] Check browser console for errors
- [ ] Custom domain configured (optional)

## Cost

Vercel offers:

- Free tier for personal projects
- Unlimited bandwidth and deployments
- Automatic SSL certificates

Perfect for this application! 🚀

## URLs After Deployment

- **Frontend (Vercel)**: `https://linkedin-lead-search.vercel.app`
- **Backend (Railway)**: `https://your-app.up.railway.app`
- **API Endpoints**:
  - `https://your-app.up.railway.app/api/leads`
  - `https://your-app.up.railway.app/api/business-leads`
