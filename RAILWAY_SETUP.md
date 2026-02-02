# Railway Deployment Setup

## ⚠️ IMPORTANT: Monorepo Configuration Required

This project has been restructured into a monorepo with separate Frontend and Backend directories.
**You MUST update Railway service settings to point to the correct directories.**

---

## 🔧 Required Configuration Changes

### **Frontend Service Configuration**

1. Go to Railway Dashboard → Your Project → **Frontend Service**
2. Click **Settings** tab
3. Under **Build & Deploy**:
   - **Root Directory:** `Frontend`
   - **Build Command:** (leave empty - uses nixpacks.toml)
   - **Start Command:** (leave empty - uses nixpacks.toml)
4. Click **Save Changes**
5. Click **Deploy** to trigger a new build

### **Backend Service Configuration**

1. Go to Railway Dashboard → Your Project → **Backend Service**
2. Click **Settings** tab
3. Under **Build & Deploy**:
   - **Root Directory:** `Backend`
   - **Build Command:** (leave empty - Railway will auto-detect Python)
   - **Start Command:** (leave empty - uses Procfile)
4. Click **Save Changes**
5. Click **Deploy** to trigger a new build

---

## 📋 Required Environment Variables

### **Frontend Service:**
```bash
NODE_ENV=production
NEXT_PUBLIC_API_URL=https://your-backend-service.railway.app
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJxxxxx...
```

### **Backend Service:**
```bash
DATABASE_URL=postgresql://...
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_KEY=eyJxxxxx...
SUPABASE_JWT_SECRET=your-jwt-secret
# Add other backend env vars
```

---

## 🚀 Deployment Flow

Once Root Directory is set correctly:

1. **Frontend Build Process:**
   ```
   cd Frontend
   npm ci --include=dev
   npm run build  (includes: next build + copy public/ + copy .next/static/)
   node .next/standalone/server.js
   ```

2. **Backend Build Process:**
   ```
   cd Backend
   pip install -r requirements.txt
   gunicorn main:app  (from Procfile)
   ```

---

## ✅ Verification Checklist

After configuring both services:

- [ ] Frontend service Root Directory = `Frontend`
- [ ] Backend service Root Directory = `Backend`
- [ ] All environment variables are set
- [ ] Frontend builds successfully
- [ ] Backend builds successfully
- [ ] Frontend URL loads without ERR_CONNECTION_CLOSED
- [ ] Logo appears in header (tests static assets)
- [ ] CSS styling works (tests .next/static/)
- [ ] Backend API responds
- [ ] Frontend can connect to Backend

---

## 🔍 Troubleshooting

### Frontend build fails with "Cannot find package.json"
→ **Root Directory is not set to `Frontend`**

### Backend build fails with "Cannot find requirements.txt"
→ **Root Directory is not set to `Backend`**

### Frontend loads but has no styling
→ Static assets not copied - rebuild after latest commit

### Frontend shows ERR_CONNECTION_CLOSED
→ This was the original issue - should be fixed after setting Root Directory and rebuilding

---

## 📁 Project Structure

```
syllabusync/
├── Frontend/
│   ├── app/
│   ├── components/
│   ├── lib/
│   ├── public/
│   ├── package.json
│   ├── next.config.js
│   └── nixpacks.toml  ← Railway Frontend config
│
├── Backend/
│   ├── main.py
│   ├── requirements.txt
│   └── Procfile  ← Railway Backend config
│
└── RAILWAY_SETUP.md  ← This file
```

---

## 🆘 Quick Fix Commands

If you need to manually trigger deployments:

```bash
# From local machine
git push origin main  # Triggers auto-deploy

# Or use Railway CLI
railway login
railway link
railway up --service Frontend
railway up --service Backend
```

---

**Last Updated:** 2026-02-02
**Status:** ✅ All deployment fixes committed and pushed
