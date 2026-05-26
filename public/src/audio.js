/**
 * audio.js
 * ========
 * Procedural Web Audio API sound engine.
 * Mobile requires resume() + audible output inside the same user gesture.
 */

let ctx           = null;
let muted         = false;
let warmed        = false;

function createContext() {
    if (ctx) return ctx;
    try {
        const Ctx = window.AudioContext || window.webkitAudioContext;
        if (!Ctx) return null;
        ctx = new Ctx();
    } catch (_) {}
    return ctx;
}

/** Play one tap blip immediately (ctx must exist). */
function blipTap(t) {
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.15, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.1);
    g.connect(ctx.destination);

    const o = ctx.createOscillator();
    o.type = 'sine';
    o.frequency.setValueAtTime(520, t);
    o.frequency.exponentialRampToValueAtTime(260, t + 0.1);
    o.connect(g);
    o.start(t);
    o.stop(t + 0.1);
}

function warmUp(t) {
    if (!ctx || warmed || muted) return;
    warmed = true;
    try { blipTap(t ?? ctx.currentTime); } catch (_) {}
}

/**
 * Call synchronously inside click / touchstart / pointerdown handlers.
 * iOS & Android ignore audio if resume() runs outside the gesture stack.
 */
export function unlockFromGesture() {
    createContext();
    if (!ctx) return;

    if (ctx.state === 'suspended') {
        try { ctx.resume(); } catch (_) {}
    }
    warmUp(ctx.currentTime);
}

/** Async unlock — use only when already unlocked or as fallback. */
export async function unlockAudio() {
    unlockFromGesture();
    if (!ctx) return;
    if (ctx.state === 'running') return;
    try { await ctx.resume(); warmUp(); } catch (_) {}
}

export function initAudio() {
    const unlock = () => unlockFromGesture();
    document.addEventListener('touchstart', unlock, { passive: true, capture: true });
    document.addEventListener('pointerdown', unlock, { passive: true, capture: true });
    document.addEventListener('click', unlock, { passive: true, capture: true });
    document.addEventListener('keydown', unlock, { passive: true });
}

export function setMuted(m) {
    muted = m;
    try { localStorage.setItem('orbit_muted', m ? '1' : '0'); } catch (_) {}
}

export function isMuted() {
    return muted;
}

export function loadMutedPreference() {
    try { muted = localStorage.getItem('orbit_muted') === '1'; } catch (_) {}
}

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
    createContext();
    if (!ctx) return;

    const run = () => {
        if (!ctx || muted || ctx.state !== 'running') return;
        try { buildFn(ctx.currentTime); } catch (_) {}
    };

    if (ctx.state === 'running') {
        run();
        return;
    }

    unlockFromGesture();
    if (ctx.state === 'running') {
        run();
    } else {
        ctx.resume().then(run).catch(() => {});
    }
}

export function playTap() {
    play(t => {
        blipTap(t);
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
        filt.type = 'bandpass';
        filt.frequency.value = 300;
        filt.Q.value = 0.8;

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
