'use strict';

/**
 * monitoring/healthcheck.js
 * =========================
 * Rich /health endpoint consumed by:
 *   - Railway / Render health checks
 *   - UptimeRobot / Better Uptime (paste your /health URL)
 *   - Docker HEALTHCHECK
 *   - PM2 ecosystem health monitoring
 *
 * Returns 200 when all systems are up, 503 when any critical system is down.
 */

const os     = require('os');
const logger = require('../config/logger');

const START_TIME = Date.now();

/**
 * Build and send a health report.
 * @param {object} dbPool  — pg Pool instance
 */
async function healthHandler(dbPool, req, res) {
    const checks = {};
    let allOk    = true;

    // ── Database ──────────────────────────────────────────────────────────
    try {
        const t0  = Date.now();
        await dbPool.query('SELECT 1');
        checks.database = { status: 'ok', latencyMs: Date.now() - t0 };
    } catch (err) {
        checks.database = { status: 'error', error: err.message };
        allOk = false;
    }

    // ── Memory ────────────────────────────────────────────────────────────
    const mem = process.memoryUsage();
    checks.memory = {
        status:        'ok',
        heapUsedMB:    Math.round(mem.heapUsed  / 1_048_576),
        heapTotalMB:   Math.round(mem.heapTotal / 1_048_576),
        rssMB:         Math.round(mem.rss       / 1_048_576),
        externalMB:    Math.round(mem.external  / 1_048_576)
    };

    // Warn if heap usage exceeds 85%
    if (mem.heapUsed / mem.heapTotal > 0.85) {
        checks.memory.status = 'warn';
    }

    // ── System ────────────────────────────────────────────────────────────
    const load = os.loadavg();
    checks.system = {
        status:      'ok',
        platform:    process.platform,
        nodeVersion: process.version,
        cpuCores:    os.cpus().length,
        loadAvg1m:   load[0].toFixed(2),
        loadAvg5m:   load[1].toFixed(2),
        freeMemMB:   Math.round(os.freemem() / 1_048_576),
        totalMemMB:  Math.round(os.totalmem() / 1_048_576)
    };

    // ── Process ───────────────────────────────────────────────────────────
    const uptimeMs = Date.now() - START_TIME;
    checks.process = {
        status:     'ok',
        pid:        process.pid,
        uptimeMs,
        uptimeMin:  Math.floor(uptimeMs / 60_000),
        env:        process.env.NODE_ENV || 'development',
        version:    process.env.npm_package_version || '2.0.0'
    };

    const statusCode = allOk ? 200 : 503;

    if (!allOk) {
        logger.warn('Health check failed', { checks });
    }

    return res.status(statusCode).json({
        ok:        allOk,
        timestamp: new Date().toISOString(),
        checks
    });
}

module.exports = { healthHandler };
