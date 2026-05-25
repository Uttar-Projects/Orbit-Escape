#!/usr/bin/env node
'use strict';

/**
 * MongoDB indexes — run: npm run db:migrate
 * Requires MONGODB_URI (or DATABASE_URL starting with mongodb)
 */

require('dotenv').config();
const { MongoClient } = require('mongodb');

const uri = process.env.MONGODB_URI
    || (process.env.DATABASE_URL?.startsWith('mongodb') ? process.env.DATABASE_URL : null);

if (!uri) {
    console.error('\n❌  MONGODB_URI is missing.');
    console.error('    Render → orbit-escape → Environment → add MONGODB_URI');
    console.error('    Example: mongodb+srv://user:pass@cluster.mongodb.net/orbit_escape?retryWrites=true&w=majority\n');
    process.exit(1);
}

const indexes = [
    { collection: 'user_progress', spec: { telegramId: 1 }, options: { unique: true } },
    { collection: 'user_progress', spec: { bestScore: -1 } },
    { collection: 'game_sessions', spec: { sessionId: 1 }, options: { unique: true } },
    { collection: 'game_sessions', spec: { telegramId: 1, startedAt: -1 } },
    { collection: 'score_submissions', spec: { telegramId: 1, submittedAt: -1 } }
];

async function migrate() {
    const client = new MongoClient(uri);
    try {
        console.log('\n🗄  Running MongoDB index setup...\n');
        await client.connect();
        const db = client.db();

        for (const { collection, spec, options } of indexes) {
            const name = await db.collection(collection).createIndex(spec, options || {});
            console.log(`  ✅  ${collection} → ${name}`);
        }

        console.log('\n✅  All indexes ready.\n');
    } catch (err) {
        console.error('\n❌  Migration failed:', err.message || err);
        console.error('    Check: Atlas Network Access allows 0.0.0.0/0, password URL-encoded (# → %23)\n');
        process.exit(1);
    } finally {
        await client.close();
    }
}

migrate();
