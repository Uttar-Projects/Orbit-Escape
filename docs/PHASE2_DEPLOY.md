# Phase 2 — Deploy to Render (HTTPS + PostgreSQL)

**Repo:** [github.com/Uttar-Projects/Orbit-Escape](https://github.com/Uttar-Projects/Orbit-Escape)

**Goal:** Live URL like `https://orbit-escape.onrender.com` with database `ok` on `/health`.

**Time:** ~20–30 minutes.

---

## Before you start

- [x] Phase 1 done (bot, Adsgram block `32481`)
- [x] Code on GitHub
- [ ] [Render](https://render.com) account (sign in with GitHub)
- [ ] Production `SESSION_SECRET` (generate below)
- [ ] Bot token from BotFather (revoke old token if leaked in chat)

```powershell
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

Save the output for Render **only** — never commit it.

---

## Option A — Blueprint (recommended)

Uses `render.yaml` in the repo ([Blueprint spec](https://render.com/docs/blueprint-spec)).

1. Go to [dashboard.render.com](https://dashboard.render.com) → **New +** → **Blueprint**.
2. Connect **Uttar-Projects/Orbit-Escape** → approve access.
3. Render reads `render.yaml` and creates:
   - **Web service** `orbit-escape`
   - **PostgreSQL** `orbit-escape-db`
4. When prompted, enter **secret** env vars:

| Variable | Value |
|----------|--------|
| `TELEGRAM_BOT_TOKEN` | From BotFather |
| `SESSION_SECRET` | Your generated 64-char hex |
| `ALLOWED_ORIGINS` | Leave empty for first deploy — add in Step 3 |

5. Click **Apply** / **Create** and wait for deploy (~5–10 min first time).

---

## Option B — Manual setup

### 1. PostgreSQL

1. **New +** → **PostgreSQL**
2. Name: `orbit-escape-db` · Plan: **Free**
3. Create → copy **Internal Database URL** (or External if needed)

### 2. Web Service

1. **New +** → **Web Service** → connect **Orbit-Escape** repo
2. Settings:

| Setting | Value |
|---------|--------|
| Name | `orbit-escape` |
| Region | Oregon (or nearest) |
| Branch | `main` |
| Runtime | **Node** |
| Build Command | `npm ci` |
| Start Command | `npm run start:prod` |
| Plan | **Free** |

3. **Advanced** → Health Check Path: `/health`

### 3. Environment variables (Web Service → Environment)

| Key | Value |
|-----|--------|
| `NODE_ENV` | `production` |
| `DATABASE_URL` | Paste Postgres connection string |
| `TELEGRAM_BOT_TOKEN` | BotFather token |
| `SESSION_SECRET` | Generated hex |
| `ALLOWED_ORIGINS` | Your Render URL (Step below) |
| `LOG_LEVEL` | `info` |

`PORT` is set automatically by Render — do not override.

4. **Create Web Service**

---

## Step 3 — Get your public URL

1. Open web service **orbit-escape** → copy URL, e.g.  
   `https://orbit-escape.onrender.com` (no trailing `/`)
2. **Environment** → set / update:

```
ALLOWED_ORIGINS=https://orbit-escape.onrender.com
```

3. **Manual Deploy** → **Deploy latest commit** (or wait for auto-deploy).

> **Free plan:** Service sleeps after ~15 min idle. First open may take 30–60s to wake.

---

## Step 4 — Verify deploy

```powershell
npm run phase2:verify -- https://orbit-escape.onrender.com
```

Expected:

- HTTP 200 on `/health`
- `"ok": true`
- `"database": { "status": "ok" }`

Browser: `https://YOUR-URL.onrender.com/health`

---

## Step 5 — Update Telegram + Adsgram

### BotFather

1. [@BotFather](https://t.me/BotFather) → `/myapps` → **Orbit Escape**
2. **Edit Web App URL** → `https://YOUR-URL.onrender.com`
3. Direct link unchanged: `https://t.me/OrbitEscapeGameBot/orbitescape`

### Adsgram ([partner.adsgram.ai](https://partner.adsgram.ai))

Platform **Orbit Escape**:

| Field | Value |
|--------|--------|
| **App url** | `https://YOUR-URL.onrender.com` |
| **Reward URL** (block 32481) | `https://YOUR-URL.onrender.com/api/adsgram/reward?userid=[userId]` |
| **Test platform** | Uncheck for production |

---

## Step 6 — Test in Telegram (phone)

1. [t.me/OrbitEscapeGameBot/orbitescape](https://t.me/OrbitEscapeGameBot/orbitescape)
2. Scores sync to server (“✓ Saved”)
3. Die → **Watch ad** → Adsgram rewarded ad

---

## Troubleshooting

| Problem | Fix |
|---------|-----|
| Build fails | **Logs** → check `npm ci`; Node 18+ in Render settings |
| `/health` 503 | Wrong `DATABASE_URL`; run **Shell** → `npm run db:migrate` |
| Crash on start | Missing `TELEGRAM_BOT_TOKEN` or `SESSION_SECRET` in env |
| CORS in Telegram | `ALLOWED_ORIGINS` = exact Render URL (https, no `/` at end) |
| Slow first load | Free tier cold start — normal |
| Migrate error | Render Shell: `npm run db:migrate` |

---

## Phase 2 complete checklist

- [ ] Render web + Postgres running
- [ ] `npm run phase2:verify` passes
- [ ] BotFather Web App URL = Render URL
- [ ] Adsgram App url + Reward URL updated
- [ ] Game works in Telegram on phone

**Next:** Phase 3 — env audit; optional custom domain on Render.

---

## Alternative: Railway

See `railway.toml` and [Railway docs](https://railway.app) if you prefer Railway instead of Render.
