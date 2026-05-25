#!/usr/bin/env node
'use strict';

/**
 * Phase 2 verification — production deploy health
 * Run: npm run phase2:verify -- https://your-app.up.railway.app
 */

const base = (process.argv[2] || process.env.DEPLOY_URL || '').replace(/\/$/, '');

if (!base) {
    console.error('\nUsage: npm run phase2:verify -- https://your-app.up.railway.app\n');
    process.exit(1);
}

if (!/^https:\/\//i.test(base)) {
    console.error('\nURL must start with https://\n');
    process.exit(1);
}

async function check(path, label) {
    const url = `${base}${path}`;
    try {
        const res  = await fetch(url, { signal: AbortSignal.timeout(15_000) });
        const text = await res.text();
        let json;
        try { json = JSON.parse(text); } catch { json = null; }

        if (path === '/health') {
            const dbOk = json?.checks?.database?.status === 'ok';
            const ok   = res.status === 200 && json?.ok === true && dbOk;
            console.log(ok ? `  ✅  ${label}` : `  ❌  ${label}`, `— HTTP ${res.status}`);
            if (!ok && json) {
                console.log('       ', JSON.stringify(json.checks?.database || json, null, 0).slice(0, 120));
            }
            return ok;
        }

        const ok = res.status === 200;
        console.log(ok ? `  ✅  ${label}` : `  ❌  ${label}`, `— HTTP ${res.status}`);
        if (path.includes('adsgram') && ok) console.log('       body:', text.trim().slice(0, 20));
        return ok;
    } catch (err) {
        console.log(`  ❌  ${label} — ${err.message}`);
        return false;
    }
}

async function main() {
    console.log(`\n=== Phase 2 verification — ${base} ===\n`);

    const h = await check('/health', 'GET /health (app + database)');
    await check('/api/adsgram/reward?userid=1', 'GET /api/adsgram/reward (Adsgram callback)');
    await check('/', 'GET / (frontend)');

    console.log('\n--- Summary ---');
    if (h) {
        console.log('  Deploy looks healthy. Update BotFather + Adsgram URLs to this domain.\n');
        process.exit(0);
    }
    console.log('  Fix deploy/env/DB, then run again.\n');
    process.exit(1);
}

main();
