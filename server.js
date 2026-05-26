'use strict';

// ---------------------------------------------------------------------------
// Bootstrap — .env FIRST
// ---------------------------------------------------------------------------
require('dotenv').config();

const express     = require('express');
const crypto      = require('crypto');
const path        = require('path');
const helmet      = require('helmet');
const cors        = require('cors');
const compression = require('compression');
const rateLimit   = require('express-rate-limit');

const logger      = require('./config/logger');
const db          = require('./config/database');
const sentry      = require('./monitoring/sentry');
const { healthHandler }             = require('./monitoring/healthcheck');
const { createSessionToken,
        verifySessionToken,
        validateScoreAgainstSession,
        attachSession }             = require('./middleware/session');

// ---------------------------------------------------------------------------
// Env validation
// ---------------------------------------------------------------------------
const HAS_DB = !!(process.env.MONGODB_URI
    || (process.env.DATABASE_URL && process.env.DATABASE_URL.startsWith('mongodb')));
const REQUIRED = ['TELEGRAM_BOT_TOKEN', 'SESSION_SECRET'];
if (process.env.NODE_ENV === 'production' && !HAS_DB) {
    REQUIRED.push('MONGODB_URI');
}
const missing  = REQUIRED.filter(k => !process.env[k]);
if (missing.length) {
    logger.error(`Missing env vars: ${missing.join(', ')}. Copy .env.example → .env`);
    if (process.env.NODE_ENV === 'production') process.exit(1);
    else logger.warn('Continuing in dev mode...');
}

const PORT      = parseInt(process.env.PORT || '3000', 10);
const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN || '';
const IS_PROD   = process.env.NODE_ENV === 'production';

// ---------------------------------------------------------------------------
// CORS
// ---------------------------------------------------------------------------
const allowedOrigins = (process.env.ALLOWED_ORIGINS || '')
    .split(',').map(s => s.trim()).filter(Boolean);

const corsOptions = {
    origin: (origin, cb) => {
        // Allow same-origin / curl / server-side requests with no Origin header
        if (!origin) return cb(null, true);
        // In dev, always allow localhost regardless of ALLOWED_ORIGINS
        if (!IS_PROD && /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin)) {
            return cb(null, true);
        }
        if (!IS_PROD || allowedOrigins.includes(origin)) return cb(null, true);
        cb(new Error(`CORS: '${origin}' not allowed`));
    },
    methods: ['GET', 'POST', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'X-Session-Token'],
    optionsSuccessStatus: 204
};

// ---------------------------------------------------------------------------
// Rate limiters
// ---------------------------------------------------------------------------
const apiLimiter = rateLimit({
    windowMs: 60_000,
    max: parseInt(process.env.RATE_LIMIT_MAX || '60', 10),
    standardHeaders: true, legacyHeaders: false,
    keyGenerator: req => req.ip,
    handler: (req, res) => {
        logger.warn('Rate limit exceeded', { ip: req.ip, path: req.path });
        res.status(429).json({ ok: false, error: 'Too many requests. 🚦' });
    }
});

const saveLimiter = rateLimit({
    windowMs: 10_000, max: 5,
    keyGenerator: req => req.ip,
    handler: (req, res) => {
        logger.warn('Save rate limit exceeded', { ip: req.ip });
        res.status(429).json({ ok: false, error: 'Saving too fast. Flagged. 🚨' });
    }
});

const sessionLimiter = rateLimit({
    windowMs: 30_000, max: 10,  // max 10 session starts per 30s per IP
    keyGenerator: req => req.ip,
    handler: (_req, res) => res.status(429).json({ ok: false, error: 'Too many sessions started.' })
});

// ---------------------------------------------------------------------------
// Telegram initData HMAC-SHA256 verification
// ---------------------------------------------------------------------------
function verifyTelegramInitData(initData, botToken) {
    if (!initData) return { ok: false, user: null, error: 'initData empty' };
    if (!botToken) return { ok: false, user: null, error: 'BOT_TOKEN not configured' };

    try {
        const params       = new URLSearchParams(initData);
        const receivedHash = params.get('hash');
        if (!receivedHash) return { ok: false, user: null, error: 'Missing hash' };
        params.delete('hash');

        const sortedPairs = Array.from(params.entries())
            .sort(([a], [b]) => a.localeCompare(b))
            .map(([k, v]) => `${k}=${v}`)
            .join('\n');

        const secretKey = crypto.createHmac('sha256', 'WebAppData').update(botToken).digest();
        const expected  = crypto.createHmac('sha256', secretKey).update(sortedPairs).digest('hex');

        const recv = Buffer.from(receivedHash, 'hex');
        const exp  = Buffer.from(expected, 'hex');
        if (recv.length !== exp.length || !crypto.timingSafeEqual(recv, exp)) {
            return { ok: false, user: null, error: 'Hash mismatch' };
        }

        // Reject stale data (>1 hour)
        const age = Math.floor(Date.now() / 1000) - parseInt(params.get('auth_date') || '0', 10);
        if (age > 3600) return { ok: false, user: null, error: `initData expired (${age}s old)` };

        let user = null;
        const userJson = params.get('user');
        if (userJson) user = JSON.parse(decodeURIComponent(userJson));

        return { ok: true, user, error: null };
    } catch (err) {
        return { ok: false, user: null, error: `Verification error: ${err.message}` };
    }
}

// ---------------------------------------------------------------------------
// Auth middleware
// ---------------------------------------------------------------------------
function requireTelegramAuth(req, res, next) {
    if (!BOT_TOKEN) {
        logger.warn('No BOT_TOKEN — using dev mock user');
        req.tgUser = { id: 0, first_name: 'Dev', username: 'dev_user' };
        return next();
    }
    const result = verifyTelegramInitData(req.body?.initData, BOT_TOKEN);
    if (!result.ok) {
        logger.warn('Auth failed', { error: result.error, ip: req.ip });
        return res.status(401).json({ ok: false, error: result.error });
    }
    req.tgUser = result.user;
    next();
}

// ---------------------------------------------------------------------------
// App
// ---------------------------------------------------------------------------
const app = express();
app.set('trust proxy', 1);

// Sentry — init before middleware, attach error handler after routes
sentry.init();

// Security headers
app.use(helmet({
    contentSecurityPolicy: {
        directives: {
            defaultSrc:  ["'self'"],
            scriptSrc:   ["'self'", "'unsafe-inline'", "https://telegram.org", "https://sad.adsgram.ai"],
            styleSrc:    ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
            fontSrc:     ["'self'", "https://fonts.gstatic.com"],
            imgSrc:      ["'self'", "data:", "https:"],
            connectSrc:  ["'self'", "https://api.telegram.org", "https://sad.adsgram.ai", "https://api.adsgram.ai"],
            frameSrc:    ["'self'", "https://sad.adsgram.ai", "https://adsgram.ai"],
            objectSrc:   ["'none'"]
        }
    },
    crossOriginEmbedderPolicy: false
}));

app.use(cors(corsOptions));
app.use(compression());
app.use(express.json({ limit: '16kb' }));
app.use(attachSession); // attach game session to every request

// Request logger
app.use((req, res, next) => {
    const t = Date.now();
    res.on('finish', () => logger.info('HTTP', {
        method: req.method, path: req.path,
        status: res.statusCode, ms: Date.now() - t, ip: req.ip
    }));
    next();
});

// Static frontend
// index.html: always revalidate so new deploys are picked up immediately
// (Telegram WebView caches aggressively; max-age on index.html breaks updates)
// JS/CSS/assets: cache 1 day in prod for performance
app.use(express.static(path.join(__dirname, 'public'), {
    maxAge: IS_PROD ? '1d' : 0,
    etag:   true,
    setHeaders(res, filePath) {
        if (filePath.endsWith('index.html') || filePath.endsWith('/')) {
            res.setHeader('Cache-Control', 'no-cache, must-revalidate');
        } else if (!IS_PROD) {
            res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate');
        }
    }
}));

// Apply general rate limiter to all /api routes
app.use('/api/', apiLimiter);

// ---------------------------------------------------------------------------
// Routes
// ---------------------------------------------------------------------------

// ── GET /health ──────────────────────────────────────────────────────────────
app.get('/health', (req, res) => healthHandler(db.testConnection, req, res));

// ── GET /api/ad-reward — Adsgram server-side reward callback ─────────────────
// Adsgram calls this URL after a user completes watching a rewarded ad.
// The [userId] placeholder is replaced by Adsgram with the Telegram user ID.
app.get('/api/ad-reward', (req, res) => {
    const userId = req.query.userId;
    console.log(`[Adsgram] Reward callback for userId=${userId}`);
    res.status(200).json({ ok: true });
});

// ── POST /api/get-progress ───────────────────────────────────────────────────
app.post('/api/get-progress', requireTelegramAuth, async (req, res) => {
    const userId = req.tgUser?.id;
    if (userId == null) return res.status(400).json({ ok: false, error: 'No user' });
    try {
        const data = await db.getProgress(userId);
        return res.json({ ok: true, userId, bestScore: data?.bestScore ?? 0, totalXp: data?.totalXp ?? 0 });
    } catch (err) {
        sentry.captureException(err, { userId });
        logger.error('get-progress error', { userId, error: err.message });
        return res.status(500).json({ ok: false, error: 'Database error' });
    }
});

// ── POST /api/session/start ───────────────────────────────────────────────────
// Client calls this at the START of each game. Returns a signed sessionToken.
app.post('/api/session/start', sessionLimiter, requireTelegramAuth, async (req, res) => {
    const userId = req.tgUser?.id;
    if (userId == null) return res.status(400).json({ ok: false, error: 'No user' });

    try {
        await db.ensureUser(userId, {
            username:  req.tgUser?.username,
            firstName: req.tgUser?.first_name
        });

        const sessionId    = await db.createGameSession(userId);
        const sessionToken = createSessionToken(userId, sessionId);

        logger.info('Session started', { userId, sessionId });
        return res.json({ ok: true, sessionToken });

    } catch (err) {
        sentry.captureException(err, { userId });
        logger.error('session/start error', { error: err.message });
        return res.status(500).json({ ok: false, error: 'Could not create session' });
    }
});

// ── POST /api/save-progress ───────────────────────────────────────────────────
app.post('/api/save-progress', saveLimiter, requireTelegramAuth, async (req, res) => {
    const userId = req.tgUser?.id;
    if (userId == null) return res.status(400).json({ ok: false, error: 'No user' });

    const { score, xp, sessionToken } = req.body;

    // Sanitize inputs
    const safeScore = Math.max(0, Math.min(Math.floor(Number(score) || 0), 10_000));
    const safeXp    = Math.max(0, Math.min(Math.floor(Number(xp)    || 0), 100_000_000));

    // ── Anti-cheat: validate session token against server DB ──────────────
    let sessionCheckPassed = false;
    let sessionId          = null;
    let rejectReason       = null;

    if (sessionToken) {
        const session = verifySessionToken(sessionToken);

        if (!session.valid) {
            rejectReason = `Invalid session token: ${session.reason}`;
        } else if (session.userId !== userId) {
            rejectReason = 'Session user mismatch';
        } else {
            sessionId = session.sessionId;

            // Cross-check against DB: was this session actually started for this user?
            const dbStartTime = await db.getSessionStartTime(sessionId, userId);

            if (!dbStartTime) {
                rejectReason = 'Session not found in DB or already closed';
            } else {
                // Validate score against SERVER-TRACKED start time
                const check = validateScoreAgainstSession(safeScore, dbStartTime.getTime());
                if (!check.valid) {
                    rejectReason = check.reason;
                    sentry.captureEvent('Anti-cheat: score rejected', 'warning', {
                        userId, safeScore, reason: check.reason, ip: req.ip
                    });
                } else {
                    sessionCheckPassed = true;
                }
            }
        }
    } else {
        // No session token supplied — soft-fail in dev, hard-fail in prod
        if (IS_PROD) {
            logger.warn('Missing sessionToken in production', { userId, ip: req.ip });
            return res.status(400).json({ ok: false, error: 'sessionToken required' });
        }
        logger.warn('No sessionToken — bypassing in dev mode', { userId });
        sessionCheckPassed = true;
    }

    if (!sessionCheckPassed) {
        logger.warn('Anti-cheat: submission rejected', { userId, safeScore, rejectReason, ip: req.ip });
        await db.logSubmission(userId, safeScore, safeXp, null, false, rejectReason);
        if (sessionId) await db.closeGameSession(sessionId, userId, safeScore, false);
        return res.status(400).json({ ok: false, error: 'Score validation failed', reason: rejectReason });
    }

    // ── Persist ───────────────────────────────────────────────────────────
    try {
        const saved = await db.upsertProgress(userId, {
            username:  req.tgUser?.username,
            firstName: req.tgUser?.first_name,
            score:     safeScore,
            xp:        safeXp
        });

        await db.logSubmission(userId, safeScore, safeXp, null, true, null);
        if (sessionId) await db.closeGameSession(sessionId, userId, safeScore, true);

        logger.info('Progress saved', { userId, score: safeScore, best: saved.bestScore });
        return res.json({ ok: true, userId, bestScore: saved.bestScore, totalXp: saved.totalXp });

    } catch (err) {
        sentry.captureException(err, { userId });
        logger.error('save-progress DB error', { userId, error: err.message });
        return res.status(500).json({ ok: false, error: 'Database error' });
    }
});

// ── GET /api/leaderboard ─────────────────────────────────────────────────────
app.get('/api/leaderboard', async (req, res) => {
    const limit = Math.min(parseInt(req.query.limit || '10', 10), 50);
    try {
        const board = await db.getLeaderboard(limit);
        return res.json({ ok: true, leaderboard: board });
    } catch (err) {
        sentry.captureException(err);
        logger.error('Leaderboard error', { error: err.message });
        return res.status(500).json({ ok: false, error: 'Database error' });
    }
});

// ---------------------------------------------------------------------------
// ── GET /api/adsgram/reward ───────────────────────────────────────────────────
// Adsgram server-side reward callback (optional; client revive uses AdBroker.show).
// Paste in Adsgram block → Reward URL (keep literal [userId] — Adsgram replaces it):
//   https://YOUR_HTTPS_DOMAIN/api/adsgram/reward?userid=[userId]
app.get('/api/adsgram/reward', (req, res) => {
    const raw = req.query.userid ?? req.query.userId ?? req.query.tgid;
    const userId = parseInt(String(raw || ''), 10);

    if (!Number.isFinite(userId) || userId <= 0) {
        logger.warn('Adsgram reward: invalid userid', { raw, ip: req.ip });
        return res.status(400).send('invalid userid');
    }

    logger.info('Adsgram reward callback', { userId, ip: req.ip });
    // Extend here if you need DB logging of rewarded views
    return res.status(200).send('ok');
});

// ── GET /api/daily-seed ──────────────────────────────────────────────────────
// Returns a deterministic seed for today's daily challenge.
// All players on the same calendar day get the same seed → identical obstacle
// spawn sequence when the seeded RNG is used in the game engine.
app.get('/api/daily-seed', (req, res) => {
    const now   = new Date();
    const dateStr = `${now.getUTCFullYear()}-${now.getUTCMonth()}-${now.getUTCDate()}`;
    // Simple but collision-resistant hash of the date string
    const seed  = dateStr.split('').reduce((a, c) => (Math.imul(a, 31) + c.charCodeAt(0)) | 0, 0x9e3779b9);
    return res.json({
        ok:      true,
        seed:    Math.abs(seed),
        date:    dateStr,
        expires: new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1)).toISOString()
    });
});

// ── POST /api/leaderboard/friends ─────────────────────────────────────────────
// Returns leaderboard rows filtered to a provided list of Telegram user IDs.
// Client sends the IDs of friends who have also played the game.
app.post('/api/leaderboard/friends', requireTelegramAuth, async (req, res) => {
    const { friendIds } = req.body;
    if (!Array.isArray(friendIds) || friendIds.length === 0) {
        return res.status(400).json({ ok: false, error: 'friendIds array required' });
    }
    // Sanitize: integers only, cap at 200 entries
    const safe = friendIds
        .map(id => parseInt(id, 10))
        .filter(id => Number.isFinite(id) && id > 0)
        .slice(0, 200);

    if (safe.length === 0) {
        return res.status(400).json({ ok: false, error: 'No valid friend IDs provided' });
    }

    try {
        const leaderboard = await db.getFriendsLeaderboard(safe);
        return res.json({ ok: true, leaderboard });
    } catch (err) {
        sentry.captureException(err);
        logger.error('Friends leaderboard error', { error: err.message });
        return res.status(500).json({ ok: false, error: 'Database error' });
    }
});

// Error handlers
// ---------------------------------------------------------------------------
sentry.setupErrorHandler(app);

app.use((_req, res) => res.status(404).json({ ok: false, error: 'Not found' }));

// eslint-disable-next-line no-unused-vars
app.use((err, req, res, _next) => {
    logger.error('Unhandled error', { message: err.message, stack: err.stack });
    res.status(500).json({ ok: false, error: IS_PROD ? 'Internal server error' : err.message });
});

// ---------------------------------------------------------------------------
// Startup
// ---------------------------------------------------------------------------
async function start() {
    let databaseStatus = 'connected';

    const maxAttempts = IS_PROD ? 5 : 1;
    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
        try {
            await db.testConnection();
            break;
        } catch (err) {
            if (attempt < maxAttempts) {
                logger.warn('MongoDB connect retry', { attempt, error: err.message });
                await new Promise(r => setTimeout(r, 2000 * attempt));
                continue;
            }
            databaseStatus = 'offline (game uses browser localStorage until DB connects)';
            logger.error('MongoDB unavailable — starting anyway', { error: err.message });
        }
    }

    app.listen(PORT, () => {
        logger.info('🚀 Orbit Escape TMA v3 started', {
            port:     PORT,
            env:      process.env.NODE_ENV || 'development',
            botToken: BOT_TOKEN ? '✅ set' : '⚠️  MISSING (dev mock user enabled)',
            sentry:   process.env.SENTRY_DSN ? '✅ enabled' : '⚠️  disabled',
            database: databaseStatus
        });
    });
}

process.on('SIGTERM', async () => { logger.info('SIGTERM — shutting down'); await db.close(); process.exit(0); });
process.on('SIGINT',  async () => { logger.info('SIGINT  — shutting down'); await db.close(); process.exit(0); });

start();
