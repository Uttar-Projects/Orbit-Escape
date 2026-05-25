'use strict';

const crypto   = require('crypto');
const { MongoClient } = require('mongodb');
const logger   = require('./logger');

function getMongoUri() {
    const uri = process.env.MONGODB_URI
        || (process.env.DATABASE_URL?.startsWith('mongodb') ? process.env.DATABASE_URL : null);
    return uri || null;
}

const uri = getMongoUri();
let client = null;
let db     = null;

async function getDb() {
    if (!uri) throw new Error('MONGODB_URI not configured');
    if (db) return db;
    client = new MongoClient(uri);
    await client.connect();
    db = client.db(); // database name from connection string
    logger.info('MongoDB connected successfully');
    return db;
}

async function testConnection() {
    const database = await getDb();
    await database.command({ ping: 1 });
}

async function close() {
    if (client) {
        await client.close();
        client = null;
        db     = null;
    }
}

// Legacy alias for healthcheck / shutdown callers
const pool = { query: () => { throw new Error('Use MongoDB API — pool.query is not available'); } };

// ── user_progress ─────────────────────────────────────────────────────────────
async function getProgress(telegramId) {
    const database = await getDb();
    const doc = await database.collection('user_progress').findOne(
        { telegramId },
        { projection: { bestScore: 1, totalXp: 1 } }
    );
    return doc ? { bestScore: doc.bestScore ?? 0, totalXp: doc.totalXp ?? 0 } : null;
}

async function ensureUser(telegramId, { username, firstName } = {}) {
    const database = await getDb();
    const now = new Date();
    await database.collection('user_progress').updateOne(
        { telegramId },
        {
            $setOnInsert: { telegramId, bestScore: 0, totalXp: 0, createdAt: now },
            $set: {
                lastSeen: now,
                ...(username != null ? { username } : {}),
                ...(firstName != null ? { firstName } : {})
            }
        },
        { upsert: true }
    );
}

async function upsertProgress(telegramId, { username, firstName, score, xp }) {
    const database = await getDb();
    const now = new Date();
    await ensureUser(telegramId, { username, firstName });

    const existing = await database.collection('user_progress').findOne({ telegramId });
    const bestScore = Math.max(existing?.bestScore ?? 0, score);

    await database.collection('user_progress').updateOne(
        { telegramId },
        {
            $set: {
                bestScore,
                totalXp: xp,
                lastSeen: now,
                ...(username != null ? { username } : {}),
                ...(firstName != null ? { firstName } : {})
            }
        }
    );

    return { bestScore, totalXp: xp };
}

async function getLeaderboard(limit = 10) {
    const database = await getDb();
    const rows = await database.collection('user_progress')
        .find({})
        .sort({ bestScore: -1 })
        .limit(limit)
        .toArray();

    return rows.map((r, i) => ({
        rank:      i + 1,
        userId:    r.telegramId,
        name:      r.username ? `@${r.username}` : (r.firstName || 'Anonymous'),
        bestScore: r.bestScore ?? 0,
        totalXp:   r.totalXp ?? 0
    }));
}

async function getFriendsLeaderboard(friendIds) {
    const database = await getDb();
    const rows = await database.collection('user_progress')
        .find({ telegramId: { $in: friendIds } })
        .sort({ bestScore: -1 })
        .limit(50)
        .toArray();

    return rows.map((r, i) => ({
        rank:      i + 1,
        userId:    r.telegramId,
        name:      r.username ? `@${r.username}` : (r.firstName || 'Anonymous'),
        bestScore: r.bestScore ?? 0,
        totalXp:   r.totalXp ?? 0
    }));
}

// ── game_sessions (anti-cheat) ────────────────────────────────────────────────
async function createGameSession(telegramId) {
    const database = await getDb();
    const sessionId = crypto.randomUUID();
    await database.collection('game_sessions').insertOne({
        sessionId,
        telegramId,
        startedAt: new Date(),
        endedAt:   null,
        finalScore: null,
        accepted:  null
    });
    return sessionId;
}

async function closeGameSession(sessionId, telegramId, score, accepted) {
    const database = await getDb();
    await database.collection('game_sessions').updateOne(
        { sessionId, telegramId },
        { $set: { endedAt: new Date(), finalScore: score, accepted } }
    );
}

async function getSessionStartTime(sessionId, telegramId) {
    const database = await getDb();
    const doc = await database.collection('game_sessions').findOne({
        sessionId,
        telegramId,
        endedAt: null
    });
    return doc?.startedAt ?? null;
}

// ── score_submissions (audit) ─────────────────────────────────────────────────
async function logSubmission(telegramId, score, xp, sessionMs, accepted, reason) {
    try {
        const database = await getDb();
        await database.collection('score_submissions').insertOne({
            telegramId,
            score,
            xpDelta: xp,
            sessionMs,
            accepted,
            rejectReason: reason || null,
            submittedAt: new Date()
        });
    } catch { /* non-critical */ }
}

module.exports = {
    pool,
    getDb,
    testConnection,
    close,
    getProgress,
    ensureUser,
    upsertProgress,
    getLeaderboard,
    getFriendsLeaderboard,
    createGameSession,
    closeGameSession,
    getSessionStartTime,
    logSubmission
};
