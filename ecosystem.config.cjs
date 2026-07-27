module.exports = {
  apps: [
    {
      name: "sail-crewing-api",
      script: "dist/server/index.js",
      instances: 1,
      exec_mode: "fork",
      autorestart: true,
      watch: false,
      env: {
        NODE_ENV: "production",
        PORT: 4000,
      },
      max_memory_restart: "512M",
      log_date_format: "YYYY-MM-DD HH:mm:ss",
      error_file: "logs/pm2-error.log",
      out_file: "logs/pm2-out.log",
      merge_logs: true,
      restart_delay: 3000,
      kill_timeout: 11000,
      max_restarts: 10,
    },
  ],
};
