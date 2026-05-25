#!/usr/bin/env node
'use strict';

require('dotenv').config();
const { Pool } = require('pg');

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

const migrations = [
    // user_progress
    `CREATE TABLE IF NOT EXISTS user_progress (
        telegram_id   BIGINT       PRIMARY KEY,
        username      VARCHAR(64),
        first_name    VARCHAR(128),
        best_score    INTEGER      NOT NULL DEFAULT 0,
        total_xp      INTEGER      NOT NULL DEFAULT 0,
        created_at    TIMESTAMPTZ  NOT NULL DEFAULT now(),
        last_seen     TIMESTAMPTZ  NOT NULL DEFAULT now()
    )`,
    `CREATE INDEX IF NOT EXISTS idx_user_progress_best_score
        ON user_progress (best_score DESC)`,

    // game_sessions — server-issued sessions for anti-cheat
    `CREATE TABLE IF NOT EXISTS game_sessions (
        id            UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
        telegram_id   BIGINT       NOT NULL,
        started_at    TIMESTAMPTZ  NOT NULL DEFAULT now(),
        ended_at      TIMESTAMPTZ,
        final_score   INTEGER,
        accepted      BOOLEAN,
        CONSTRAINT fk_gs_user FOREIGN KEY (telegram_id)
            REFERENCES user_progress (telegram_id) ON DELETE CASCADE
    )`,
    `CREATE INDEX IF NOT EXISTS idx_game_sessions_telegram_id
        ON game_sessions (telegram_id, started_at DESC)`,

    // score_submissions — audit log
    `CREATE TABLE IF NOT EXISTS score_submissions (
        id            BIGSERIAL    PRIMARY KEY,
        telegram_id   BIGINT       NOT NULL,
        score         INTEGER      NOT NULL,
        xp_delta      INTEGER      NOT NULL,
        session_ms    INTEGER,
        accepted      BOOLEAN      NOT NULL DEFAULT true,
        reject_reason VARCHAR(256),
        submitted_at  TIMESTAMPTZ  NOT NULL DEFAULT now()
    )`,
    `CREATE INDEX IF NOT EXISTS idx_score_submissions_telegram_id
        ON score_submissions (telegram_id, submitted_at DESC)`,

    // Ensure user_progress row exists before a session references it
    // (handled by FK + upsert in the save-progress route)
];

async function migrate() {
    const client = await pool.connect();
    try {
        console.log('\n🗄  Running database migrations...\n');
        for (const sql of migrations) {
            const label = sql.trim().split('\n')[0].slice(0, 72);
            await client.query(sql);
            console.log(`  ✅  ${label}`);
        }
        console.log('\n✅  All migrations complete.\n');
    } catch (err) {
        console.error('\n❌  Migration failed:', err.message);
        process.exit(1);
    } finally {
        client.release();
        await pool.end();
    }
}

migrate();
