/**
 * audio.js
 * ========
 * Procedural Web Audio API sound engine.
 * No audio files — everything is synthesised.
 */

let ctx           = null;
let muted         = false;
let warmed        = false;
let unlockPromise = null;

function createContext() {
    if (ctx) return ctx;
    try { ctx = new (window.AudioContext || window.webkitAudioContext)(); }
    catch (_) {}
    return ctx;
}

/** Resume AudioContext on a user gesture — call before gameplay starts. */
export async function unlockAudio() {
    createContext();
    if (!ctx) return;

    if (ctx.state === 'running') {
        warmUp();
        return;
    }

    if (!unlockPromise) {
        unlockPromise = ctx.resume()
            .then(() => warmUp())
            .finally(() => { unlockPromise = null; });
    }
    return unlockPromise;
}

function warmUp() {
    if (!ctx || warmed || muted) return;
    warmed = true;
    // Tiny silent blip — forces the audio pipeline to start immediately
    try {
        const t = ctx.currentTime;
        const g = ctx.createGain();
        g.gain.setValueAtTime(0.0001, t);
        g.gain.exponentialRampToValueAtTime(0.00001, t + 0.01);
        g.connect(ctx.destination);
        const o = ctx.createOscillator();
        o.frequency.setValueAtTime(440, t);
        o.connect(g);
        o.start(t);
        o.stop(t + 0.01);
    } catch (_) {}
}

export function initAudio() {
    const unlock = () => { unlockAudio(); };
    document.addEventListener('touchstart', unlock, { passive: true });
    document.addEventListener('pointerdown', unlock, { passive: true });
    document.addEventListener('keydown', unlock, { passive: true });
}

export function setMuted(m) { muted = m; }
export function isMuted()   { return muted; }

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
        if (!ctx || muted) return;
        try { buildFn(ctx.currentTime); } catch (_) {}
    };

    if (ctx.state === 'running') {
        run();
    } else {
        unlockAudio().then(run);
    }
}

export function playTap() {
    play(t => {
        const g = gain(0.12, t);
        g.gain.exponentialRampToValueAtTime(0.001, t + 0.08);
        g.connect(ctx.destination);

        const o = osc('sine', 520, t);
        o.frequency.exponentialRampToValueAtTime(260, t + 0.08);
        o.connect(g);
        o.start(t); o.stop(t + 0.08);
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
