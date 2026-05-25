'use strict';

/**
 * middleware/session.js
 * =====================
 * Server-issued, HMAC-signed game session tokens.
 *
 * Flow:
 *   1. Client calls POST /api/session/start  (verified Telegram initData required)
 *      → Server records { userId, startedAt } in DB, returns signed sessionToken
 *
 *   2. Client stores sessionToken in memory for the duration of one game
 *
 *   3. Client sends sessionToken alongside score in POST /api/save-progress
 *      → Server verifies signature, cross-checks timing, rejects impossible scores
 *
 * This makes it impossible to:
 *   - Fabricate a score without first obtaining a server-issued token
 *   - Reuse an old token (tokens expire after MAX_SESSION_HOURS)
 *   - Claim a score higher than what is physically achievable in the elapsed time
 */

const crypto = require('crypto');
const logger = require('../config/logger');

const SESSION_SECRET     = process.env.SESSION_SECRET || crypto.randomBytes(32).toString('hex');
const MAX_SESSION_MS     = 4 * 60 * 60 * 1000;   // 4 hours hard cap
const MAX_SCORE_PER_SEC  = parseFloat(process.env.MAX_SCORE_PER_SECOND || '2.0');

if (!process.env.SESSION_SECRET) {
    logger.warn('SESSION_SECRET not set — using ephemeral random secret. Sessions will break on restart.');
}

// ---------------------------------------------------------------------------
// Token generation
// ---------------------------------------------------------------------------

/**
 * Create a signed session token.
 * Payload: base64url(JSON) + "." + HMAC signature
 */
function createSessionToken(userId, sessionId) {
    const payload = Buffer.from(JSON.stringify({
        uid:  userId,
        sid:  sessionId,
        iat:  Date.now()
    })).toString('base64url');

    const sig = crypto
        .createHmac('sha256', SESSION_SECRET)
        .update(payload)
        .digest('base64url');

    return `${payload}.${sig}`;
}

/**
 * Verify and decode a session token.
 * Returns { valid, userId, sessionId, startedAt, ageMs } or { valid: false }
 */
function verifySessionToken(token) {
    if (!token || typeof token !== 'string') {
        return { valid: false, reason: 'Missing token' };
    }

    const parts = token.split('.');
    if (parts.length !== 2) {
        return { valid: false, reason: 'Malformed token' };
    }

    const [payload, receivedSig] = parts;

    // Verify signature
    const expectedSig = crypto
        .createHmac('sha256', SESSION_SECRET)
        .update(payload)
        .digest('base64url');

    const recv = Buffer.from(receivedSig, 'base64url');
    const exp  = Buffer.from(expectedSig, 'base64url');

    if (recv.length !== exp.length || !crypto.timingSafeEqual(recv, exp)) {
        return { valid: false, reason: 'Invalid signature' };
    }

    // Decode payload
    let data;
    try {
        data = JSON.parse(Buffer.from(payload, 'base64url').toString());
    } catch {
        return { valid: false, reason: 'Malformed payload' };
    }

    const ageMs = Date.now() - data.iat;

    if (ageMs > MAX_SESSION_MS) {
        return { valid: false, reason: `Session expired (age: ${Math.floor(ageMs / 60000)}min)` };
    }

    return {
        valid:     true,
        userId:    data.uid,
        sessionId: data.sid,
        startedAt: data.iat,
        ageMs
    };
}

// ---------------------------------------------------------------------------
// Score validation against server-tracked timing
// ---------------------------------------------------------------------------

/**
 * Validate a claimed score against the elapsed session time.
 * Uses server-side startedAt (not client-reported sessionMs) as the source of truth.
 *
 * @param {number} claimedScore
 * @param {number} sessionStartedAt  — ms timestamp from the verified token
 * @returns {{ valid: boolean, reason: string|null }}
 */
function validateScoreAgainstSession(claimedScore, sessionStartedAt) {
    const elapsedSec    = (Date.now() - sessionStartedAt) / 1000;
    const maxPossible   = elapsedSec * MAX_SCORE_PER_SEC;

    if (claimedScore < 0) {
        return { valid: false, reason: 'Negative score' };
    }

    if (claimedScore > 10_000) {
        return { valid: false, reason: 'Score exceeds all-time cap (10,000)' };
    }

    // Apply 15% tolerance for network latency and frame-rate variation
    if (claimedScore > maxPossible * 1.15) {
        return {
            valid:  false,
            reason: `Score ${claimedScore} impossible in ${elapsedSec.toFixed(1)}s (server max: ${maxPossible.toFixed(0)})`
        };
    }

    return { valid: true, reason: null };
}

// ---------------------------------------------------------------------------
// Active session store (PostgreSQL-backed — see database.js)
// ---------------------------------------------------------------------------
// We reference db lazily to avoid circular require at startup
let _db = null;
function db() {
    if (!_db) _db = require('../config/database');
    return _db;
}

// ---------------------------------------------------------------------------
// Exports
// ---------------------------------------------------------------------------
module.exports = {
    createSessionToken,
    verifySessionToken,
    validateScoreAgainstSession,

    /**
     * Express middleware — attaches req.session if a valid token is present.
     * Does NOT reject the request if missing; individual routes decide.
     */
    attachSession(req, _res, next) {
        const token = req.body?.sessionToken || req.headers['x-session-token'];
        if (token) {
            req.gameSession = verifySessionToken(token);
            if (!req.gameSession.valid) {
                logger.warn('Invalid session token presented', {
                    reason: req.gameSession.reason,
                    ip: req.ip
                });
            }
        }
        next();
    }
};
