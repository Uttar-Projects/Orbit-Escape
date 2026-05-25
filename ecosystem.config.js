// ============================================================
// PM2 Process Manager Configuration
// ============================================================
// Install PM2:  npm install -g pm2
// Start:        pm2 start ecosystem.config.js --env production
// Monitor:      pm2 monit
// Logs:         pm2 logs orbit-escape-tma
// Reload:       pm2 reload orbit-escape-tma
// Save state:   pm2 save && pm2 startup
// ============================================================

module.exports = {
    apps: [{
        name:             'orbit-escape-tma',
        script:           'server.js',
        instances:        'max',            // One per CPU core (cluster mode)
        exec_mode:        'cluster',
        watch:            false,            // Set true in dev only
        max_memory_restart: '512M',

        env: {
            NODE_ENV: 'development',
            PORT:     3000
        },
        env_production: {
            NODE_ENV: 'production',
            PORT:     3000
        },

        // Logging
        log_file:         'logs/pm2-combined.log',
        out_file:         'logs/pm2-out.log',
        error_file:       'logs/pm2-error.log',
        log_date_format:  'YYYY-MM-DD HH:mm:ss',
        merge_logs:       true,

        // Restart strategy
        autorestart:      true,
        max_restarts:     10,
        min_uptime:       '5s',
        restart_delay:    1000
    }]
};
