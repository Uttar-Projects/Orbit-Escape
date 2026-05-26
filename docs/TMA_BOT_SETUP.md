# Telegram Mini App — Bot shows but game does not open

If you find **@OrbitEscapeGameBot** in Telegram but there is **no Play button** or link **t.me/OrbitEscapeGameBot/orbitescape** does not work, the Mini App is not registered in BotFather yet. The code on Render is not enough by itself.

---

## Quick fix (10 minutes)

### 1. Create / link the Mini App in BotFather

1. Open [@BotFather](https://t.me/BotFather) in Telegram.
2. Send: **`/myapps`**
3. Either:
   - **New App** → choose your bot **@OrbitEscapeGameBot** → name **Orbit Escape**,  
   - Or open existing **Orbit Escape** app if you already created it.
4. Set **Web App URL** (must be HTTPS):

   ```
   https://orbit-escape.onrender.com
   ```

5. Set **Short name** to exactly:

   ```
   orbitescape
   ```

   This creates the direct link:  
   **https://t.me/OrbitEscapeGameBot/orbitescape**

6. Save. BotFather should confirm the app.

### 2. Set the chat menu button (optional but recommended)

**Option A — BotFather**

1. `/mybots` → **@OrbitEscapeGameBot** → **Bot Settings** → **Menu Button**
2. **Configure menu button** → **Web App**
3. Text: `Play Game`
4. URL: `https://orbit-escape.onrender.com`

**Option B — from your PC (project folder)**

```bash
# .env must contain TELEGRAM_BOT_TOKEN=...
npm run telegram:setup
```

### 3. Render env (production)

In Render → **Environment**:

| Key | Value |
|-----|--------|
| `TELEGRAM_BOT_TOKEN` | From BotFather (same bot) |
| `ALLOWED_ORIGINS` | `https://orbit-escape.onrender.com` |

Redeploy after changing env.

### 4. Test in the Telegram app (not Chrome)

1. Open **Telegram on your phone** (iOS/Android).
2. Open: [https://t.me/OrbitEscapeGameBot/orbitescape](https://t.me/OrbitEscapeGameBot/orbitescape)
3. You should see **Launch** / full-screen game inside Telegram.

Opening only `orbit-escape.onrender.com` in Chrome is **not** the Mini App — saves and Telegram login need the in-app link above.

---

## Checklist

| Step | Done? |
|------|--------|
| Bot exists: @OrbitEscapeGameBot | ☐ |
| BotFather `/myapps` → Web App URL = Render URL | ☐ |
| Short name = `orbitescape` | ☐ |
| Menu button = Web App (same URL) | ☐ |
| Render has `TELEGRAM_BOT_TOKEN` | ☐ |
| Test link in **Telegram app** | ☐ |

---

## Common mistakes

| Problem | Fix |
|---------|-----|
| Link `t.me/.../orbitescape` says not found | Short name in BotFather is not `orbitescape` |
| Bot chat has no Play button | Set Menu Button or use direct link above |
| Blank screen in Telegram | Render deploy failed — check `/health` |
| Works in Chrome, not Telegram | Use the `t.me/.../orbitescape` link inside Telegram |

---

## Share with players

```
https://t.me/OrbitEscapeGameBot/orbitescape
```

Or search **@OrbitEscapeGameBot** → menu (☰) → **Play Orbit Escape** (after menu button is set).
