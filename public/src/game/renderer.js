/**
 * game/renderer.js  v4
 * ====================
 * Canvas2D primitives, planet themes, obstacle sprites.
 * v4: sprite cache — pre-renders 3 size buckets per theme,
 *     returns cached OffscreenCanvas instead of creating on every spawn.
 */

// ── Primitives ────────────────────────────────────────────────────────────────
export function circle(ctx, x, y, r) {
    ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill();
}
export function pill(ctx, x, y, w, h) {
    ctx.beginPath(); ctx.roundRect(x - w / 2, y - h / 2, w, h, h / 2); ctx.fill();
}

// ── Planet renderer ───────────────────────────────────────────────────────────
function drawBasePlanet(ctx, cx, cy, r, color, detailFn) {
    ctx.fillStyle = color;
    ctx.beginPath(); ctx.arc(cx, cy, r, 0, 7); ctx.fill();
    ctx.save();
    ctx.beginPath(); ctx.arc(cx, cy, r, 0, 7); ctx.clip();
    detailFn(ctx, cx, cy, r);
    ctx.fillStyle = 'rgba(0,0,0,0.15)';
    ctx.beginPath(); ctx.arc(cx + r * 0.2, cy + r * 0.2, r, 0, 7);
    ctx.rect(cx - r * 2, cy - r * 2, r * 4, r * 4);
    ctx.fill('evenodd');
    ctx.restore();
    ctx.strokeStyle = '#000'; ctx.lineWidth = Math.max(2, r * 0.1);
    ctx.beginPath(); ctx.arc(cx, cy, r, 0, 7); ctx.stroke();
}

// ── Theme definitions ─────────────────────────────────────────────────────────
export const THEMES = {
    earth: {
        id: 'earth', name: 'EARTH', primary: '#3b82f6', bg: '#1a3a5f', obsColor: '#94a3b8',
        powerupColor: '#4ade80',
        render: (ctx, cx, cy, r) => drawBasePlanet(ctx, cx, cy, r, '#3b82f6', (tc, x, y, rad) => {
            tc.fillStyle = '#4ade80'; circle(tc, x - rad*.3, y - rad*.2, rad*.4); circle(tc, x + rad*.4, y + rad*.2, rad*.35);
            tc.fillStyle = '#fff'; pill(tc, x - rad*.1, y + rad*.1, rad*.5, rad*.12);
        })
    },
    mars: {
        id: 'mars', name: 'MARS', primary: '#cc3d2b', bg: '#3a130e', obsColor: '#ff4d3a',
        powerupColor: '#fbbf24',
        render: (ctx, cx, cy, r) => drawBasePlanet(ctx, cx, cy, r, '#cc3d2b', (tc, x, y, rad) => {
            tc.fillStyle = '#9e2a1b'; circle(tc, x + rad*.4, y - rad*.1, rad*.4); circle(tc, x - rad*.5, y + rad*.3, rad*.3);
            tc.fillStyle = '#2d0a06'; circle(tc, x - rad*.2, y - rad*.3, rad*.15); circle(tc, x + rad*.3, y + rad*.3, rad*.1);
        })
    },
    jupiter: {
        id: 'jupiter', name: 'JUPITER', primary: '#ffbd59', bg: '#3d2b1f', obsColor: '#8c52ff',
        powerupColor: '#f472b6',
        render: (ctx, cx, cy, r) => drawBasePlanet(ctx, cx, cy, r, '#ffbd59', (tc, x, y, rad) => {
            tc.fillStyle = '#c2410c'; tc.fillRect(x - rad, y - rad*.5, rad*2, rad*.2); tc.fillRect(x - rad, y + rad*.1, rad*2, rad*.3);
            tc.fillStyle = '#ff3131'; circle(tc, x + rad*.4, y + rad*.25, rad*.2);
        })
    },
    saturn: {
        id: 'saturn', name: 'SATURN', primary: '#eab308', bg: '#2e2e1a', obsColor: '#facc15',
        powerupColor: '#a78bfa',
        render: (tc, cx, cy, r) => {
            const rw = r*1.6, rh = r*.5;
            tc.strokeStyle = '#fde047'; tc.lineWidth = r*.15;
            tc.beginPath(); tc.ellipse(cx, cy, rw, rh, .2, Math.PI, 0); tc.stroke();
            tc.strokeStyle = '#000'; tc.lineWidth = r*.22;
            tc.beginPath(); tc.ellipse(cx, cy, rw, rh, .2, Math.PI, 0); tc.stroke();
            drawBasePlanet(tc, cx, cy, r, '#eab308', (t, x, y, rad) => {
                t.fillStyle = '#ca8a04';
                t.fillRect(x - rad, y - rad*.3, rad*2, rad*.1);
                t.fillRect(x - rad, y, rad*2, rad*.1);
                t.fillRect(x - rad, y + rad*.3, rad*2, rad*.1);
            });
            tc.strokeStyle = '#000'; tc.lineWidth = r*.22;
            tc.beginPath(); tc.ellipse(cx, cy, rw, rh, .2, 0, Math.PI); tc.stroke();
            tc.strokeStyle = '#fde047'; tc.lineWidth = r*.15;
            tc.beginPath(); tc.ellipse(cx, cy, rw, rh, .2, 0, Math.PI); tc.stroke();
        }
    },
    neptune: {
        id: 'neptune', name: 'NEPTUNE', primary: '#60a5fa', bg: '#0c1b33', obsColor: '#ffffff',
        powerupColor: '#34d399',
        render: (ctx, cx, cy, r) => drawBasePlanet(ctx, cx, cy, r, '#60a5fa', (tc, x, y, rad) => {
            tc.fillStyle = '#1d4ed8'; circle(tc, x, y, rad*.5);
            tc.fillStyle = '#93c5fd'; pill(tc, x - rad*.3, y - rad*.5, rad*.5, rad*.06); pill(tc, x + rad*.2, y + rad*.5, rad*.6, rad*.06);
        })
    },
    moon: {
        id: 'moon', name: 'MOON', primary: '#94a3b8', bg: '#0b0e14', obsColor: '#f1f5f9',
        powerupColor: '#fb923c',
        render: (ctx, cx, cy, r) => drawBasePlanet(ctx, cx, cy, r, '#cbd5e1', (tc, x, y, rad) => {
            tc.fillStyle = '#94a3b8'; circle(tc, x - rad*.4, y - rad*.3, rad*.2); circle(tc, x + rad*.1, y - rad*.5, rad*.15);
            circle(tc, x + rad*.4, y + rad*.2, rad*.25); circle(tc, x - rad*.2, y + rad*.4, rad*.1);
            tc.fillStyle = '#64748b'; circle(tc, x - rad*.5, y + rad*.1, rad*.08); circle(tc, x + rad*.3, y - rad*.1, rad*.06);
        })
    }
};

// ── Sprite cache ──────────────────────────────────────────────────────────────
// Pre-renders 3 size buckets per theme. createObstacleSprite() is only called
// on cache miss (theme change) instead of every spawn.
const spriteCache = new Map();

function _createRawSprite(theme, size) {
    const off = document.createElement('canvas');
    off.width = off.height = size * 3;
    const c = off.getContext('2d');
    const center = off.width / 2;
    c.save(); c.translate(center, center);
    c.strokeStyle = '#000'; c.lineWidth = Math.max(2, size * 0.2); c.lineJoin = 'round';
    c.fillStyle = theme.obsColor;

    switch (theme.id) {
        case 'earth':
            c.beginPath();
            for (let i = 0; i < 8; i++) { const a = (i/8)*Math.PI*2, r = size*(0.8+Math.sin(i*1.3)*0.2+0.15); c.lineTo(Math.cos(a)*r, Math.sin(a)*r); }
            c.closePath(); c.fill(); c.stroke(); break;
        case 'mars':
            c.beginPath(); c.moveTo(0,-size); c.lineTo(size*.8,size*.5); c.lineTo(-size*.8,size*.5);
            c.closePath(); c.fill(); c.stroke(); break;
        case 'jupiter':
            c.beginPath();
            for (let i = 0; i < 12; i++) { const a=(i/12)*Math.PI*2, r=size*(.9+Math.sin(i*2)*.2); c.lineTo(Math.cos(a)*r,Math.sin(a)*r); }
            c.closePath(); c.fill(); c.stroke(); break;
        case 'saturn':
            c.beginPath();
            for (let i = 0; i < 6; i++) { const a=(i/6)*Math.PI*2; c.lineTo(Math.cos(a)*size,Math.sin(a)*size); }
            c.closePath(); c.fill(); c.stroke(); break;
        case 'neptune':
            c.beginPath(); c.moveTo(0,-size*1.5); c.lineTo(size*.5,0); c.lineTo(0,size*1.5); c.lineTo(-size*.5,0);
            c.closePath(); c.fill(); c.stroke(); break;
        case 'moon':
            c.beginPath();
            for (let i = 0; i < 5; i++) { const a=(i/5)*Math.PI*2, r=size*(.7+Math.sin(i*2.1)*.3+0.15); c.lineTo(Math.cos(a)*r,Math.sin(a)*r); }
            c.closePath(); c.fill(); c.stroke(); break;
    }
    c.restore();
    return off;
}

export function getObstacleSprite(theme, size) {
    const bucket = size < 14 ? 's' : size < 24 ? 'm' : 'l';
    const key    = `${theme.id}-${bucket}`;
    if (!spriteCache.has(key)) {
        const canonical = { s: 10, m: 19, l: 30 }[bucket];
        spriteCache.set(key, _createRawSprite(theme, canonical));
    }
    return spriteCache.get(key);
}

export function warmSpriteCache(theme) {
    ['s','m','l'].forEach(b => {
        const key = `${theme.id}-${b}`;
        if (!spriteCache.has(key)) {
            const canonical = { s: 10, m: 19, l: 30 }[b];
            spriteCache.set(key, _createRawSprite(theme, canonical));
        }
    });
}

export function clearSpriteCache() { spriteCache.clear(); }

// ── Power-up icons (drawn per type) ──────────────────────────────────────────
export function drawPowerup(ctx, x, y, type, pulse, color) {
    ctx.save();
    ctx.translate(x, y);
    const s = 12 + Math.sin(pulse) * 2;

    // Glow ring
    ctx.beginPath();
    ctx.arc(0, 0, s + 6, 0, Math.PI * 2);
    ctx.fillStyle = color + '33';
    ctx.fill();

    // Icon background
    ctx.beginPath(); ctx.arc(0, 0, s, 0, Math.PI * 2);
    ctx.fillStyle = color;
    ctx.strokeStyle = '#fff';
    ctx.lineWidth = 2;
    ctx.fill(); ctx.stroke();

    // Symbol
    ctx.fillStyle = '#fff';
    ctx.font = `bold ${Math.round(s)}px sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    const icons = { SHIELD: '🛡', BURST: '⚡', SLOW: '❄' };
    ctx.font = `${Math.round(s * 1.1)}px sans-serif`;
    ctx.fillText(icons[type] || '?', 0, 1);

    ctx.restore();
}

// ── Ship ──────────────────────────────────────────────────────────────────────
export function drawShip(ctx, shipScale, invincibilityTimer) {
    if (invincibilityTimer > 0 && Math.floor(Date.now() / 100) % 2 === 0)
        ctx.globalAlpha = 0.2;

    ctx.fillStyle = '#cbd5e1'; ctx.strokeStyle = '#000'; ctx.lineWidth = 5;
    ctx.beginPath(); ctx.ellipse(0, 5, 25, 10, 0, 0, 7); ctx.fill(); ctx.stroke();
    ctx.fillStyle = '#38bdf8';
    ctx.beginPath(); ctx.arc(0, 0, 12, Math.PI, 0); ctx.closePath(); ctx.fill(); ctx.stroke();
    ctx.fillStyle = (Math.floor(Date.now() / 200) % 2 === 0) ? '#facc15' : '#ef4444';
    circle(ctx, -15, 5, 3); circle(ctx, 0, 8, 3); circle(ctx, 15, 5, 3);
    ctx.globalAlpha = 1.0;
}
