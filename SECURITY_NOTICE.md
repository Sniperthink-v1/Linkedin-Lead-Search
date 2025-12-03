# 🔒 SECURITY NOTICE

## ⚠️ IMPORTANT: Regenerate Your API Keys

Your environment variables were exposed in chat conversation history. Please regenerate these keys immediately:

### 1. **Gemini API Key**
- Go to: https://aistudio.google.com/app/apikey
- Create a new API key
- Delete the old one: `AIzaSyBIBONjzfYixSHN6nhce4Z31RYiupHHmZY`
- Update in Railway environment variables

### 2. **Serper API Key** 
- Go to: https://serper.dev/api-key
- Generate a new API key
- Delete the old one: `80b0a047fcfb2f7c1e28d86e8dbccd128eaaa72c`
- Update in Railway environment variables

### 3. **JWT Secret**
- Generate a new random secret (minimum 32 characters)
- Use: `openssl rand -base64 32` or any password generator
- Update in Railway: `JWT_SECRET=your-new-secret-here`

### 4. **NeonDB Password (Optional but Recommended)**
- Go to: https://console.neon.tech
- Navigate to your database
- Reset the password
- Update connection string in Railway

## 📝 Best Practices Going Forward

### ✅ DO:
- Keep all `.env` files in `.gitignore`
- Use `.env.example` with placeholder values
- Store production secrets in hosting platform (Railway, Vercel)
- Rotate API keys every 3-6 months
- Use different keys for development and production

### ❌ DON'T:
- Never commit `.env` files
- Never share API keys in chat/email
- Never hardcode secrets in code
- Never push sensitive data to public repos

## 🔍 Verify Your .env is NOT Tracked

Run this command to check:
```bash
git ls-files | findstr .env
```

Should only show:
- `client/.env.example`
- `server/.env.example`

If you see `server/.env` or `client/.env`, immediately run:
```bash
git rm --cached server/.env
git commit -m "Remove .env from git tracking"
git push
```

## 🚨 Current Status

- ✅ `.env` files are in `.gitignore`
- ✅ `server/.env` is NOT currently tracked by git
- ⚠️ API keys need regeneration (exposed in conversation)
- ⚠️ Update Railway environment variables after regenerating keys

## 📚 Resources

- [GitHub: Removing sensitive data](https://docs.github.com/en/authentication/keeping-your-account-and-data-secure/removing-sensitive-data-from-a-repository)
- [Railway: Environment Variables](https://docs.railway.app/develop/variables)
- [Vercel: Environment Variables](https://vercel.com/docs/projects/environment-variables)
