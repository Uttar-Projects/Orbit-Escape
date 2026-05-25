# Phase 1 — Accounts & bot (do this now)

Complete these in order. Each step takes about 2–5 minutes.

---

## Part A — Telegram bot (BotFather)

### 1. Create the bot

1. Open Telegram and message **[@BotFather](https://t.me/BotFather)**.
2. Send: `/newbot`
3. **Display name** (users see this): e.g. `Orbit Escape`
4. **Username** (must end in `bot`): e.g. `OrbitEscapeGameBot`  
   - Write down the username **without** `@` — you need it for `public/index.html`.

### 2. Save the token

BotFather replies with a token like:

```
123456789:AAHxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
```

1. Copy it once (you won’t see it again if you revoke it).
2. Open your project `.env` file (same folder as `package.json`).
3. Set:

   ```
   TELEGRAM_BOT_TOKEN=paste_your_token_here
   ```

   No quotes, no spaces around `=`.

4. **Never** commit `.env` to git.

### 3. Verify the bot (on your PC)

In the project folder, run:

```bash
npm run phase1:verify
```

You should see `✅ Bot token valid` and your `@username`.

### 4. Optional polish (BotFather)

| Command | What to set |
|---------|-------------|
| `/setdescription` | Short game description for bot profile |
| `/setabouttext` | One line about the game |
| `/setuserpic` | Upload a square icon (512×512 recommended) |

**Do not** set the Web App URL yet — that’s Phase 5 after you deploy HTTPS.

---

## Part B — Adsgram (rewarded ads)

### 1. Register ✅ (you did this)

1. Open **[https://partner.adsgram.ai](https://partner.adsgram.ai)** in a browser.
2. Log in with **Telegram** (use the same account you use for the bot if possible).
3. Complete publisher registration / profile.

### 1b. After Telegram is connected — do this next

1. In the left menu, open **Apps** / **Applications** (or **Add app**).
2. Click **Create app** (or **Add Mini App**).
3. Fill in:
   - **Name:** `Orbit Escape`
   - **Bot:** `@OrbitEscapeGameBot` (if the form asks)
   - **URL:** `https://example.com` for now — you will change this to your real HTTPS URL in Phase 5 after deploy
4. Save the app. If status is **Pending moderation**, wait for approval (email/Telegram notification possible).
5. Open your app → **Ad blocks** → **Create block**.
6. Choose format: **Rewarded** (required for “watch ad to revive”).
7. Copy the **Block ID** (numeric string, e.g. `12345`).
8. Send the Block ID here (safe to share) — we will put it in `public/index.html`.

The Adsgram SDK script is already in `index.html`; only the Block ID is missing.

### 2. Add your Mini App

1. In the Adsgram dashboard, create or select an **application** / Mini App.
2. Name: `Orbit Escape` (or match your bot name).
3. URL: leave blank or use `https://localhost` for now — you’ll update to production URL in Phase 5.
4. Submit for moderation if the dashboard asks — approval can take hours to days.

### 3. Create a Rewarded block (+ Reward URL)

1. Click **+ Block** → type **Reward**.
2. **Reward URL** — paste exactly (keep `[userId]` literally):

   ```
   https://YOUR_HTTPS_DOMAIN/api/adsgram/reward?userid=[userId]
   ```

   **No deploy yet?** Use [ngrok](https://ngrok.com): `ngrok http 3000` while `npm start` runs, then:

   ```
   https://YOUR-NGROK-URL/api/adsgram/reward?userid=[userId]
   ```

   Replace `YOUR_HTTPS_DOMAIN` after Railway/Render deploy (Phase 2).

3. Copy the **Block ID** (usually numeric digits, e.g. `12345`).

### 4. Put Block ID in the project

Edit `public/index.html` and set:

```html
window.__ADSGRAM_BLOCK_ID__ = 'YOUR_BLOCK_ID';
```

Use quotes around the ID if it’s numeric.

Also add the SDK in `<head>` (after the Telegram script):

```html
<script src="https://sad.adsgram.ai/js/sad.min.js"></script>
```

### 5. Verify Adsgram (manual)

- Block ID is set in `index.html` (not empty).
- SDK script tag is present.
- Full ad test happens in **Phase 7** inside Telegram on a phone.

---

## Part C — Record your values

Fill this in locally (not in git):

| Item | Your value |
|------|------------|
| Bot display name | |
| Bot username (no @) | |
| Token in `.env` | ✅ / ❌ |
| `npm run phase1:verify` | ✅ / ❌ |
| Adsgram account | ✅ / ❌ |
| Adsgram Block ID | |
| Block ID in `index.html` | ✅ / ❌ |

---

## When Phase 1 is done

- [ ] `TELEGRAM_BOT_TOKEN` in `.env` and `npm run phase1:verify` passes  
- [ ] Bot username written down  
- [ ] `window.__BOT_USERNAME__` updated in `public/index.html`  
- [ ] Adsgram Block ID in `public/index.html` + `sad.min.js` script added  
- [ ] Check off Phase 1 in `LAUNCH_CHECKLIST.md`  

**Next:** Phase 2 — hosting & database.
