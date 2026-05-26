/**
 * setup-telegram-menu.js
 * Sets the bot menu button to open the Mini App (requires TELEGRAM_BOT_TOKEN in .env).
 *
 * Run: npm run telegram:setup
 * Optional: WEBAPP_URL=https://orbit-escape.onrender.com
 */

require('dotenv').config({
    path:     require('path').join(__dirname, '..', '.env'),
    override: true
});

const TOKEN = process.env.TELEGRAM_BOT_TOKEN?.trim();
const URL   = (process.env.WEBAPP_URL || 'https://orbit-escape.onrender.com').replace(/\/$/, '');

async function tg(method, body = {}) {
    const res = await fetch(`https://api.telegram.org/bot${TOKEN}/${method}`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify(body)
    });
    return res.json();
}

async function main() {
    console.log('\n=== Telegram Mini App setup — Orbit Escape ===\n');

    if (!TOKEN) {
        console.error('❌ TELEGRAM_BOT_TOKEN missing in .env\n');
        process.exit(1);
    }

    const me = await tg('getMe');
    if (!me.ok) {
        console.error('❌ Invalid bot token:', me.description);
        process.exit(1);
    }

    const username = me.result.username;
    console.log(`✅ Bot: @${username}`);
    console.log(`   Web App URL: ${URL}\n`);

    const menu = await tg('setChatMenuButton', {
        menu_button: {
            type:    'web_app',
            text:    'Play Orbit Escape',
            web_app: { url: URL }
        }
    });

    if (menu.ok) {
        console.log('✅ Menu button set (tap menu icon in chat → opens game)');
    } else {
        console.warn('⚠ setChatMenuButton:', menu.description);
    }

    console.log('\n--- You MUST also create the Mini App in BotFather ---\n');
    console.log('1. Open @BotFather → send /myapps');
    console.log('2. Create app (or edit "Orbit Escape") linked to @' + username);
    console.log('3. Set Web App URL to:', URL);
    console.log('4. Short name must be: orbitescape');
    console.log('   (creates link https://t.me/' + username + '/orbitescape)\n');
    console.log('Open game: https://t.me/' + username + '/orbitescape\n');
}

main().catch(err => {
    console.error(err);
    process.exit(1);
});
