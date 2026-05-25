/**
 * api/client.js  v4
 * =================
 * Backend communication — progress, sessions, leaderboard, daily challenge seed.
 */

const API_BASE = window.__API_BASE__ || '/api';
const TG       = window.Telegram?.WebApp;

export function getTgInitData() { return TG?.initData || ''; }
export function getTgUser()     { try { return TG?.initDataUnsafe?.user || null; } catch { return null; } }

// ── Save status ───────────────────────────────────────────────────────────────
let saveStatusEl = null;
export function initSaveStatus(el) { saveStatusEl = el; }

function showSaveStatus(msg, color = 'rgba(255,255,255,0.4)') {
    if (!saveStatusEl) return;
    saveStatusEl.style.color   = color;
    saveStatusEl.textContent   = msg;
    saveStatusEl.style.opacity = '1';
    clearTimeout(saveStatusEl._t);
    saveStatusEl._t = setTimeout(() => { saveStatusEl.style.opacity = '0'; }, 3000);
}

// ── Fetch with timeout ────────────────────────────────────────────────────────
async function apiFetch(endpoint, body, ms = 8000) {
    const ctrl = new AbortController();
    const id   = setTimeout(() => ctrl.abort(), ms);
    try {
        const res = await fetch(`${API_BASE}${endpoint}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body),
            signal: ctrl.signal
        });
        clearTimeout(id);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return await res.json();
    } catch (err) {
        clearTimeout(id);
        throw err;
    }
}

// ── localStorage fallback ─────────────────────────────────────────────────────
function localLoad()         { return { bestScore: +localStorage.getItem('orbit_best') || 0, totalXp: +localStorage.getItem('orbit_xp') || 0 }; }
function localSave(best, xp) { localStorage.setItem('orbit_best', best); localStorage.setItem('orbit_xp', xp); }

// ── Session token ─────────────────────────────────────────────────────────────
let _sessionToken = null;

export async function startGameSession() {
    _sessionToken = null;
    const initData = getTgInitData();
    if (!initData) return;
    try {
        const data = await apiFetch('/session/start', { initData }, 5000);
        if (data.ok && data.sessionToken) _sessionToken = data.sessionToken;
    } catch (err) {
        console.warn('[API] Session start failed:', err.message);
    }
}

// ── Progress ──────────────────────────────────────────────────────────────────
export async function loadProgress() {
    const initData = getTgInitData();
    if (!initData) return localLoad();
    try {
        const data = await apiFetch('/get-progress', { initData });
        if (data.ok) { localSave(data.bestScore, data.totalXp); return { bestScore: data.bestScore, totalXp: data.totalXp }; }
        return localLoad();
    } catch { return localLoad(); }
}

export async function saveProgress({ score, xp }) {
    const initData = getTgInitData();
    if (!initData) {
        const local   = localLoad();
        const bestScore = Math.max(local.bestScore, score);
        localSave(bestScore, xp);
        showSaveStatus('✓ Saved locally', '#4ade80');
        return { bestScore, totalXp: xp };
    }

    showSaveStatus('💾 Syncing...', '#ffde59');
    try {
        const data = await apiFetch('/save-progress', { initData, score, xp, sessionToken: _sessionToken });
        if (data.ok) {
            _sessionToken = null;
            localSave(data.bestScore, data.totalXp);
            showSaveStatus('✓ Saved', '#4ade80');
            return { bestScore: data.bestScore, totalXp: data.totalXp };
        }
        throw new Error(data.error || 'Unknown');
    } catch (err) {
        console.warn('[API] Save failed, local fallback:', err.message);
        showSaveStatus('⚠ Offline mode', '#fbbf24');
        const local = localLoad();
        const bestScore = Math.max(local.bestScore, score);
        localSave(bestScore, xp);
        return { bestScore, totalXp: xp };
    }
}

// ── Leaderboard ───────────────────────────────────────────────────────────────
export async function fetchLeaderboard(limit = 10) {
    try {
        const res  = await fetch(`${API_BASE}/leaderboard?limit=${limit}`);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();
        return data.ok ? data.leaderboard : [];
    } catch { return []; }
}

export async function fetchFriendsLeaderboard(friendIds) {
    const initData = getTgInitData();
    if (!initData || !friendIds?.length) return [];
    try {
        const data = await apiFetch('/leaderboard/friends', { initData, friendIds });
        return data.ok ? data.leaderboard : [];
    } catch { return []; }
}

// ── Daily challenge seed ──────────────────────────────────────────────────────
function _formatDailyLabel(dateStr) {
    const parts = dateStr.split('-').map(n => parseInt(n, 10));
    if (parts.length === 3 && parts.every(Number.isFinite)) {
        const [y, m, d] = parts;
        return new Date(Date.UTC(y, m, d)).toLocaleDateString(undefined, {
            weekday: 'short', month: 'short', day: 'numeric', timeZone: 'UTC'
        });
    }
    return dateStr;
}

function _todayUtcKey() {
    const now = new Date();
    return `${now.getUTCFullYear()}-${now.getUTCMonth()}-${now.getUTCDate()}`;
}

function _seedFromDateKey(dateStr) {
    return Math.abs(dateStr.split('').reduce(
        (a, c) => (Math.imul(a, 31) + c.charCodeAt(0)) | 0, 0x9e3779b9
    ));
}

function _fallbackDailyChallenge() {
    const dateStr = _todayUtcKey();
    return { seed: _seedFromDateKey(dateStr), date: dateStr, label: _formatDailyLabel(dateStr) };
}

/** Full daily challenge info for UI + seeded gameplay. */
export async function fetchDailyChallenge() {
    try {
        const res  = await fetch(`${API_BASE}/daily-seed`);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();
        if (data.ok) {
            return {
                seed:  data.seed,
                date:  data.date,
                label: _formatDailyLabel(data.date)
            };
        }
        return _fallbackDailyChallenge();
    } catch {
        return _fallbackDailyChallenge();
    }
}

/** @deprecated use fetchDailyChallenge — kept for compatibility */
export async function fetchDailySeed() {
    const { seed } = await fetchDailyChallenge();
    return seed;
}
