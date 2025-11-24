module.exports = {
  apps: [{
    name: 'bot-vpn',
    script: './index.js',
    cwd: '/var/www/bot-vpn',
    instances: 1,
    autorestart: true,
    watch: false,
    max_memory_restart: '500M',
    env: {
      NODE_ENV: 'production',
      MIDTRANS_ENV: 'sandbox',
      PORT: 50123,
      DB_DIR: './data',
      DB_PATH: './data/botvpn.db'
    },
    error_file: './logs/error.log',
    out_file: './logs/output.log',
    log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
    merge_logs: true,
    time: true
  }]
};
