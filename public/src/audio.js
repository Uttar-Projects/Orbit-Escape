/**
 * audio.js — Web Audio engine
 *
 * Mobile unlock strategy (Android Chrome + Telegram WebView):
 *   1. On first gesture, create AudioContext and IMMEDIATELY play a 1-frame silent buffer.
 *      Browsers count "audio started" as permission — more reliable than resume() alone.
 *   2. Also call ctx.resume() and track the Promise.
 *   3. play() queues sounds through the tracked Promise if context isn't running yet.
 */

let ctx             = null;
let muted           = false;
let _unlockPromise  = null;   // resolves when ctx is running
let _resolved       = false;  // true once unlock completed at least once

function createContext() {
    if (ctx) return;
    const Ctor = window.AudioContext || window.webkitAudioContext;
    if (!Ctor) return;
    try { ctx = new Ctor(); } catch (_) {}
}

/**
 * Play a 1-frame silent buffer — the most reliable mobile unlock.
 * On Android Chrome, starting a BufferSource within a user gesture
 * immediately grants audio permission regardless of ctx.state.
 */
function _playUnlockBuffer() {
    if (!ctx) return;
    try {
        const buf = ctx.createBuffer(1, 1, ctx.sampleRate);
        const src = ctx.createBufferSource();
        src.buffer = buf;
        src.connect(ctx.destination);
        src.start(0);
    } catch (_) {}
}

/**
 * Call synchronously inside ANY user-gesture handler (click, touchstart, pointerdown).
 * Safe to call multiple times — re-entrancy guarded.
 */
export function unlockFromGesture() {
    createContext();
    if (!ctx) return;

    _playUnlockBuffer();

    if (ctx.state !== 'running' && !_unlockPromise) {
        _unlockPromise = ctx.resume()
            .then(() => { _resolved = true; _unlockPromise = null; })
            .catch(() => { _unlockPromise = null; });
    } else if (ctx.state === 'running') {
        _resolved = true;
    }
}

/** Async wrapper — use where you can await (not required for gestures). */
export async function unlockAudio() {
    unlockFromGesture();
    if (!ctx) return;
    if (_unlockPromise) await _unlockPromise;
}

export function initAudio() {
    const unlock = () => unlockFromGesture();
    // capture:true fires before any other handler — guarantees gesture context
    document.addEventListener('touchstart', unlock, { passive: true, capture: true });
    document.addEventListener('pointerdown', unlock, { passive: true, capture: true });
    document.addEventListener('click',      unlock, { passive: true, capture: true });
    document.addEventListener('keydown',    unlock, { passive: true });
}

export function setMuted(m) {
    muted = m;
    try { localStorage.setItem('orbit_muted', m ? '1' : '0'); } catch (_) {}
}

export function isMuted() { return muted; }

export function loadMutedPreference() {
    try { muted = localStorage.getItem('orbit_muted') === '1'; } catch (_) {}
}

// ── Internal helpers ──────────────────────────────────────────────────────────

function gain(value, start) {
    const g = ctx.createGain();
    g.gain.setValueAtTime(value, start);
    return g;
}

function osc(type, freq, start) {
    const o = ctx.createOscillator();
    o.type = type;
    o.frequency.setValueAtTime(freq, start);
    return o;
}

function play(buildFn) {
    if (muted) return;
    if (!ctx) return;          // initAudio not called yet — skip silently

    const run = () => {
        if (!ctx || muted) return;
        try { buildFn(ctx.currentTime); } catch (_) {}
    };

    if (ctx.state === 'running') {
        run();
        return;
    }

    // Context resuming — queue through tracked promise
    if (_unlockPromise) {
        _unlockPromise.then(run).catch(() => {});
        return;
    }

    // Context still suspended but no unlock in progress (e.g. resumed externally)
    ctx.resume().then(run).catch(() => {});
}

// ── Public sound functions ────────────────────────────────────────────────────

export function playTap() {
    play(t => {
        const g = gain(0.15, t);
        g.gain.exponentialRampToValueAtTime(0.001, t + 0.1);
        g.connect(ctx.destination);
        const o = osc('sine', 520, t);
        o.frequency.exponentialRampToValueAtTime(260, t + 0.1);
        o.connect(g);
        o.start(t); o.stop(t + 0.1);
    });
}

export function playHit() {
    play(t => {
        const buf = ctx.createBuffer(1, ctx.sampleRate * 0.18, ctx.sampleRate);
        const d = buf.getChannelData(0);
        for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
        const src = ctx.createBufferSource();
        src.buffer = buf;
        const filt = ctx.createBiquadFilter();
        filt.type = 'bandpass'; filt.frequency.value = 300; filt.Q.value = 0.8;
        const g = gain(0.35, t);
        g.gain.exponentialRampToValueAtTime(0.001, t + 0.18);
        src.connect(filt); filt.connect(g); g.connect(ctx.destination);
        src.start(t); src.stop(t + 0.18);

        const o = osc('triangle', 180, t);
        o.frequency.exponentialRampToValueAtTime(40, t + 0.12);
        const g2 = gain(0.2, t);
        g2.gain.exponentialRampToValueAtTime(0.001, t + 0.12);
        o.connect(g2); g2.connect(ctx.destination);
        o.start(t); o.stop(t + 0.12);
    });
}

export function playNearMiss() {
    play(t => {
        const o = osc('sine', 880, t);
        o.frequency.exponentialRampToValueAtTime(440, t + 0.06);
        const g = gain(0.06, t);
        g.gain.exponentialRampToValueAtTime(0.001, t + 0.06);
        o.connect(g); g.connect(ctx.destination);
        o.start(t); o.stop(t + 0.06);
    });
}

export function playDeath() {
    play(t => {
        const o = osc('sawtooth', 320, t);
        o.frequency.exponentialRampToValueAtTime(55, t + 0.7);
        const g = gain(0.25, t);
        g.gain.setValueAtTime(0.25, t);
        g.gain.exponentialRampToValueAtTime(0.001, t + 0.7);
        o.connect(g); g.connect(ctx.destination);
        o.start(t); o.stop(t + 0.7);

        const buf = ctx.createBuffer(1, ctx.sampleRate * 0.4, ctx.sampleRate);
        const d = buf.getChannelData(0);
        for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / d.length);
        const src = ctx.createBufferSource();
        src.buffer = buf;
        const filt = ctx.createBiquadFilter();
        filt.type = 'lowpass'; filt.frequency.value = 600;
        const g2 = gain(0.3, t);
        g2.gain.exponentialRampToValueAtTime(0.001, t + 0.4);
        src.connect(filt); filt.connect(g2); g2.connect(ctx.destination);
        src.start(t); src.stop(t + 0.4);
    });
}

export function playPickup() {
    play(t => {
        [0, 0.07, 0.14].forEach((delay, i) => {
            const freq = [523, 659, 784][i];
            const o = osc('sine', freq, t + delay);
            const g = gain(0.12, t + delay);
            g.gain.exponentialRampToValueAtTime(0.001, t + delay + 0.12);
            o.connect(g); g.connect(ctx.destination);
            o.start(t + delay); o.stop(t + delay + 0.12);
        });
    });
}

export function playWaveClear() {
    play(t => {
        [0, 0.1, 0.2, 0.3].forEach((delay, i) => {
            const freq = [392, 523, 659, 784][i];
            const o = osc('sine', freq, t + delay);
            const g = gain(0.1, t + delay);
            g.gain.exponentialRampToValueAtTime(0.001, t + delay + 0.15);
            o.connect(g); g.connect(ctx.destination);
            o.start(t + delay); o.stop(t + delay + 0.15);
        });
    });
}

export function playMultiplier() {
    play(t => {
        const o = osc('square', 660, t);
        o.frequency.exponentialRampToValueAtTime(990, t + 0.05);
        const g = gain(0.07, t);
        g.gain.exponentialRampToValueAtTime(0.001, t + 0.08);
        o.connect(g); g.connect(ctx.destination);
        o.start(t); o.stop(t + 0.08);
    });
}
