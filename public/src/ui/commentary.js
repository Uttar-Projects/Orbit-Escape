/**
 * ui/commentary.js  v4
 * ====================
 * Commentary, level/XP UI, health UI, multiplier HUD,
 * and post-game stats modal helpers.
 */

const RANKS = [
    'NOVICE PILOT', 'SPACE CADET', 'STAR NAVIGATOR',
    'ORBIT MASTER', 'GALAXY GUARDIAN', 'COSMIC LEGEND'
];

// ── Commentary ────────────────────────────────────────────────────────────────
let commentaryEl      = null;
let commentaryTimeout = null;

export function initCommentary(el) { commentaryEl = el; }

export function log(text, duration = 3000) {
    if (!commentaryEl) return;
    clearTimeout(commentaryTimeout);
    commentaryEl.classList.remove('visible');
    setTimeout(() => {
        commentaryEl.innerText = text;
        commentaryEl.classList.add('visible');
        commentaryTimeout = setTimeout(() => commentaryEl.classList.remove('visible'), duration);
    }, 100);
}

export const COMMENTS = {
    score: [
        { limit: 10,  text: 'Orbit Stabilized! ✅' },
        { limit: 30,  text: "You've got this! 💪" },
        { limit: 50,  text: 'Look at you go! 🚀' },
        { limit: 80,  text: 'Absolute Pro! 🌟' },
        { limit: 120, text: 'Entering Warp! ✨' },
        { limit: 200, text: 'Unstoppable! 🔥' },
        { limit: 350, text: 'Galaxy Legend! 👑' },
        { limit: 600, text: 'Transcending Space! 🌀' }
    ],
    hit:        ['Ouch! Stay focused! 💥', 'Hull breach! Shake it off! ⚠️', 'Shields holding... barely! 📉', 'Keep moving, pilot! 🦾'],
    nearMiss:   ['Too close for comfort! 💨', 'Nice dodge, Ace! 🎯', 'Matrix level dodging! 🕶️', 'Barely a scratch! 🤞'],
    motivation: ["You're doing great! ✨", 'Keep that rhythm! 🎵', 'Space looks good on you! 🌌', 'New record incoming? 📈', 'Focus... and breathe! 🧘']
};

// ── Level / XP ────────────────────────────────────────────────────────────────
export function getLevelInfo(xp) {
    const level      = Math.floor(Math.sqrt(xp / 100)) + 1;
    const currentXp  = Math.pow(level - 1, 2) * 100;
    const nextXp     = Math.pow(level, 2) * 100;
    const progress   = ((xp - currentXp) / (nextXp - currentXp)) * 100;
    const rank       = RANKS[Math.min(Math.floor((level - 1) / 5), RANKS.length - 1)];
    return { level, progress, rank };
}

export function updateLevelUI(totalXp) {
    const info = getLevelInfo(totalXp);
    document.getElementById('level-text').innerText = `LVL ${info.level}`;
    document.getElementById('rank-name').innerText  = info.rank;
    document.getElementById('xp-fill').style.width  = `${info.progress}%`;
}

// ── Health UI ─────────────────────────────────────────────────────────────────
export function updateHealthUI(lives, maxLives, invincibilityTimer, gameActive, isPaused) {
    const fill       = document.getElementById('health-fill');
    const percentage = (lives / maxLives) * 100;
    fill.style.width           = `${percentage}%`;
    fill.style.backgroundColor = percentage > 66
        ? 'var(--health-green)'
        : (percentage > 33 ? 'var(--health-yellow)' : 'var(--health-red)');
    if (lives < maxLives && invincibilityTimer <= 0 && gameActive && !isPaused)
        fill.classList.add('regenerating');
    else
        fill.classList.remove('regenerating');
}

// ── Multiplier HUD ────────────────────────────────────────────────────────────
export function updateMultiplierHUD({ value, burst, slow }) {
    const el = document.getElementById('multiplier-hud');
    if (!el) return;

    const effective = value * (burst ? 2 : 1);

    if (effective <= 1 && !slow) {
        el.style.opacity = '0';
        el.style.transform = 'scale(0.8)';
        return;
    }

    el.style.opacity   = '1';
    el.style.transform = 'scale(1)';

    let text  = '';
    let color = '#fff';

    if (burst) {
        text  = `⚡ ×${effective.toFixed(1)} BURST`;
        color = '#facc15';
    } else if (slow) {
        text  = slow && value > 1 ? `❄ ×${value.toFixed(1)} SLOW` : '❄ SLOW';
        color = '#93c5fd';
    } else {
        text  = `×${value.toFixed(1)} COMBO`;
        color = value >= 4 ? '#f472b6' : value >= 2.5 ? '#a855f7' : '#ffde59';
    }

    el.textContent   = text;
    el.style.color   = color;
    el.style.borderColor = color + '66';
}

// ── Post-game stats modal (score only — no letter grades) ─────────────────────
export function showStatsModal(stats, bestScore, isNewBest) {
    const modal = document.getElementById('stats-modal');
    if (!modal) return;

    modal.querySelector('#stats-score-hero-val').textContent = stats.score;
    modal.querySelector('#stats-time').textContent           = `${stats.sessionSecs}s`;
    modal.querySelector('#stats-score').textContent          = bestScore;
    modal.querySelector('#stats-newbest').style.display      = isNewBest ? 'block' : 'none';
    modal.querySelector('#stats-daily-badge').style.display  = stats.isDaily ? 'inline-block' : 'none';

    modal.style.display = 'flex';
}

export function hideStatsModal() {
    const modal = document.getElementById('stats-modal');
    if (modal) modal.style.display = 'none';
}
