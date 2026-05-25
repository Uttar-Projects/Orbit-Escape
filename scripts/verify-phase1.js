#!/usr/bin/env node
'use strict';

/**
 * Phase 1 verification — bot token + project placeholders
 * Run: npm run phase1:verify
 */

require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });

const fs   = require('fs');
const path = require('path');

const ROOT       = path.join(__dirname, '..');
const INDEX_HTML = path.join(ROOT, 'public', 'index.html');
const ENV_PATH   = path.join(ROOT, '.env');

let passed = 0;
let failed = 0;

function ok(msg)   { console.log(`  ✅  ${msg}`); passed++; }
function fail(msg) { console.log(`  ❌  ${msg}`); failed++; }
function warn(msg) { console.log(`  ⚠️   ${msg}`); }

async function verifyBotToken(token) {
    const url = `https://api.telegram.org/bot${token}/getMe`;
    const res = await fetch(url);
    const data = await res.json();
    if (!data.ok) {
        fail(`Telegram API: ${data.description || 'invalid token'}`);
        return null;
    }
    ok(`Bot token valid — @${data.result.username} (${data.result.first_name})`);
    return data.result;
}

function checkIndexHtml() {
    const html = fs.readFileSync(INDEX_HTML, 'utf8');

    const botMatch = html.match(/window\.__BOT_USERNAME__\s*=\s*['"]([^'"]+)['"]/);
    const botUser  = botMatch?.[1];
    if (!botUser || botUser === 'YourBotUsername') {
        fail('public/index.html — set window.__BOT_USERNAME__ to your real bot username');
    } else {
        ok(`Bot username in index.html: ${botUser}`);
    }

    const blockMatch = html.match(/window\.__ADSGRAM_BLOCK_ID__\s*=\s*['"]([^'"]*)['"]/);
    const blockId    = blockMatch?.[1];
    if (!blockId) {
        warn('Adsgram Block ID empty — add after partner.adsgram.ai (or stub ads until Phase 7)');
    } else {
        ok(`Adsgram Block ID set: ${blockId}`);
    }

    if (html.includes('sad.adsgram.ai/js/sad.min.js')) {
        ok('Adsgram SDK script tag found in index.html');
    } else {
        warn('Add <script src="https://sad.adsgram.ai/js/sad.min.js"></script> in index.html <head>');
    }
}

function checkEnvFile() {
    if (!fs.existsSync(ENV_PATH)) {
        fail('.env missing — copy .env.example to .env');
        return null;
    }
    ok('.env file exists');
    return process.env.TELEGRAM_BOT_TOKEN?.trim() || null;
}

async function main() {
    console.log('\n=== Phase 1 verification — Orbit Escape TMA ===\n');

    checkEnvFile();
    const token = process.env.TELEGRAM_BOT_TOKEN?.trim();

    if (!token) {
        fail('TELEGRAM_BOT_TOKEN empty in .env');
        console.log('\n  → Open @BotFather, /newbot, paste token into .env\n');
    } else if (!/^\d+:[A-Za-z0-9_-]+$/.test(token)) {
        fail('TELEGRAM_BOT_TOKEN format looks wrong (expected 123456789:AAH...)');
    } else {
        try {
            await verifyBotToken(token);
        } catch (err) {
            fail(`Could not reach Telegram API: ${err.message}`);
        }
    }

    console.log('');
    checkIndexHtml();

    console.log('\n--- Summary ---');
    console.log(`  Passed: ${passed}  |  Failed: ${failed}`);
    if (failed === 0 && passed > 0) {
        console.log('\n  Phase 1 bot setup looks good. Finish Adsgram if you saw warnings.\n');
    } else {
        console.log('\n  Fix failures above, then run: npm run phase1:verify\n');
    }
    process.exit(failed > 0 ? 1 : 0);
}

main();
