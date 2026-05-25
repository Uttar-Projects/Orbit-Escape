#!/usr/bin/env node
'use strict';

/**
 * Auth Self-Test Script
 * Run: node scripts/test-auth.js
 *
 * Generates a valid synthetic initData payload signed with a test token,
 * then runs it through verifyTelegramInitData() to confirm the logic is correct.
 */

const crypto = require('crypto');

// --- Inline copy of the verification function (mirrors server.js) ---
function verifyTelegramInitData(initData, botToken) {
    if (!initData) return { ok: false, error: 'initData is empty' };
    if (!botToken) return { ok: false, error: 'BOT_TOKEN not configured' };
    try {
        const params = new URLSearchParams(initData);
        const receivedHash = params.get('hash');
        if (!receivedHash) return { ok: false, error: 'Missing hash' };
        params.delete('hash');
        const sortedPairs = Array.from(params.entries())
            .sort(([a], [b]) => a.localeCompare(b))
            .map(([k, v]) => `${k}=${v}`)
            .join('\n');
        const secretKey = crypto.createHmac('sha256', 'WebAppData').update(botToken).digest();
        const expectedHash = crypto.createHmac('sha256', secretKey).update(sortedPairs).digest('hex');
        const ok = crypto.timingSafeEqual(Buffer.from(receivedHash, 'hex'), Buffer.from(expectedHash, 'hex'));
        return { ok, error: ok ? null : 'Hash mismatch' };
    } catch (err) {
        return { ok: false, error: err.message };
    }
}

// --- Build a synthetic initData ---
const TEST_TOKEN = 'test_bot_token_12345';
const authDate   = Math.floor(Date.now() / 1000);
const user       = JSON.stringify({ id: 123456789, first_name: 'Test', username: 'testpilot', language_code: 'en' });

const params = new URLSearchParams({
    auth_date: String(authDate),
    user:      user,
    query_id:  'AAHdF6IQAAAAAN0XohDhrOrc'
});

const sortedPairs = Array.from(params.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([k, v]) => `${k}=${v}`)
    .join('\n');

const secretKey = crypto.createHmac('sha256', 'WebAppData').update(TEST_TOKEN).digest();
const hash      = crypto.createHmac('sha256', secretKey).update(sortedPairs).digest('hex');
params.set('hash', hash);

const syntheticInitData = params.toString();

// --- Run tests ---
console.log('=== Orbit Escape TMA — Auth Self-Test ===\n');

const r1 = verifyTelegramInitData(syntheticInitData, TEST_TOKEN);
console.log(`Test 1 — Valid initData:    ${r1.ok ? '✅ PASS' : '❌ FAIL'} ${r1.error || ''}`);

const r2 = verifyTelegramInitData(syntheticInitData, 'wrong_token');
console.log(`Test 2 — Wrong token:       ${!r2.ok ? '✅ PASS' : '❌ FAIL'} (expected failure)`);

const r3 = verifyTelegramInitData('', TEST_TOKEN);
console.log(`Test 3 — Empty initData:    ${!r3.ok ? '✅ PASS' : '❌ FAIL'} (expected failure)`);

const tampered = syntheticInitData.replace(/auth_date=\d+/, `auth_date=${authDate + 1}`);
const r4 = verifyTelegramInitData(tampered, TEST_TOKEN);
console.log(`Test 4 — Tampered payload:  ${!r4.ok ? '✅ PASS' : '❌ FAIL'} (expected failure)`);

console.log('\nAll tests complete.');
