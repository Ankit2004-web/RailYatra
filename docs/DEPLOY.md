# RailYatra — Deploy Live (Browser Only)

No local installs needed. Everything is done in your **browser** via GitHub, **Render** (API), **Vercel** (UI), and **Azure SQL** (database).

---

## Overview

| Service | Role | Free tier |
|---------|------|-----------|
| **GitHub** | Source code | ✅ Already done |
| **Azure SQL** | Database | ✅ 12-month free trial |
| **Render** | Node.js API + serves built UI | ✅ Free (sleeps after 15 min idle) |
| **Vercel** | React frontend (portfolio URL) | ✅ Free |

**Recommended:** Deploy **Render first** (full app at one URL), then optionally add **Vercel** for a prettier frontend URL.

---

## Step 1 — Azure SQL Database (5 min, browser only)

1. Go to **[portal.azure.com](https://portal.azure.com)** and sign in (free account works).
2. **Create a resource** → **SQL Database**.
3. Create a new **SQL server**:
   - Server name: e.g. `railyatra-sql`
   - Authentication: **SQL authentication**
   - Set admin login + password (save these!)
4. Database name: **`RailwayReservation`**
5. Pricing: **Basic** or **Serverless** (cheapest / free trial).
6. After creation → **Networking** → allow **Azure services** + add your IP.
7. Note these values:

| Setting | Example |
|---------|---------|
| `DB_SERVER` | `railyatra-sql.database.windows.net` |
| `DB_NAME` | `RailwayReservation` |
| `DB_USER` | your admin login |
| `DB_PASSWORD` | your password |

---

## Step 2 — Deploy API on Render (browser only)

1. Go to **[dashboard.render.com](https://dashboard.render.com)** → sign up with **GitHub**.
2. Click **New +** → **Blueprint**.
3. Connect repo: **`Ankit2004-web/RailYatra`**.
4. Render reads `render.yaml` automatically.
5. Fill in environment variables when prompted:

```env
DB_SERVER=railyatra-sql.database.windows.net
DB_USER=your_admin
DB_PASSWORD=your_password
APP_URL=https://railyatra-api.onrender.com
GROQ_API_KEY=gsk_...          # optional — AI chat
```

6. Click **Apply**. Wait ~5–10 min for first deploy.
7. Open your Render URL → e.g. **`https://railyatra-api.onrender.com`**

> First request after idle may take 30–60 seconds (free tier wake-up).

Verify: `https://YOUR-RENDER-URL.onrender.com/api/health/ready` → should show `"status":"ready"`.

---

## Step 3 — Deploy frontend on Vercel (browser only)

1. Go to **[vercel.com](https://vercel.com)** → sign up with **GitHub**.
2. **Add New Project** → import **`Ankit2004-web/RailYatra`**.
3. Configure:

| Setting | Value |
|---------|-------|
| **Root Directory** | `frontend` |
| **Framework** | Vite |
| **Build Command** | `npm run build` |
| **Output Directory** | `dist` |

4. Add **Environment Variable**:

```env
VITE_API_URL=https://railyatra-api.onrender.com
```

(Use your actual Render URL from Step 2.)

5. Click **Deploy**.

Your live portfolio URL: **`https://railyatra.vercel.app`** (or similar).

---

## Step 4 — GitHub Actions auto-deploy (optional)

After Vercel first import, enable auto-deploy on every push:

1. **Vercel** → Project → **Settings** → copy **Project ID** and **Org ID**.
2. **Vercel** → Account → **Tokens** → create token.
3. **GitHub** → repo → **Settings** → **Secrets and variables** → **Actions**:
   - Secret `VERCEL_TOKEN` = your token
   - Secret `VERCEL_ORG_ID` = org id
   - Secret `VERCEL_PROJECT_ID` = project id
4. **Variables** → add `VITE_API_URL` = your Render API URL.

Every push to `main` auto-deploys the frontend via `.github/workflows/deploy-vercel.yml`.

Render auto-redeploys on push when connected via Blueprint.

---

## Render only (simplest — one URL)

Skip Vercel if you want one link:

1. Complete Steps 1 + 2 only.
2. Share **`https://railyatra-api.onrender.com`** — it serves both API and React UI.

---

## Environment reference

```env
# Cloud (Render)
DB_DRIVER=tedious
DB_TRUSTED_CONNECTION=false
DB_ENCRYPT=true
DB_TRUST_SERVER_CERT=false
DB_SERVER=your-server.database.windows.net
DB_NAME=RailwayReservation
DB_USER=...
DB_PASSWORD=...
JWT_SECRET=long_random_string
APP_URL=https://your-render-url.onrender.com
PORT=5000

# Vercel frontend
VITE_API_URL=https://your-render-url.onrender.com
```

**Never commit** `.env`, passwords, or API keys to GitHub.

---

## Troubleshooting

| Problem | Fix |
|---------|-----|
| Render build fails on `msnodesqlv8` | Fixed — driver is optional; cloud uses `tedious` |
| `/api/health/ready` = not_ready | Check Azure SQL firewall + credentials |
| Vercel UI loads but API fails | Set `VITE_API_URL` to Render URL, redeploy |
| Slow first load | Render free tier cold start — normal |
| Admin login fails | Set `ADMIN_EMAIL` / `ADMIN_PASSWORD` in Render env, redeploy |

---

## Local development (Windows)

Still works with LocalDB — no cloud env vars needed:

```powershell
sqllocaldb start MSSQLLocalDB
npm start
```

Cloud variables (`DB_DRIVER=tedious`) are only used on Render/Linux.
