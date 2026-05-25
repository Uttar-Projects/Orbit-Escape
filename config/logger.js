'use strict';

const { createLogger, format, transports } = require('winston');
const path = require('path');
const fs   = require('fs');

const logsDir = path.join(__dirname, '..', 'logs');
if (!fs.existsSync(logsDir)) fs.mkdirSync(logsDir, { recursive: true });

// ── Sensitive field scrubber ──────────────────────────────────────────────────
// Prevents initData, sessionToken, and auth headers from ever reaching log files
const REDACTED_KEYS = new Set([
    'initdata', 'sessiontoken', 'authorization',
    'password', 'secret', 'token', 'cookie'
]);

function scrub(obj, depth = 0) {
    if (depth > 5 || !obj || typeof obj !== 'object') return obj;
    if (Array.isArray(obj)) return obj.map(v => scrub(v, depth + 1));
    const out = {};
    for (const [k, v] of Object.entries(obj)) {
        out[k] = REDACTED_KEYS.has(k.toLowerCase()) ? '[REDACTED]' : scrub(v, depth + 1);
    }
    return out;
}

const scrubFormat = format(info => {
    const { level, message, timestamp, service, ...meta } = info;
    return { level, message, timestamp, service, ...scrub(meta) };
});

// ── Logger ────────────────────────────────────────────────────────────────────
const logger = createLogger({
    level: process.env.LOG_LEVEL || 'info',
    format: format.combine(
        format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
        format.errors({ stack: true }),
        scrubFormat(),
        format.json()
    ),
    defaultMeta: { service: 'orbit-escape-tma' },
    transports: [
        new transports.Console({
            format: format.combine(
                format.colorize(),
                format.printf(({ timestamp, level, message, ...meta }) => {
                    const extra = Object.keys(meta).filter(k => k !== 'service').length
                        ? ' ' + JSON.stringify(meta)
                        : '';
                    return `${timestamp} [${level}] ${message}${extra}`;
                })
            )
        }),
        new transports.File({
            filename: path.join(logsDir, 'error.log'),
            level: 'error',
            maxsize: 5_242_880,
            maxFiles: 5
        }),
        new transports.File({
            filename: path.join(logsDir, 'combined.log'),
            maxsize: 10_485_760,
            maxFiles: 5
        })
    ]
});

module.exports = logger;
