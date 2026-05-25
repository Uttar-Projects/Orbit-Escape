'use strict';

/**
 * monitoring/sentry.js
 * ====================
 * Sentry error tracking integration (@sentry/node v8+).
 *
 * If SENTRY_DSN is not set, every export is a safe no-op.
 */

const logger = require('../config/logger');

let Sentry = null;

function init() {
    const dsn = process.env.SENTRY_DSN;
    if (!dsn) {
        logger.info('Sentry: SENTRY_DSN not set — error tracking disabled');
        return;
    }

    try {
        Sentry = require('@sentry/node');

        Sentry.init({
            dsn,
            environment:      process.env.NODE_ENV || 'development',
            release:          process.env.npm_package_version || '3.0.0',
            tracesSampleRate: process.env.NODE_ENV === 'production' ? 0.1 : 1.0,
            integrations:     [Sentry.expressIntegration()],

            beforeSend(event) {
                if (event.request?.data) {
                    const data = event.request.data;
                    if (data.initData)     data.initData     = '[REDACTED]';
                    if (data.sessionToken) data.sessionToken = '[REDACTED]';
                }
                return event;
            }
        });

        logger.info('Sentry: initialized', { dsn: dsn.split('@')[1] });
    } catch (err) {
        logger.warn('Sentry: failed to initialize', { error: err.message });
        Sentry = null;
    }
}

/**
 * Attach Sentry's Express error handler — call AFTER all routes.
 */
function setupErrorHandler(app) {
    if (!Sentry) return;
    Sentry.setupExpressErrorHandler(app);
}

function captureException(err, context = {}) {
    if (!Sentry) {
        logger.error('Unhandled exception', { error: err?.message, ...context });
        return;
    }
    Sentry.withScope(scope => {
        Object.entries(context).forEach(([k, v]) => scope.setExtra(k, v));
        Sentry.captureException(err);
    });
}

function captureEvent(message, level = 'info', data = {}) {
    if (!Sentry) {
        logger.info(`[Sentry event] ${message}`, data);
        return;
    }
    Sentry.captureMessage(message, { level, extra: data });
}

module.exports = { init, setupErrorHandler, captureException, captureEvent };
