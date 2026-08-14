# RailYatra — Deploy 100% FREE (No Money, Browser Only)

Deploy live **without paying anything** and **without Azure SQL**. Uses free **Render** + optional free **Vercel** + built-in **SQLite** database.

---

## Cost summary

| Service | Cost | Credit card? |
|---------|------|--------------|
| **GitHub** | $0 | No |
| **Render** (API + UI) | $0 free tier | Usually no |
| **Vercel** (optional UI) | $0 hobby tier | No |
| **SQLite** (built-in DB) | $0 | No |
| **Groq AI chat** | $0 free API | No |

**Total: $0/month**

> Free Render apps sleep after 15 min idle — first visit may take ~30 seconds to wake up. Demo data re-seeds on each deploy (SQLite file is temporary on free tier).

---

## Option A — One URL on Render (easiest, $0)

### Step 1 — Deploy (browser only)

1. Go to **[dashboard.render.com](https://dashboard.render.com)** → sign up with **GitHub** (free).
2. Click **New +** → **Blueprint**.
3. Select repo: **`Ankit2004-web/RailYatra`**.
4. Render reads `render.yaml` automatically — **SQLite is pre-configured**, no database signup needed.
5. When asked, set only:
   ```env
   APP_URL=https://YOUR-SERVICE-NAME.onrender.com
   GROQ_API_KEY=gsk_...    # optional — AI chat (free from console.groq.com)
   ```
6. Click **Apply** → wait ~5–10 min.

### Step 2 — Share your live link

Your app is live at: **`https://YOUR-SERVICE-NAME.onrender.com`**

- Train search, booking, PNR, admin, support chat — all work on demo seed data.
- Admin login uses `ADMIN_EMAIL` / `ADMIN_PASSWORD` from Render env (auto-generated password shown in dashboard).

Verify: `https://YOUR-URL.onrender.com/api/health/ready` → `"status":"ready"`

---

## Option B — Vercel UI + Render API ($0)

Use this if you want a **`*.vercel.app`** portfolio URL.

### Step 1 — Render (backend)

Follow **Option A** first. Copy your Render URL.

### Step 2 — Vercel (frontend)

1. Go to **[vercel.com](https://vercel.com)** → sign up with **GitHub** (free).
2. **Add New Project** → import **RailYatra**.
3. Settings:

| Setting | Value |
|---------|-------|
| Root Directory | `frontend` |
| Framework | Vite |
| Build Command | `npm run build` |
| Output Directory | `dist` |

4. Environment variable:
   ```env
   VITE_API_URL=https://YOUR-SERVICE-NAME.onrender.com
   ```
5. **Deploy** → live at **`https://your-app.vercel.app`**

---

## What runs in free mode

- **Database:** SQLite file on Render (`DB_DRIVER=sqlite`) — no external DB service.
- **Data:** Demo stations, trains, and seats seeded automatically on startup.
- **AI chat:** Works if you add a free **Groq** key in Render env vars.
- **Live train status:** Uses free Indian Railways NTES public API.
- **Payments:** Razorpay checkout (UPI, cards, net banking, wallets) when `RAZORPAY_KEY_ID` and `RAZORPAY_KEY_SECRET` are set. Without keys, bookings still confirm in demo mode.

---

## Environment (Render — already in render.yaml)

```env
DB_DRIVER=sqlite
SQLITE_PATH=/tmp/railyatra.db
NODE_ENV=production
PORT=5000
JWT_SECRET=auto-generated
ADMIN_EMAIL=admin@railway.com
ADMIN_PASSWORD=Adm!n@2004#Hyd
APP_URL=https://your-app.onrender.com
GROQ_API_KEY=optional
RAZORPAY_KEY_ID=rzp_test_…   # from https://dashboard.razorpay.com/app/keys
RAZORPAY_KEY_SECRET=…        # never commit this
RAZORPAY_WEBHOOK_SECRET=…    # optional; webhook URL: https://YOUR-APP.onrender.com/api/payments/webhook
```

### Razorpay (live checkout)

1. Create an account at [dashboard.razorpay.com](https://dashboard.razorpay.com/).
2. Stay in **Test Mode** first, then copy **Key ID** (`rzp_test_…`) and **Key Secret**.
3. On Render → **railyatra** → **Environment**, add `RAZORPAY_KEY_ID` and `RAZORPAY_KEY_SECRET` (and set `ALLOW_DEV_PAYMENT` to `0` if it is still `1`).
4. Redeploy. On pay, the Razorpay modal should open instead of **Confirm & Pay (Dev)**.
5. Optional webhook: `https://railyatra-72z5.onrender.com/api/payments/webhook` with events `payment.captured` and `refund.processed`.

---

## Local development (Windows — unchanged)

```powershell
sqllocaldb start MSSQLLocalDB
npm start
```

Uses SQL Server LocalDB on your PC. Cloud SQLite mode is **only for free Render hosting**.

---

## Troubleshooting

| Problem | Fix |
|---------|-----|
| Build fails | Check Render logs; ensure Node 22 is used |
| Slow first load | Free tier cold start — wait 30–60 sec |
| Admin password unknown | Render dashboard → Environment → `ADMIN_PASSWORD` |
| Data gone after redeploy | Normal on free tier — SQLite is ephemeral |
| Vercel UI, API errors | Set `VITE_API_URL` to Render URL, redeploy |

---

## Optional: Azure SQL (only if you need persistent data)

If you later want a permanent cloud database, see Azure SQL in the older docs — but it is **not required** for a free demo.
