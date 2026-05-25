/**
 * game/engine.js  v4
 * ==================
 * All 13 upgrades implemented:
 *  1  Screen shake on collision/death
 *  2  Score multiplier chain (near-miss streak)
 *  3  Obstacle variety: STRAIGHT / ORBIT / SPIRAL
 *  4  Particle burst on hit and death
 *  5  Daily challenge mode (seeded RNG)
 *  6  Haptic feedback
 *  7  Web Audio integration hooks
 *  8  Procedural audio (via audio.js callbacks)
 *  9  Difficulty waves (sine oscillation + wave-clear breaks)
 * 10  Sprite cache (via renderer getObstacleSprite)
 * 11  Collectible power-ups on orbit arc
 * 12  Post-game stats (richer 'died' event)
 * 13  Friends leaderboard (data side — UI in index.html)
 */

import { THEMES, getObstacleSprite, warmSpriteCache, drawShip, drawPowerup } from './renderer.js';
import { log, COMMENTS, updateHealthUI }    from '../ui/commentary.js';
import { playTap, playHit, playNearMiss,
         playDeath, playPickup, playWaveClear,
         playMultiplier }                   from '../audio.js';

const MAX_LIVES   = 3;
const REGEN_SPEED = 0.0015;
const BASE_SPEED  = 4.0;

// ── Seeded RNG (mulberry32) ───────────────────────────────────────────────────
function mulberry32(seed) {
    return () => {
        seed |= 0; seed = seed + 0x6D2B79F5 | 0;
        let t = Math.imul(seed ^ seed >>> 15, 1 | seed);
        t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
        return ((t ^ t >>> 14) >>> 0) / 4294967296;
    };
}

export class GameEngine extends EventTarget {
    constructor(canvas) {
        super();
        this.canvas = canvas;
        this.ctx    = canvas.getContext('2d');
        this.theme  = THEMES.earth;

        // Dimensions
        this.w = this.h = this.cx = this.cy = 0;
        this.planetRadius = this.orbitRadius = this.shipScale = 0;

        // Game state
        this.active    = false;
        this.paused    = false;
        this.revived   = false;
        this.isDaily   = false;

        // Player state
        this.angle     = 0;
        this.direction = 1;
        this.speed     = BASE_SPEED;
        this.score     = 0;
        this.lives     = MAX_LIVES;
        this.iFrames   = 0;

        // Combo / multiplier
        this.multiplier     = 1;
        this.nearMissStreak = 0;
        this.peakMultiplier = 1;

        // Entities
        this.obstacles = [];
        this.powerups  = [];
        this.particles = [];
        this.stars     = [];

        // Screen shake
        this.shakeAmp = 0;
        this.shakeDur = 0;

        // Timers
        this.lastTime      = 0;
        this.spawnTimer    = 0;
        this.powerupTimer  = 0;
        this.motivTimer    = 0;
        this.lastMilestone = 0;
        this.sessionStart  = 0;
        this.pulseT        = 0;
        this._deathTime    = 0;   // timestamp when player died (for pausing elapsed time)

        // Wave difficulty
        this.waveCooldown   = 0;
        this.lastWaveClear  = -1;

        // Stats (for post-game screen)
        this.totalNearMisses = 0;
        this.wavesCleared    = 0;

        // Active power-up timers
        this.burstTimer = 0;   // score multiplier ×2
        this.slowTimer  = 0;   // obstacle speed ÷2

        // RNG (replaced by seeded version in daily mode)
        this.rng = Math.random.bind(Math);

        // Haptic
        this._tg = window.Telegram?.WebApp;
    }

    // ── Setup ─────────────────────────────────────────────────────────────────
    init() {
        this._handleResize();
        window.addEventListener('resize', () => this._handleResize());
        for (let i = 0; i < 150; i++) {
            this.stars.push({
                x: Math.random() * 4000, y: Math.random() * 4000,
                r: 0.5 + Math.random() * 2,
                color: Math.random() > 0.8 ? '#ffde59' : '#ffffff'
            });
        }
        warmSpriteCache(this.theme);
        requestAnimationFrame(t => this._loop(t));
    }

    _handleResize() {
        this.w  = this.canvas.width  = window.innerWidth;
        this.h  = this.canvas.height = window.innerHeight;
        this.cx = this.w / 2;
        this.cy = this.h / 2;
        const m = Math.min(this.w, this.h);
        this.planetRadius = m * 0.12;
        this.orbitRadius  = m * 0.35;
        this.shipScale    = m * 0.0015;
    }

    // ── Public controls ───────────────────────────────────────────────────────
    _resetState() {
        this.score      = 0;
        this.speed      = BASE_SPEED;
        this.obstacles  = [];
        this.powerups   = [];
        this.particles  = [];
        this.angle      = 0;
        this.lives      = MAX_LIVES;
        this.revived    = false;
        this.active     = true;
        this.paused     = false;
        this.iFrames    = 0;
        this.shakeAmp   = 0; this.shakeDur = 0;
        this.spawnTimer = 0; this.powerupTimer = 600;
        this.motivTimer = 0; this.lastMilestone = 0;
        this.waveCooldown = 0; this.lastWaveClear = -1;
        this.multiplier = 1; this.nearMissStreak = 0; this.peakMultiplier = 1;
        this.totalNearMisses = 0; this.wavesCleared = 0;
        this.burstTimer = 0; this.slowTimer = 0;
        this.sessionStart = Date.now();
        this._emitUI();
        this._emitMultiplier();
    }

    startGame() {
        this.isDaily = false;
        this.rng     = Math.random.bind(Math);
        warmSpriteCache(this.theme);
        this._resetState();
        log('Good luck out there! 🌠');
    }

    startDailyChallenge(seed) {
        this.isDaily = true;
        this.rng     = mulberry32(seed);
        warmSpriteCache(this.theme);
        this._resetState();
        log('Daily Challenge — same layout for all pilots today! 📅', 3500);
    }

    revive() {
        // Shift sessionStart forward by however long the player was dead/watching ad,
        // so difficulty doesn't spike after the revive.
        if (this._deathTime) {
            const deadMs = Date.now() - this._deathTime;
            this.sessionStart += deadMs;
            this._deathTime = 0;
        }
        this.revived   = true;
        this.active    = true;
        this.lives     = 1;
        this.obstacles = [];
        this.powerups  = [];
        this.iFrames   = 90;
        this.spawnTimer = 0;    // don't instantly spawn obstacles on revival
        this.waveCooldown = 120; // brief calm after revival (~2s)
        this._emitUI();
        log('Back in the fight! 🦾', 2000);
    }

    togglePause() {
        if (!this.active) return;
        this.paused = !this.paused;
        log(this.paused ? 'Mission Paused ☕' : 'Back in action! 🚀', 2000);
        this.dispatchEvent(new CustomEvent('pause', { detail: { paused: this.paused } }));
    }

    reverseDirection() {
        this.direction *= -1;
        playTap();
        this._tg?.HapticFeedback?.impactOccurred('light');
    }

    setTheme(themeId) {
        this.theme = THEMES[themeId] || THEMES.earth;
        warmSpriteCache(this.theme);
    }

    get sessionMs() { return this.sessionStart ? Date.now() - this.sessionStart : 0; }

    getSessionStats() {
        return {
            score:        Math.floor(this.score),
            sessionSecs:  Math.round(this.sessionMs / 1000),
            isDaily:      this.isDaily
        };
    }

    // ── Emit helpers ──────────────────────────────────────────────────────────
    _emitUI() {
        updateHealthUI(this.lives, MAX_LIVES, this.iFrames, this.active, this.paused);
    }

    _emitMultiplier() {
        this.dispatchEvent(new CustomEvent('multiplier', {
            detail: {
                value:  this.multiplier,
                burst:  this.burstTimer > 0,
                slow:   this.slowTimer  > 0
            }
        }));
    }

    // ── Screen shake ──────────────────────────────────────────────────────────
    _shake(amp, dur) { this.shakeAmp = amp; this.shakeDur = dur; }

    // ── Particles ─────────────────────────────────────────────────────────────
    _spawnParticles(x, y, color, n = 10) {
        for (let i = 0; i < n; i++) {
            const angle = (i / n) * Math.PI * 2 + (this.rng() - 0.5) * 0.6;
            const spd   = 2 + this.rng() * 5;
            this.particles.push({
                x, y, color,
                vx: Math.cos(angle) * spd,
                vy: Math.sin(angle) * spd,
                r:  2 + this.rng() * 3,
                life: 1.0
            });
        }
    }

    // ── Power-up application ──────────────────────────────────────────────────
    _applyPowerup(type) {
        playPickup();
        this._tg?.HapticFeedback?.notificationOccurred('success');
        switch (type) {
            case 'SHIELD':
                this.lives = Math.min(MAX_LIVES, this.lives + 1);
                this._emitUI();
                log('Shield recharged! 🛡', 2000);
                break;
            case 'BURST':
                this.burstTimer = 300; // ~5s at 60fps
                this._emitMultiplier();
                log('Score BURST! ⚡ ×2 for 5s', 2000);
                break;
            case 'SLOW':
                this.slowTimer = 240;
                this._emitMultiplier();
                log('Time slowed! ❄ 4s', 2000);
                break;
        }
    }

    // ── Main loop ─────────────────────────────────────────────────────────────
    _loop(time) {
        const dt = this.lastTime ? Math.min((time - this.lastTime) / 16.67, 3) : 1;
        this.lastTime = time;
        this.pulseT  += dt * 0.06;

        const { ctx, w, h, cx, cy, theme } = this;

        // ── Screen shake ──────────────────────────────────────────────────
        ctx.save();
        if (this.shakeDur > 0) {
            const mag = this.shakeAmp * (this.shakeDur / 20);
            ctx.translate(
                (Math.random() - 0.5) * mag,
                (Math.random() - 0.5) * mag
            );
            this.shakeDur -= dt;
            if (this.shakeDur < 0) this.shakeDur = 0;
        }

        ctx.fillStyle = theme.bg;
        ctx.fillRect(0, 0, w, h);

        this._drawStars();
        theme.render(ctx, cx, cy, this.planetRadius);

        if (this.active) {
            if (!this.paused) this._update(dt);
            else              this._drawEntities();
        } else {
            ctx.setLineDash([15, 15]);
            ctx.strokeStyle = 'rgba(255,255,255,0.1)'; ctx.lineWidth = 3;
            ctx.beginPath(); ctx.arc(cx, cy, this.orbitRadius, 0, 7); ctx.stroke();
            ctx.setLineDash([]);
        }

        ctx.restore();
        requestAnimationFrame(t => this._loop(t));
    }

    _drawStars() {
        const { ctx, stars, w, h, angle } = this;
        stars.forEach(s => {
            const sx = (s.x - angle * 100) % w;
            const sy = s.y % h;
            ctx.fillStyle = s.color;
            ctx.beginPath();
            ctx.arc(sx < 0 ? sx + w : sx, sy < 0 ? sy + h : sy, s.r, 0, 7);
            ctx.fill();
        });
    }

    _shipPos() {
        return {
            px: this.cx + Math.cos(this.angle) * this.orbitRadius,
            py: this.cy + Math.sin(this.angle) * this.orbitRadius
        };
    }

    _drawEntities() {
        const { ctx, angle, shipScale, iFrames, cx, cy, theme } = this;
        const { px, py } = this._shipPos();

        // ── Particles ─────────────────────────────────────────────────────
        for (let i = this.particles.length - 1; i >= 0; i--) {
            const p = this.particles[i];
            p.x   += p.vx * 1; p.y += p.vy * 1;
            p.vy  += 0.08;
            p.life -= 0.03;
            if (p.life <= 0) { this.particles.splice(i, 1); continue; }
            ctx.save();
            ctx.globalAlpha = p.life;
            ctx.fillStyle   = p.color;
            ctx.beginPath(); ctx.arc(p.x, p.y, p.r * p.life, 0, Math.PI * 2); ctx.fill();
            ctx.restore();
        }

        // ── Slow-time visual tint ─────────────────────────────────────────
        if (this.slowTimer > 0) {
            ctx.save();
            ctx.fillStyle = 'rgba(147,197,253,0.06)';
            ctx.fillRect(0, 0, this.w, this.h);
            ctx.restore();
        }

        // ── Power-ups ─────────────────────────────────────────────────────
        const puColors = { SHIELD: '#4ade80', BURST: '#facc15', SLOW: '#93c5fd' };
        this.powerups.forEach(p => {
            const ux = cx + Math.cos(p.angle) * this.orbitRadius;
            const uy = cy + Math.sin(p.angle) * this.orbitRadius;
            const alpha = p.life < 60 ? p.life / 60 : 1;
            ctx.save(); ctx.globalAlpha = alpha;
            drawPowerup(ctx, ux, uy, p.type, this.pulseT + p.phase, puColors[p.type] || '#fff');
            ctx.restore();
        });

        // ── Obstacles ─────────────────────────────────────────────────────
        this.obstacles.forEach(o => {
            ctx.save();
            ctx.translate(o.x, o.y);
            ctx.rotate(o.rot);
            // Slow tint on obstacles when slow active
            if (this.slowTimer > 0) ctx.globalAlpha = 0.75;
            ctx.drawImage(o.sprite, -o.size * 1.5, -o.size * 1.5);
            ctx.restore();
        });

        // ── Ship ──────────────────────────────────────────────────────────
        ctx.save();
        ctx.translate(px, py);
        ctx.rotate(angle + Math.PI / 2);
        ctx.scale(shipScale, shipScale);
        drawShip(ctx, shipScale, iFrames);
        ctx.restore();
    }

    // ── Update ────────────────────────────────────────────────────────────────
    _update(dt) {
        const { cx, cy } = this;

        // ── Timers ────────────────────────────────────────────────────────
        if (this.iFrames   > 0) this.iFrames   -= dt;
        if (this.burstTimer> 0) { this.burstTimer -= dt; if (this.burstTimer <= 0) { this.burstTimer = 0; this._emitMultiplier(); } }
        if (this.slowTimer > 0) { this.slowTimer  -= dt; if (this.slowTimer  <= 0) { this.slowTimer  = 0; this._emitMultiplier(); } }
        this.motivTimer += dt;
        if (this.motivTimer > 600) {
            if (this.rng() > 0.6) log(COMMENTS.motivation[Math.floor(this.rng() * COMMENTS.motivation.length)]);
            this.motivTimer = 0;
        }

        // ── Shield regen ──────────────────────────────────────────────────
        if (this.lives < MAX_LIVES && this.iFrames <= 0) {
            this.lives = Math.min(MAX_LIVES, this.lives + REGEN_SPEED * dt);
            this._emitUI();
        }

        // ── Wave difficulty (time-based — gets harder the longer you survive) ─
        const elapsedSec = this.sessionMs / 1000;
        const waveIndex  = Math.floor(elapsedSec / 25);
        if (waveIndex > 0 && waveIndex !== this.lastWaveClear && this.waveCooldown <= 0) {
            this.lastWaveClear = waveIndex;
            this.waveCooldown  = 90;
            this.wavesCleared++;
            playWaveClear();
            this._tg?.HapticFeedback?.notificationOccurred('success');
            log(`Survived ${waveIndex * 25}s — intensity rising! 🔥`, 2000);
        }
        if (this.waveCooldown > 0) this.waveCooldown -= dt;

        // Speed ramps gradually with time (capped so it never becomes unplayable)
        // 0s → 4.0,  30s → 5.5,  60s → 6.5,  120s → 7.5 (max ~8.0)
        const timeRamp = Math.min(elapsedSec * 0.06, 4.0);
        const waveOsc  = Math.sin(elapsedSec / 9) * 0.5;
        this.speed     = BASE_SPEED + timeRamp + Math.max(0, waveOsc);
        const obsSpeed = this.slowTimer > 0 ? this.speed * 0.45 : this.speed;

        // ── Player movement ───────────────────────────────────────────────
        this.angle += (this.speed / 100) * this.direction * dt;
        const { px, py } = this._shipPos();

        this._drawEntities();

        // ── Obstacle spawn ────────────────────────────────────────────────
        const MAX_OBSTACLES = 6 + Math.floor(elapsedSec / 30);  // cap: 6 at start, +1 every 30s, max ~12
        if (this.waveCooldown <= 0 && this.obstacles.length < Math.min(MAX_OBSTACLES, 12)) {
            this.spawnTimer += dt;
            // Starts slow (~80 frames = 1.3s) and bottoms out at 28 frames (~0.47s)
            const spawnInterval = Math.max(28, 80 / (1 + elapsedSec / 30));
            if (this.spawnTimer >= spawnInterval) {
                this.spawnTimer = 0;
                const a    = this.rng() * Math.PI * 2;
                const dist = Math.max(this.w, this.h) * 0.7;
                const size = this.planetRadius * 0.2 + this.rng() * this.planetRadius * 0.3;
                const typeRoll = this.rng();
                const type = typeRoll < 0.58 ? 'straight'
                           : typeRoll < 0.82 ? 'orbit'
                           :                    'spiral';

                const orbitR = this.orbitRadius + 40 + this.rng() * 60;
                this.obstacles.push({
                    x: type === 'straight' ? cx + Math.cos(a) * dist : cx + Math.cos(a) * orbitR,
                    y: type === 'straight' ? cy + Math.sin(a) * dist : cy + Math.sin(a) * orbitR,
                    vx: -Math.cos(a) * (obsSpeed + Math.min(elapsedSec * 0.05, 4)),
                    vy: -Math.sin(a) * (obsSpeed + Math.min(elapsedSec * 0.05, 4)),
                    orbitAngle: a,
                    orbitRadius: orbitR,
                    orbitDir: this.rng() < 0.5 ? 1 : -1,
                    type,
                    size,
                    rot: this.rng() * 7,
                    sprite: getObstacleSprite(this.theme, size),
                    nearMissFired: false
                });
            }
        }

        // ── Power-up spawn ────────────────────────────────────────────────
        this.powerupTimer -= dt;
        if (this.powerupTimer <= 0 && this.powerups.length < 2) {
            this.powerupTimer = 600 + this.rng() * 400; // 10–16s
            const typeRoll = this.rng();
            this.powerups.push({
                type:  typeRoll < 0.4 ? 'SHIELD' : typeRoll < 0.7 ? 'BURST' : 'SLOW',
                angle: this.rng() * Math.PI * 2,
                dir:   -this.direction,
                life:  360,
                phase: this.rng() * Math.PI * 2
            });
        }

        // ── Collision detection — obstacles ───────────────────────────────
        const hitR = this.shipScale * 15;
        for (let i = this.obstacles.length - 1; i >= 0; i--) {
            const o = this.obstacles[i];

            // Move by behaviour type
            if (o.type === 'orbit') {
                o.orbitAngle += 0.018 * o.orbitDir * dt * (this.slowTimer > 0 ? 0.45 : 1);
                o.x = cx + Math.cos(o.orbitAngle) * o.orbitRadius;
                o.y = cy + Math.sin(o.orbitAngle) * o.orbitRadius;
            } else if (o.type === 'spiral') {
                o.orbitRadius -= (0.35 + elapsedSec * 0.006) * dt * (this.slowTimer > 0 ? 0.45 : 1);
                o.orbitAngle  += 0.022 * o.orbitDir * dt;
                o.x = cx + Math.cos(o.orbitAngle) * o.orbitRadius;
                o.y = cy + Math.sin(o.orbitAngle) * o.orbitRadius;
                // Despawn if spiral reaches planet
                if (o.orbitRadius < this.planetRadius + 10) { this.obstacles.splice(i, 1); continue; }
            } else {
                const spd = this.slowTimer > 0 ? 0.45 : 1;
                o.x += o.vx * dt * spd;
                o.y += o.vy * dt * spd;
            }
            o.rot += 0.05 * dt;

            const d = Math.hypot(px - o.x, py - o.y);

            if (d < hitR + o.size * 0.7 && this.iFrames <= 0) {
                // Hit!
                this.lives -= 1;
                this.iFrames = 60;
                this._shake(9, 18);
                this._spawnParticles(px, py, this.theme.obsColor, 12);
                this.nearMissStreak = 0;
                this.multiplier     = 1;
                this._emitMultiplier();
                playHit();
                this._tg?.HapticFeedback?.notificationOccurred('warning');
                log(COMMENTS.hit[Math.floor(this.rng() * COMMENTS.hit.length)], 1500);
                this._emitUI();

                if (this.lives <= 0) {
                    this.lives      = 0;
                    this.active     = false;
                    this._deathTime = Date.now();   // record so revive() can compensate
                    this._shake(18, 28);
                    this._spawnParticles(px, py, '#ef4444', 28);
                    this._emitUI();
                    playDeath();
                    this._tg?.HapticFeedback?.notificationOccurred('error');
                    setTimeout(() => this.dispatchEvent(new CustomEvent('died', {
                        detail: {
                            canRevive: !this.revived,
                            stats:     this.getSessionStats()
                        }
                    })), 400);
                }
                this.obstacles.splice(i, 1);
                continue;

            } else if (d < hitR * 2.8 + o.size * 0.7 && !o.nearMissFired && this.iFrames <= 0) {
                // Near miss
                o.nearMissFired = true;
                this.nearMissStreak++;
                this.totalNearMisses++;

                const prev = this.multiplier;
                this.multiplier = Math.min(4, 1 + Math.floor(this.nearMissStreak / 3) * 0.5);
                if (this.multiplier > prev) {
                    playMultiplier();
                    this._tg?.HapticFeedback?.impactOccurred('medium');
                    this._emitMultiplier();
                    this.peakMultiplier = Math.max(this.peakMultiplier, this.multiplier);
                }
                if (this.rng() < 0.15) {
                    playNearMiss();
                    log(COMMENTS.nearMiss[Math.floor(this.rng() * COMMENTS.nearMiss.length)], 1500);
                }
            }

            // Cull off-screen (straight) or escaped orbits
            if (o.type === 'straight') {
                if (Math.abs(o.x - cx) > this.w * 1.2 || Math.abs(o.y - cy) > this.h * 1.2)
                    this.obstacles.splice(i, 1);
            }
        }

        // ── Collision detection — power-ups ───────────────────────────────
        for (let i = this.powerups.length - 1; i >= 0; i--) {
            const p = this.powerups[i];
            p.angle += 0.012 * p.dir * dt;
            p.life  -= dt;
            const ux = cx + Math.cos(p.angle) * this.orbitRadius;
            const uy = cy + Math.sin(p.angle) * this.orbitRadius;
            if (Math.hypot(px - ux, py - uy) < 22) {
                this._applyPowerup(p.type);
                this._spawnParticles(ux, uy, '#facc15', 8);
                this.powerups.splice(i, 1);
            } else if (p.life <= 0) {
                this.powerups.splice(i, 1);
            }
        }

        // ── Score ─────────────────────────────────────────────────────────
        const effectiveMulti = this.multiplier * (this.burstTimer > 0 ? 2 : 1);
        this.score += 0.02 * dt * effectiveMulti;
        document.getElementById('score').innerText = Math.floor(this.score);

        // Score milestones
        const milestone = COMMENTS.score.find(
            m => Math.floor(this.score) >= m.limit && m.limit > this.lastMilestone
        );
        if (milestone) {
            log(milestone.text, 2500);
            this.lastMilestone = milestone.limit;
            this._tg?.HapticFeedback?.notificationOccurred('success');
        }
    }
}
