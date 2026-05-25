'use strict';

const { Pool } = require('pg');
const logger   = require('./logger');

const pool = new Pool({
    connectionString:        process.env.DATABASE_URL,
    max:                     10,
    idleTimeoutMillis:       30_000,
    connectionTimeoutMillis: 5_000,
    ssl: process.env.NODE_ENV === 'production'
        ? { rejectUnauthorized: false }
        : false
});

pool.on('error', err => {
    logger.error('PostgreSQL pool unexpected error', { error: err.message });
});

async function testConnection() {
    const client = await pool.connect();
    await client.query('SELECT 1');
    client.release();
    logger.info('PostgreSQL connected successfully');
}

// ── user_progress ─────────────────────────────────────────────────────────────
async function getProgress(telegramId) {
    const { rows } = await pool.query(
        `SELECT best_score, total_xp FROM user_progress WHERE telegram_id = $1`,
        [telegramId]
    );
    return rows.length ? { bestScore: rows[0].best_score, totalXp: rows[0].total_xp } : null;
}

async function upsertProgress(telegramId, { username, firstName, score, xp }) {
    const { rows } = await pool.query(
        `INSERT INTO user_progress
             (telegram_id, username, first_name, best_score, total_xp, last_seen)
         VALUES ($1, $2, $3, $4, $5, now())
         ON CONFLICT (telegram_id) DO UPDATE
             SET best_score = GREATEST(user_progress.best_score, EXCLUDED.best_score),
                 total_xp   = EXCLUDED.total_xp,
                 username   = EXCLUDED.username,
                 first_name = EXCLUDED.first_name,
                 last_seen  = now()
         RETURNING best_score, total_xp`,
        [telegramId, username || null, firstName || null, score, xp]
    );
    return { bestScore: rows[0].best_score, totalXp: rows[0].total_xp };
}

async function getLeaderboard(limit = 10) {
    const { rows } = await pool.query(
        `SELECT telegram_id, username, first_name, best_score, total_xp
         FROM user_progress ORDER BY best_score DESC LIMIT $1`,
        [limit]
    );
    return rows.map((r, i) => ({
        rank:      i + 1,
        userId:    r.telegram_id,
        name:      r.username ? `@${r.username}` : (r.first_name || 'Anonymous'),
        bestScore: r.best_score,
        totalXp:   r.total_xp
    }));
}

// ── game_sessions (anti-cheat) ────────────────────────────────────────────────
async function createGameSession(telegramId) {
    const { rows } = await pool.query(
        `INSERT INTO game_sessions (telegram_id, started_at)
         VALUES ($1, now()) RETURNING id`,
        [telegramId]
    );
    return rows[0].id;
}

async function closeGameSession(sessionId, telegramId, score, accepted) {
    await pool.query(
        `UPDATE game_sessions
         SET ended_at = now(), final_score = $1, accepted = $2
         WHERE id = $3 AND telegram_id = $4`,
        [score, accepted, sessionId, telegramId]
    );
}

async function getSessionStartTime(sessionId, telegramId) {
    const { rows } = await pool.query(
        `SELECT started_at FROM game_sessions
         WHERE id = $1 AND telegram_id = $2 AND ended_at IS NULL`,
        [sessionId, telegramId]
    );
    return rows.length ? rows[0].started_at : null;
}

// ── score_submissions (audit) ─────────────────────────────────────────────────
async function logSubmission(telegramId, score, xp, sessionMs, accepted, reason) {
    await pool.query(
        `INSERT INTO score_submissions
             (telegram_id, score, xp_delta, session_ms, accepted, reject_reason)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [telegramId, score, xp, sessionMs, accepted, reason || null]
    ).catch(() => {});
}

module.exports = {
    pool, testConnection,
    getProgress, upsertProgress, getLeaderboard,
    createGameSession, closeGameSession, getSessionStartTime,
    logSubmission
};
