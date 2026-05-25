# Orbit Escape — Full Launch Checklist (TMA + Ads)

Use this list in order. Check items off as you go.  
**Basic launch** = playable Mini App with cloud saves. **Full launch** = everything below, including real rewarded ads.

---

## Phase 1 — Accounts & bot ✅

**Guide:** [docs/PHASE1_SETUP.md](docs/PHASE1_SETUP.md) · **Option A (tunnel):** [docs/PHASE1_OPTION_A.md](docs/PHASE1_OPTION_A.md) · **Verify:** `npm run phase1:verify`

- [x] Create a Telegram bot via [@BotFather](https://t.me/BotFather) (`/newbot`)
- [x] Save the bot token securely (never commit to git)
- [x] Note your bot username — `@OrbitEscapeGameBot`
- [ ] (Optional) Set bot name, description, and avatar in BotFather
- [x] Register at [Adsgram Publisher](https://partner.adsgram.ai)
- [ ] Complete Adsgram moderation / app approval if required (for full monetization)
- [x] Create a **Rewarded** ad block — Block ID `32481` in `public/index.html`

---

## Phase 2 — Hosting & database

**Guide:** [docs/PHASE2_DEPLOY.md](docs/PHASE2_DEPLOY.md) (Render) · **Blueprint:** `render.yaml` · **Verify:** `npm run phase2:verify -- https://YOUR-URL.onrender.com`

- [ ] Deploy on **Render** ([Blueprint](https://dashboard.render.com) + `render.yaml`) or manual web service + Postgres
- [ ] Create a **PostgreSQL** database (Railway/Supabase/Neon, etc.)
- [ ] Copy `DATABASE_URL` into production env vars
- [ ] Deploy the Node app (`npm start` → `node server.js`)
- [ ] Set production env vars (see Phase 3)
- [ ] Run migrations on production DB:
  ```bash
  npm run db:migrate
  ```
- [ ] Confirm health endpoint: `GET https://YOUR-URL.onrender.com/health` → `"ok": true` and database `"status": "ok"`

---

## Phase 3 — Production environment variables

Set these in your host dashboard (use `.env.production.template` as a guide).

| Variable | Required | Notes |
|----------|----------|--------|
| `TELEGRAM_BOT_TOKEN` | Yes | From BotFather |
| `NODE_ENV` | Yes | `production` |
| `DATABASE_URL` | Yes | PostgreSQL connection string |
| `SESSION_SECRET` | Yes | Generate: `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"` — **do not** use dev default |
| `ALLOWED_ORIGINS` | Yes | Your HTTPS URL, no trailing slash (e.g. `https://orbit-escape.onrender.com`) |
| `PORT` | Usually auto | Host often sets this |
| `RATE_LIMIT_MAX` | Optional | Default `60` |
| `MAX_SCORE_PER_SECOND` | Optional | Default `2.0` |
| `SENTRY_DSN` | Optional | Error monitoring |
| `LOG_LEVEL` | Optional | `info` in prod |

- [ ] All required vars set
- [ ] `SESSION_SECRET` is unique and not the example from `.env.example`
- [ ] Server starts without “Missing env vars” / exit in production logs

---

## Phase 4 — Code changes before deploy

### Telegram / sharing (`public/index.html`)

- [ ] Set `window.__BOT_USERNAME__` to your real bot username (no `@`)
- [ ] Verify share URL pattern: `https://t.me/YOUR_BOT/play` (create Mini App link in BotFather if needed)

### Adsgram (rewarded revive ads)

- [ ] Set `window.__ADSGRAM_BLOCK_ID__` to your Adsgram Block ID (string of digits)
- [ ] Add Adsgram SDK in `<head>` **after** Telegram script:
  ```html
  <script src="https://sad.adsgram.ai/js/sad.min.js"></script>
  ```
- [ ] Confirm `server.js` CSP already allows `https://sad.adsgram.ai` (it does in v4)
- [ ] Redeploy after these edits

### Ads behavior (already in repo — verify after integration)

- [ ] With Block ID + SDK: revive flow uses **real** ads (`AdBroker` in `public/src/ui/ads.js`)
- [ ] Without Block ID: app falls back to **dev stub** (5s fake ad) — not acceptable for production monetization
- [ ] Test: die → “Watch ad” → ad plays → revive works
- [ ] Test: skip ad → game over (no revive)
- [ ] Test: ad error / no fill → graceful fallback (no crash)

### Adsgram debug (staging only)

- [ ] Optional: test with `debug: true` in `Adsgram.init` per [Adsgram docs](https://docs.adsgram.ai/publisher/api-reference)
- [ ] Remove `debug: true` before public launch

---

## Phase 5 — BotFather Mini App setup

- [ ] Open [@BotFather](https://t.me/BotFather) → your bot → **Bot Settings** → **Menu Button** or **Web App**
- [ ] Set Web App URL to: `https://YOUR_DEPLOYED_DOMAIN/` (must be HTTPS)
- [ ] (Recommended) Add a direct launch link: `/newapp` or menu button “Play”
- [ ] Open the game **inside Telegram** (not only in desktop browser) — `initData` is empty outside Telegram

---

## Phase 6 — Functional testing (Telegram client)

### Auth & saves

- [ ] Open Mini App from bot → loading screen completes
- [ ] Greeting shows your Telegram first name
- [ ] Play a run → score saves (status shows “✓ Saved”, not only “Saved locally”)
- [ ] Restart app → previous best score / XP load from server
- [ ] Leaderboard loads global top scores

### Anti-cheat / sessions

- [ ] Start game → session created (no console errors for `/api/session/start`)
- [ ] End game → `/api/save-progress` returns `ok: true`
- [ ] (Prod) Saving without playing session should fail (by design)

### Game UX

- [ ] Tutorial shows on first visit, then menu
- [ ] Launch, daily challenge, pause, quit, mute
- [ ] Share button copies / shares with correct bot username
- [ ] Back button behavior (pause / close panels)
- [ ] Works on **iOS Telegram** and **Android Telegram**

### Offline

- [ ] Airplane mode → “connection lost” banner; local fallback still works
- [ ] Back online → retry syncs progress

---

## Phase 7 — Ads launch testing

- [ ] Adsgram account approved and block active
- [ ] Test rewarded ad on **real device** in Telegram (ads often don’t work in desktop browser alone)
- [ ] Confirm revenue/impressions appear in Adsgram dashboard (may take time)
- [ ] Confirm revive only grants reward when `result.done` (watched to end)
- [ ] Policy: ad shown only on revive screen (current design) — acceptable for Telegram ads rules

---

## Phase 8 — Security & ops

- [ ] `.env` is in `.gitignore` and never pushed
- [ ] `ALLOWED_ORIGINS` matches production URL only (no `*` in prod)
- [ ] Bot token rotated if it was ever exposed
- [ ] PostgreSQL not publicly wide-open without strong password
- [ ] (Optional) Enable Sentry `SENTRY_DSN` for production errors
- [ ] (Optional) Uptime monitor on `/health`
- [ ] Review rate limits under real traffic (`RATE_LIMIT_MAX`)

---

## Phase 9 — Polish & known gaps (post-MVP)

These are **not** required for first launch but matter for “full product”:

- [ ] **Friends leaderboard** — currently placeholder (only self); implement friend ID list or Telegram referrals
- [ ] **Daily leaderboard tab** — currently shows global board; add `is_daily` scores in DB if you want a real daily ranking
- [ ] **Adsgram**: consider preloading ad (`AdController` init once at app boot, not only on revive)
- [ ] Privacy policy / terms (Telegram Store & ads networks may ask)
- [ ] App icon & screenshots for bot description / Adsgram app profile

---

## Phase 10 — Go live

- [ ] Final smoke test on production URL inside Telegram
- [ ] BotFather Web App URL points to production (not localhost)
- [ ] Announce / share bot link: `https://t.me/YOUR_BOT_USERNAME`
- [ ] Monitor logs and `/health` for 24–48 hours after launch
- [ ] Watch Adsgram fill rate and user reports (ads failing → revive broken)

---

## Quick reference — files to touch

| What | Where |
|------|--------|
| Bot token, DB, secrets | Host env vars / `.env` (local only) |
| Bot username, Adsgram Block ID | `public/index.html` |
| Adsgram SDK script | `public/index.html` `<head>` |
| Ad logic | `public/src/ui/ads.js` |
| Telegram auth | `server.js` |
| DB schema | `npm run db:migrate` → `scripts/migrate.js` |

---

## Launch readiness summary

| Milestone | You need |
|-----------|----------|
| **Dev / local** | `npm install`, `.env`, optional local Postgres |
| **Soft launch (no real ads)** | Phases 1–6 + deploy; leave `__ADSGRAM_BLOCK_ID__` empty (stub ads) |
| **Full launch with ads** | All phases 1–10; Adsgram SDK + Block ID + testing in real Telegram |

**Current repo status (as shipped):** game + backend ready; env/deploy/Adsgram wiring and BotFather setup still on you.
