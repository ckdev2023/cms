/**
 * PM2 ecosystem configuration for production.
 *
 * Usage:
 *   pm2 start deploy/ecosystem.config.cjs
 *   pm2 reload deploy/ecosystem.config.cjs   # zero-downtime reload
 *   pm2 stop  deploy/ecosystem.config.cjs
 */
module.exports = {
  apps: [
    {
      name: 'cms-backend',
      cwd: '/opt/cms/backend',
      script: 'dist/main.js',
      instances: 1,
      exec_mode: 'fork',
      node_args: '--max-old-space-size=512',

      env_production: {
        NODE_ENV: 'production',
        PORT: 3000,
      },

      watch: false,
      max_memory_restart: '512M',
      min_uptime: '10s',
      max_restarts: 10,
      restart_delay: 3000,

      // Logging
      error_file: '/var/log/cms/pm2-error.log',
      out_file: '/var/log/cms/pm2-out.log',
      merge_logs: true,
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',

      // Graceful shutdown
      kill_timeout: 5000,
      listen_timeout: 10000,
    },
  ],
}
