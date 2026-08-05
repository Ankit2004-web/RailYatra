# RailYatra — Deployment Guide

RailYatra requires **Microsoft SQL Server**. The default dev setup uses **LocalDB on Windows** with the `msnodesqlv8` ODBC driver.

---

## Quick live demo (Cloudflare Tunnel)

Expose your local app on a public HTTPS URL in ~2 minutes — perfect for portfolios and interviews.

### 1. Run the app locally

```powershell
sqllocaldb start MSSQLLocalDB
npm start
```

Verify **http://localhost:5000** works.

### 2. Install Cloudflare Tunnel

Download **cloudflared** for Windows:
https://developers.cloudflare.com/cloudflare-one/connections/connect-networks/downloads/

Or with winget:

```powershell
winget install Cloudflare.cloudflared
```

### 3. Start the tunnel

```powershell
cloudflared tunnel --url http://localhost:5000
```

Copy the URL shown (e.g. `https://random-words.trycloudflare.com`) — that is your **live demo link**.

> Keep both terminals open (app + tunnel). The URL changes each time unless you configure a named tunnel.

### 4. Update APP_URL (optional)

For correct password-reset links and ticket URLs:

```env
APP_URL=https://your-tunnel-url.trycloudflare.com
```

Restart `npm start`.

---

## Azure production

Best fit for SQL Server + Node on Windows.

### 1. Create Azure SQL Database

1. Azure Portal → **Create SQL Database**
2. Note: server name, database name, admin login, password
3. Firewall: allow Azure services + your IP

### 2. Configure environment

```env
DB_SERVER=your-server.database.windows.net
DB_NAME=RailwayReservation
DB_TRUSTED_CONNECTION=false
DB_USER=your_admin
DB_PASSWORD=your_password
JWT_SECRET=long_random_secret
APP_URL=https://your-app.azurewebsites.net
NODE_ENV=production
```

### 3. Run schema + seed

From a machine that can reach Azure SQL:

```bash
npm run db:setup
npm run import:datameet   # optional bulk data
```

### 4. Deploy API (Azure App Service — Windows)

1. Create **App Service** (Windows, Node 22)
2. Deploy from GitHub: `Ankit2004-web/RailYatra`
3. Set application settings from `.env`
4. Startup command: `node backend/scripts/start.js`
5. Build step (if using GitHub Actions): `npm run install:all && npm run frontend:build`

---

## Docker (local / on-prem)

The included `Dockerfile` builds the Node app. SQL Server must be reachable from the container.

```yaml
# docker-compose.yml — point DB_SERVER to your SQL host
environment:
  DB_SERVER=host.docker.internal\MSSQLLocalDB
  DB_TRUSTED_CONNECTION=true
```

```bash
docker compose up --build
```

> Linux containers cannot use LocalDB directly. Use a full SQL Server instance or Azure SQL with SQL authentication.

---

## Environment checklist

| Variable | Required | Notes |
|----------|----------|-------|
| `DB_SERVER` | Yes | LocalDB or Azure SQL host |
| `DB_NAME` | Yes | Default: `RailwayReservation` |
| `JWT_SECRET` | Yes | Strong random string in production |
| `APP_URL` | Yes | Public URL for emails & tickets |
| `ADMIN_EMAIL` / `ADMIN_PASSWORD` | Seed | First admin user |
| `GROQ_API_KEY` | Optional | AI support chat |
| `RAZORPAY_*` | Optional | Real payments (dev mode works without) |

**Never commit** `.env` or API keys to GitHub.

---

## GitHub Pages (frontend only)

RailYatra is a **full-stack** app — GitHub Pages can host only a static export and will **not** run the API or database. Use Cloudflare Tunnel or Azure for a complete live demo.
