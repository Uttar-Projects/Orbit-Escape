# Phase 1 — Option A (tunnel now, complete Adsgram Reward URL)

Use this to finish the **Reward URL** before Railway deploy.

---

## 1. Start the game server

```powershell
cd "c:\Users\USER\Desktop\New folder\orbit-escape-tma-v4\orbit-escape-tma-v4"
npm start
```

Leave this window open. Server runs even if PostgreSQL is offline (503 on `/health` is OK).

---

## 2. Start a public HTTPS tunnel (pick one)

### A) ngrok (recommended — stable URL while running)

1. Sign up: https://dashboard.ngrok.com/signup  
2. Copy authtoken: https://dashboard.ngrok.com/get-started/your-authtoken  
3. Run once:
   ```powershell
   ngrok config add-authtoken YOUR_TOKEN_HERE
   ```
4. New terminal:
   ```powershell
   ngrok http 3000
   ```
5. Copy the **https** URL (e.g. `https://abc123.ngrok-free.app`).

### B) localtunnel (no account — URL changes each run)

New terminal while `npm start` is running:

```powershell
npx localtunnel --port 3000
```

Copy the `https://....loca.lt` URL it prints.

---

## 3. Paste into Adsgram — Reward block

**Reward URL** (keep `[userId]` exactly):

```
https://YOUR-TUNNEL-URL/api/adsgram/reward?userid=[userId]
```

Example (replace with your tunnel):

```
https://abc123.ngrok-free.app/api/adsgram/reward?userid=[userId]
```

| Field | Value |
|--------|--------|
| Block type | **Reward** |
| Name | `Revive` |
| Reward URL | see above |

---

## 4. Test the URL

In a browser (ngrok) or with header (localtunnel):

```
https://YOUR-TUNNEL-URL/api/adsgram/reward?userid=123456789
```

Expected response: `ok`

localtunnel may show a warning page first — click Continue, or use ngrok for fewer issues.

---

## 5. Copy Block ID → project

1. After block is created → **Show code** → **Copy Block ID**
2. Set in `public/index.html`:
   ```html
   window.__ADSGRAM_BLOCK_ID__ = 'YOUR_BLOCK_ID';
   ```
3. Run: `npm run phase1:verify`

---

## 6. Optional — open game via tunnel (test in Telegram)

1. BotFather `/myapps` → set **Web App URL** to your tunnel URL (temporary):
   `https://YOUR-TUNNEL-URL`
2. Open https://t.me/OrbitEscapeGameBot/orbitescape in Telegram
3. Die once → **Watch ad** → test revive

Revert Web App URL to production domain after Phase 2.

---

## Phase 1 complete checklist

- [x] Bot + token in `.env`
- [x] `@OrbitEscapeGameBot` in `index.html`
- [x] Adsgram platform Active
- [x] Direct link `https://t.me/OrbitEscapeGameBot/orbitescape`
- [ ] Reward block + Reward URL (tunnel)
- [ ] Block ID in `index.html`
- [ ] `npm run phase1:verify` all green

**Next:** Phase 2 — Railway deploy (replace tunnel URLs with permanent domain).
