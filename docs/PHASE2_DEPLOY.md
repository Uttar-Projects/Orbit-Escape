# Phase 2 — Deploy to Railway (HTTPS + PostgreSQL)

**Goal:** Live URL like `https://orbit-escape-production.up.railway.app` with database `ok` on `/health`.

**Time:** ~20–30 minutes.

---

## Before you start

- [x] Phase 1 done (bot, Adsgram block `32481`)
- [ ] GitHub account (recommended) or [Railway CLI](https://docs.railway.com/guides/cli)
- [ ] New **production** `SESSION_SECRET` (generate below)
- [ ] Bot token in `.env` (revoke old token if it was leaked in chat)

Generate `SESSION_SECRET`:

```powershell
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

Copy the output — use **only** in Railway variables, not in git.

---

## Step 1 — Push code to GitHub

1. Create a repo on GitHub (e.g. `orbit-escape-tma`).
2. In the project folder:

```powershell
cd "c:\Users\USER\Desktop\New folder\orbit-escape-tma-v4\orbit-escape-tma-v4"
git init
git add .
git commit -m "Orbit Escape TMA — initial deploy"
git remote add origin https://github.com/YOUR_USER/orbit-escape-tma.git
git push -u origin main
```

Skip if the repo is already on GitHub.

---

## Step 2 — Create Railway project

1. Go to [railway.app](https://railway.app) → **Login** (GitHub).
2. **New Project** → **Deploy from GitHub repo** → select your repo.
3. Railway detects Node and uses `railway.toml` + `npm run start:prod` (runs DB migrate then server).

---

## Step 3 — Add PostgreSQL

1. In the project → **+ New** → **Database** → **PostgreSQL**.
2. Click the Postgres service → **Variables** → copy `DATABASE_URL` (or use **Connect** → **Postgres connection URL**).
3. On your **app service** (not Postgres) → **Variables** → add:

| Variable | Value |
|----------|--------|
| `DATABASE_URL` | `${{Postgres.DATABASE_URL}}` or paste from Postgres service |
| `TELEGRAM_BOT_TOKEN` | From BotFather (new token if revoked) |
| `NODE_ENV` | `production` |
| `SESSION_SECRET` | Your generated 64-char hex |
| `ALLOWED_ORIGINS` | Leave empty until Step 5 — then set your Railway URL |
| `LOG_LEVEL` | `info` |

`PORT` is set automatically by Railway — do not hardcode unless needed.

4. **Redeploy** the app after adding variables.

---

## Step 4 — Public HTTPS domain

1. Open your **app** service (Node), not Postgres.
2. **Settings** → **Networking** → **Generate Domain**.
3. Copy the URL, e.g. `https://orbit-escape-production.up.railway.app` (no trailing `/`).

4. Add variable on the app service:

| Variable | Value |
|----------|--------|
| `ALLOWED_ORIGINS` | `https://orbit-escape-production.up.railway.app` (your real URL) |

5. **Redeploy** again.

---

## Step 5 — Verify deploy

```powershell
npm run phase2:verify -- https://YOUR-RAILWAY-URL.up.railway.app
```

Expected:

- HTTP 200 on `/health`
- `"ok": true`
- `"database": { "status": "ok" }`

Open in browser: `https://YOUR-URL/health`

Play the game: `https://YOUR-URL/` (browser test; Telegram needs Step 6).

---

## Step 6 — Update Telegram + Adsgram (same URL everywhere)

### BotFather

1. [@BotFather](https://t.me/BotFather) → `/myapps` → **Orbit Escape**
2. **Edit Web App URL** → `https://YOUR-RAILWAY-URL.up.railway.app`
3. Direct link stays: `https://t.me/OrbitEscapeGameBot/orbitescape`

### Adsgram ([partner.adsgram.ai](https://partner.adsgram.ai))

On platform **Orbit Escape** (ID 30344):

| Field | New value |
|--------|-----------|
| **App url** | `https://YOUR-RAILWAY-URL.up.railway.app` |
| **Reward URL** (block 32481) | `https://YOUR-RAILWAY-URL.up.railway.app/api/adsgram/reward?userid=[userId]` |
| **Test platform** | Uncheck when using production URL |

---

## Step 7 — Test in Telegram

1. Open [t.me/OrbitEscapeGameBot/orbitescape](https://t.me/OrbitEscapeGameBot/orbitescape) on your **phone**.
2. Scores should sync (not only “Saved locally”).
3. Die → **Watch ad** → real Adsgram ad (not 5s stub).

---

## Troubleshooting

| Problem | Fix |
|---------|-----|
| `/health` 503, database error | Check `DATABASE_URL` on **app** service; redeploy; logs for migrate errors |
| App crashes on start | Railway **Deploy Logs** — missing `TELEGRAM_BOT_TOKEN` or `SESSION_SECRET` |
| CORS errors in Telegram | `ALLOWED_ORIGINS` must match Railway URL exactly (https, no trailing slash) |
| Migrate fails `gen_random_uuid` | Railway Postgres includes extension; redeploy with `start:prod` |
| Ads don’t show | Open inside Telegram; block moderation; test platform off for prod URL |

---

## Phase 2 complete checklist

- [ ] Railway app + Postgres running
- [ ] `npm run phase2:verify` passes
- [ ] BotFather Web App URL = Railway URL
- [ ] Adsgram App url + Reward URL updated
- [ ] Game opens in Telegram and saves scores

**Next:** Phase 3 — double-check all env vars; Phase 7 — ad testing on device.

---

## Alternative: Render

1. [render.com](https://render.com) → **New Web Service** → connect repo.
2. **Build:** `npm ci` · **Start:** `npm run start:prod`
3. Add **PostgreSQL** addon → paste `DATABASE_URL`.
4. Same env vars as Railway table above.
