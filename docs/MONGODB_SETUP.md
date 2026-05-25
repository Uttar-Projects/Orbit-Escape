# MongoDB Atlas + Render

You **do not** need Render PostgreSQL. Use your existing **MongoDB cluster**.

---

## 1. Atlas connection string

1. [cloud.mongodb.com](https://cloud.mongodb.com) → your cluster  
2. **Connect** → **Drivers** → **Node.js**  
3. Copy URI, e.g.:

```
mongodb+srv://myuser:mypassword@cluster0.xxxxx.mongodb.net/orbit_escape?retryWrites=true&w=majority
```

4. **Network Access** → add `0.0.0.0/0` (allow Render) or Render’s IPs  
5. **Database Access** → user with read/write on `orbit_escape` db  

---

## 2. Render environment variables

Web service **orbit-escape** → **Environment**:

```
NODE_ENV=production
MONGODB_URI=mongodb+srv://YOUR_USER:YOUR_PASS@cluster0.xxxxx.mongodb.net/orbit_escape?retryWrites=true&w=majority
TELEGRAM_BOT_TOKEN=your_token
SESSION_SECRET=your_64_char_hex
ALLOWED_ORIGINS=https://orbit-escape.onrender.com
LOG_LEVEL=info
RATE_LIMIT_MAX=60
MAX_SCORE_PER_SECOND=2.0
SENTRY_DSN=
```

Remove old `DATABASE_URL` if it pointed to Postgres.

**Manual Deploy** after saving.

---

## 3. Indexes (first deploy)

Render **Shell**:

```bash
npm run db:migrate
```

---

## 4. Verify

```
https://orbit-escape.onrender.com/health
```

`database.status` should be `"ok"`.

```powershell
npm run phase2:verify -- https://orbit-escape.onrender.com
```

---

## Local dev

In `.env`:

```
MONGODB_URI=mongodb+srv://...
NODE_ENV=development
```

Then: `npm run db:migrate` → `npm start`
