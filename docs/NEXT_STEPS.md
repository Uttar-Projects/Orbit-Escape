# Orbit Escape — What To Do Next

**Status:** ~85% ready · Production: [https://orbit-escape.onrender.com](https://orbit-escape.onrender.com) · Health + MongoDB ✅

Work through this list **in order**. Check boxes as you go.

---

## ✅ Already done (skip)

- [x] Game built and deployed on Render
- [x] MongoDB Atlas connected (`/health` → database `ok`)
- [x] Bot **@OrbitEscapeGameBot** + Mini App link `https://t.me/OrbitEscapeGameBot/orbitescape`
- [x] Adsgram block **32481** in code + SDK
- [x] GitHub: [Uttar-Projects/Orbit-Escape](https://github.com/Uttar-Projects/Orbit-Escape)
- [x] Render env vars (production)

Verify anytime:

```powershell
npm run phase1:verify
npm run phase2:verify -- https://orbit-escape.onrender.com
```

---

## Step 1 — Security (15 min) 🔐

- [ ] [@BotFather](https://t.me/BotFather) → `/mybots` → **Orbit Escape** → **Revoke token** → copy **new** token
- [ ] Update **Render** → Environment → `TELEGRAM_BOT_TOKEN` = new token
- [ ] Update local **`.env`** → `TELEGRAM_BOT_TOKEN` = new token
- [ ] MongoDB Atlas → **Database Access** → change password for user `sovik`
- [ ] Update **Render** → `MONGODB_URI` with new password (`#` → `%23` in URL)
- [ ] **Manual Deploy** on Render after changes

---

## Step 2 — BotFather Mini App (required for game in Telegram) 🤖

**If you only see the bot but no game:** follow **[docs/TMA_BOT_SETUP.md](TMA_BOT_SETUP.md)**.

- [ ] [@BotFather](https://t.me/BotFather) → `/myapps` → create/edit **Orbit Escape** for **@OrbitEscapeGameBot**
- [ ] **Web App URL** → `https://orbit-escape.onrender.com`
- [ ] **Short name** → `orbitescape` (link: `https://t.me/OrbitEscapeGameBot/orbitescape`)
- [ ] Menu button → Web App (same URL), or run `npm run telegram:setup`
- [ ] (Optional) `/setdescription`, `/setuserpic`

---

## Step 3 — Adsgram production URLs (5 min) 📺

Open [partner.adsgram.ai](https://partner.adsgram.ai) → platform **Orbit Escape**:

| Field | Paste |
|--------|--------|
| **App url** | `https://orbit-escape.onrender.com` |
| **Reward URL** | `https://orbit-escape.onrender.com/api/adsgram/reward?userid=[userId]` |
| **Test platform** | ☐ Uncheck (production) |

- [ ] Reward block **32481** is **Active**
- [ ] (If pending) Message [@adsgramsupport](https://t.me/adsgramsupport) for moderation

---

## Step 4 — Render cleanup (2 min) ☁️

- [ ] **Delete** `SENTRY_DSN` or leave **empty** (not `value`)
- [ ] Confirm **Build Command:** `npm ci`
- [ ] Confirm **Start Command:** `npm run start:prod`
- [ ] **Manual Deploy** → wait for green ✅

---

## Step 5 — Test on your phone (15 min) 📱

Open in **Telegram app** (not desktop browser):

**Link:** [t.me/OrbitEscapeGameBot/orbitescape](https://t.me/OrbitEscapeGameBot/orbitescape)

| Test | Pass? |
|------|-------|
| App loads, no blank screen | ☐ |
| Menu shows your first name | ☐ |
| Play → die → score shows **✓ Saved** (not only “Saved locally”) | ☐ |
| Close & reopen → best score / XP remembered | ☐ |
| **Leaderboard** loads scores | ☐ |
| Die → **Watch ad** → real ad plays → revive works | ☐ |
| **Share** button uses @OrbitEscapeGameBot | ☐ |

If saves stay local only → check Render logs + `TELEGRAM_BOT_TOKEN` on Render.

If ads don’t show → must test in Telegram on phone; check Adsgram block status.

---

## Step 6 — Go live (10 min) 🚀

- [ ] `/health` in browser → `"ok": true`, database `"ok"`
- [ ] Share bot with friends: `https://t.me/OrbitEscapeGameBot/orbitescape`
- [ ] (Optional) Post in channel / group
- [ ] Watch Render **Logs** for 24h for errors
- [ ] Watch Adsgram dashboard for impressions

---

## Step 7 — Later / optional (post-launch)

- [ ] Friends leaderboard (real friend IDs — currently placeholder)
- [ ] Daily leaderboard (separate from global)
- [ ] Sentry real DSN for error tracking
- [ ] Custom domain on Render
- [ ] Privacy policy / terms page
- [ ] Local `.env`: add `MONGODB_URI` for dev (replace old Postgres `DATABASE_URL`)

---

## Quick copy-paste

```
BotFather Web App URL:  https://orbit-escape.onrender.com
Adsgram App url:        https://orbit-escape.onrender.com
Adsgram Reward URL:     https://orbit-escape.onrender.com/api/adsgram/reward?userid=[userId]
Share link:             https://t.me/OrbitEscapeGameBot/orbitescape
Health check:           https://orbit-escape.onrender.com/health
```

---

## You’re “launched” when

- [x] Production health OK  
- [ ] Steps 1–5 complete  
- [ ] At least one real Telegram play-through with cloud save  

**Estimated time to launch:** ~45–60 minutes (mostly testing + security).
