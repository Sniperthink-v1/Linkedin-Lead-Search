# Deployment Configuration

## Backend Deployment (Required First)

Your backend needs to be deployed before the frontend. Deploy to one of these platforms:

### Option 1: Railway (Recommended)
1. Go to [Railway.app](https://railway.app)
2. Create a new project from your GitHub repository
3. Select the `server` folder as the root directory
4. Railway will auto-detect Node.js and deploy
5. Add environment variables in Railway dashboard:
   - `DATABASE_URL` (your NeonDB connection string)
   - `GEMINI_API_KEY`
   - `SERPER_API_KEY`
   - `JWT_SECRET` (generate a random string)
   - `JWT_EXPIRES_IN=10m`
   - `FRONTEND_URL=https://linkedin-lead-search.vercel.app`
6. Copy your Railway backend URL (e.g., `https://your-app.up.railway.app`)

### Option 2: Render
1. Go to [Render.com](https://render.com)
2. Create a new Web Service from your GitHub repository
3. Set root directory to `server`
4. Build command: `npm install`
5. Start command: `npm start`
6. Add environment variables in Render dashboard (same as above)
7. Copy your Render backend URL

## Frontend Deployment (Vercel)

### Configure Environment Variable on Vercel:
1. Go to your Vercel project settings
2. Navigate to "Environment Variables"
3. Add a new variable:
   - **Name**: `VITE_API_URL`
   - **Value**: Your backend URL from Railway/Render (e.g., `https://your-app.up.railway.app`)
   - **Environment**: Production, Preview, Development (select all)
4. Redeploy your frontend

### Alternative: Update .env.production locally
1. Edit `client/.env.production`
2. Replace `VITE_API_URL=https://your-backend-url-here.com` with your actual backend URL
3. Commit and push changes

## CORS Configuration

Make sure your backend `.env` has the correct `FRONTEND_URL`:
```
FRONTEND_URL=https://linkedin-lead-search.vercel.app
```

## Testing After Deployment

1. Open your Vercel URL: https://linkedin-lead-search.vercel.app
2. Click "Sign In" - should not show CORS errors
3. Try logging in with: `techsupport@sniperthink.com` / `sniperthinkProduct@LeadGen`
4. Check browser console for any remaining errors

## Current Status

- ✅ Frontend deployed on Vercel
- ❌ Backend not deployed yet (causing CORS errors)
- ❌ VITE_API_URL not configured on Vercel

## Next Steps

1. **Deploy backend first** to Railway or Render
2. **Copy the backend URL**
3. **Add VITE_API_URL** to Vercel environment variables with your backend URL
4. **Redeploy frontend** on Vercel
5. **Update backend FRONTEND_URL** to match your Vercel domain
