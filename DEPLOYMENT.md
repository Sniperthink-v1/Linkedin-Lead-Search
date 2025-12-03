# Deployment Configuration

## 🚨 URGENT: Fix CORS Error

You're getting a CORS error because your Railway backend's `FRONTEND_URL` is set to `http://localhost:5173` but needs to be `https://linkedin-lead-search.vercel.app`.

### Quick Fix Steps:

1. **Go to Railway Dashboard**: https://railway.app
2. **Select your project**: linkedin-lead-search-production
3. **Click on your service** (the backend deployment)
4. **Go to "Variables" tab**
5. **Update or Add**:
   ```
   FRONTEND_URL=https://linkedin-lead-search.vercel.app
   ```
6. **Redeploy** (Railway should auto-redeploy after variable change)
7. **Wait 1-2 minutes** for deployment to complete
8. **Test login** at https://linkedin-lead-search.vercel.app

---

## Backend Deployment (Railway)

### ✅ Already Deployed
Your backend is at: `https://linkedin-lead-search-production.up.railway.app`

### Required Environment Variables on Railway:
```
DATABASE_URL=postgresql://neondb_owner:npg_oVb7v0JDqFky@ep-frosty-lab-a1ltahz5-pooler.ap-southeast-1.aws.neon.tech/neondb?sslmode=require
GEMINI_API_KEY=AIzaSyBIBONjzfYixSHN6nhce4Z31RYiupHHmZY
SERPER_API_KEY=80b0a047fcfb2f7c1e28d86e8dbccd128eaaa72c
JWT_SECRET=your-super-secret-jwt-key-change-this-in-production-min-32-chars
JWT_EXPIRES_IN=10m
FRONTEND_URL=https://linkedin-lead-search.vercel.app   ⚠️ UPDATE THIS!
PORT=3000
```

---

## Frontend Deployment (Vercel)

### ✅ Already Deployed
Your frontend is at: `https://linkedin-lead-search.vercel.app`

### Required Environment Variable on Vercel:
```
VITE_API_URL=https://linkedin-lead-search-production.up.railway.app
```

**To add/update on Vercel:**
1. Go to: https://vercel.com/dashboard
2. Select your project
3. Settings → Environment Variables
4. Add `VITE_API_URL` with value `https://linkedin-lead-search-production.up.railway.app`
5. Redeploy (or it will auto-deploy on next push)

---

## Testing After Fix

1. Open: https://linkedin-lead-search.vercel.app
2. Click "Sign In" 
3. Login with: `techsupport@sniperthink.com` / `sniperthinkProduct@LeadGen`
4. Should work without CORS errors! ✅

---

## Current Status

- ✅ Frontend deployed on Vercel: https://linkedin-lead-search.vercel.app
- ✅ Backend deployed on Railway: https://linkedin-lead-search-production.up.railway.app
- ✅ VITE_API_URL configured (pointing to Railway)
- ⚠️ **NEEDS FIX**: Railway FRONTEND_URL pointing to localhost instead of Vercel

---
