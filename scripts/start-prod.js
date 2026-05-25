#!/usr/bin/env node
'use strict';

/**
 * Production start — migrate then server (env vars available at runtime on Render).
 */

const { spawnSync } = require('child_process');
const path = require('path');

function run(cmd, args) {
    const r = spawnSync(cmd, args, {
        stdio: 'inherit',
        cwd: path.join(__dirname, '..'),
        shell: process.platform === 'win32'
    });
    return r.status ?? 1;
}

console.log('[start:prod] Running database setup...');
const migrateStatus = run('node', ['scripts/migrate.js']);
if (migrateStatus !== 0) {
    console.warn('[start:prod] Migrate failed — starting server anyway (check MONGODB_URI)');
}

console.log('[start:prod] Starting server...');
process.exit(run('node', ['server.js']));
