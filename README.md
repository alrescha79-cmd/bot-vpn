# 🤖 Bot VPN Telegram - Production Ready

[![Node.js](https://img.shields.io/badge/node-%3E%3D18.0.0-brightgreen.svg)](https://nodejs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.3.3-blue.svg)](https://www.typescriptlang.org/)
[![License](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)

Bot Telegram untuk manajemen akun VPN multi-protocol dengan arsitektur production-ready, web-based configuration, dan deployment yang mudah.

---

## ✨ Fitur Utama

### 🎯 Multi-Protocol Support
- **SSH** - Secure Shell tunneling
- **VMess** - V2Ray protocol
- **VLess** - V2Ray protocol (lightweight)
- **Trojan** - Trojan protocol
- **Shadowsocks** - Shadowsocks protocol

### 🔐 Role-Based Access Control
- **Admin** - Full akses manajemen sistem
- **Reseller** - Manajemen akun & transaksi
- **User** - Akses basic & pembelian

### 💰 Payment Integration
- **QRIS** - Pembayaran via QRIS (otomatis)
- **Deposit System** - Top-up saldo
- **Transaction History** - Riwayat lengkap

### 🌐 Web-Based Configuration
- **Setup Mode** - Konfigurasi pertama via web interface
- **Edit Mode** - Edit konfigurasi tanpa coding
- **No Hardcoded Values** - Semua configurable

### 🚀 Production Ready
- **Clean Build** - Dist tanpa config/database
- **Auto-Start** - PM2 & systemd support
- **Database Migration** - Auto-create schema
- **Error Handling** - Comprehensive logging

---

## 📋 Prasyarat

- **Node.js** v18+ (v20+ recommended)
- **npm** v8+
- **SQLite3** (auto-installed)
- **VPS** dengan SSH access (untuk production)
- **Telegram Bot Token** (dari [@BotFather](https://t.me/BotFather))

---

## 🚀 Quick Start

### 1. Clone Repository

```bash
git clone https://github.com/alrescha79-cmd/bot-vpn.git
cd bot-vpn
```

### 2. Install Dependencies

```bash
npm install
```

### 3. Setup Konfigurasi (via Web Interface)

```bash
# Pastikan tidak ada .vars.json (agar masuk setup mode)
rm -f .vars.json

# Start development server
npm run dev
```

**Buka browser**: `http://localhost:50123/setup`

Isi form dengan:
- ✅ **Bot Token** - Dari @BotFather
- ✅ **Admin User ID** - Telegram ID Anda (dapatkan dari @userinfobot)
- ✅ **Group ID** - Group untuk notifikasi
- ✅ **Store Name** - Nama toko VPN Anda
- ✅ **QRIS Data** - Data QRIS untuk pembayaran
- ✅ **Merchant ID & API Key** - Dari payment provider

**Klik**: `Simpan & Lanjutkan`

### 4. Set Admin Role

Setelah konfigurasi tersimpan, bot akan restart. Jalankan:

```bash
# Ganti YOUR_TELEGRAM_ID dengan ID Telegram Anda
sqlite3 data/botvpn.db "UPDATE users SET role = 'admin' WHERE user_id = YOUR_TELEGRAM_ID;"
```

### 5. Jalankan Bot

```bash
# Development mode (dengan auto-reload)
npm run dev

# Production mode
npm start
```

**Buka Telegram**, chat bot Anda: `/start`

---

## 🏗️ Struktur Project

```
bot-vpn/
├── src/                        # Source code (TypeScript)
│   ├── api/                    # API routes (config management)
│   ├── app/                    # Bot initialization & loader
│   ├── config/                 # Configuration management
│   ├── database/               # Database schema & queries
│   ├── frontend/               # Web interface (setup/edit)
│   ├── handlers/               # Telegram handlers
│   │   ├── actions/            # Callback query handlers
│   │   ├── commands/           # Command handlers
│   │   └── events/             # Event handlers
│   ├── middleware/             # Auth & error handling
│   ├── modules/                # Protocol implementations
│   │   └── protocols/
│   │       ├── ssh/
│   │       ├── vmess/
│   │       ├── vless/
│   │       ├── trojan/
│   │       └── shadowsocks/
│   ├── repositories/           # Database access layer
│   ├── services/               # Business logic
│   ├── types/                  # TypeScript types
│   └── utils/                  # Helpers & utilities
├── dist/                       # Build output (generated)
├── data/                       # Runtime data
│   └── botvpn.db              # SQLite database
├── scripts/                    # Build & utility scripts
│   ├── build-clean.js         # Clean build script
│   └── migrate-db-to-data.sh  # Database migration
├── deployment/                 # Deployment configs
│   └── bot-vpn.service        # systemd service
├── .vars.json                 # Config file (gitignored)
├── .vars.json.example         # Config template
├── index.js                   # Entry point
├── ecosystem.config.js        # PM2 config
├── package.json               # Dependencies
└── tsconfig.json              # TypeScript config
```

---

## 📖 Dokumentasi Lengkap

| Dokumen | Deskripsi |
|---------|-----------|
| **[QUICKSTART.md](QUICKSTART.md)** | Panduan setup cepat & deployment |
| **[DEPLOYMENT.md](DEPLOYMENT.md)** | Deployment detail untuk VPS |
| **[CHANGELOG_V3.md](CHANGELOG_V3.md)** | Changelog & implementation summary |
| **[TROUBLESHOOTING.md](TROUBLESHOOTING.md)** | Troubleshooting common issues |
| **[MIGRATION_GUIDE.md](MIGRATION_GUIDE.md)** | Upgrade dari v2.0 ke v3.0 |
| **[DB_PATH_CONSOLIDATION.md](DB_PATH_CONSOLIDATION.md)** | Database path changes |
| **[DOCUMENTATION_INDEX.md](DOCUMENTATION_INDEX.md)** | Index semua dokumentasi |

---

## 🔧 Development

### Build Project

```bash
# Build untuk production
npm run build

# Build dengan watch mode
npm run build:watch

# Type checking (tanpa build)
npm run type-check
```

### Running Modes

```bash
# Development (auto-reload dengan nodemon)
npm run dev

# Production (NODE_ENV=production)
npm run start:prod

# Normal start
npm start
```

---

## 🌐 Production Deployment

### 1. Build Production

```bash
npm run build
```

Hasil build di folder `dist/`:
- ✅ Compiled JavaScript code
- ✅ Frontend assets (HTML)
- ❌ **TIDAK** ada `.vars.json`
- ❌ **TIDAK** ada database files

### 2. Upload ke VPS

```bash
# Package untuk deployment
tar -czf bot-vpn-deploy.tar.gz \
  dist/ \
  index.js \
  package.json \
  package-lock.json \
  ecosystem.config.js \
  deployment/

# Upload ke VPS
scp bot-vpn-deploy.tar.gz user@your-vps:/var/www/
```

### 3. Setup di VPS

```bash
# SSH ke VPS
ssh user@your-vps

# Extract
cd /var/www
tar -xzf bot-vpn-deploy.tar.gz
cd bot-vpn
mv bot-vpn-deploy bot-vpn

# Install dependencies (production only)
npm install --production

# Setup konfigurasi (via web)
# Akses: http://your-vps-ip:50123/setup
```

### 4. Auto-Start dengan PM2

```bash
# Install PM2 globally
sudo npm install -g pm2

# Start bot
pm2 start index.js --name bot-vpn

# Setup auto-start on boot
pm2 startup
pm2 save

# Monitor
pm2 logs bot-vpn
pm2 status
```

### 5. Auto-Start dengan systemd

```bash
# Copy service file
sudo cp deployment/bot-vpn.service /etc/systemd/system/

# Edit ExecStart path sesuai lokasi Anda
sudo nano /etc/systemd/system/bot-vpn.service

# Enable & start
sudo systemctl enable bot-vpn
sudo systemctl start bot-vpn

# Check status
sudo systemctl status bot-vpn
sudo journalctl -u bot-vpn -f
```

**Detail lengkap**: Lihat [DEPLOYMENT.md](DEPLOYMENT.md)

---

## 🎮 Penggunaan

### User Commands
- `/start` - Mulai bot & tampilkan menu utama
- `/menu` - Tampilkan menu utama
- `/profile` - Lihat profil & saldo
- `/riwayat` - Riwayat transaksi

### Admin Commands
- `/admin` - Menu admin
- `/broadcast` - Broadcast message ke semua user
- `/stats` - Statistik sistem

### Reseller Commands
- `/reseller` - Menu reseller
- `/harga` - Lihat daftar harga
- `/stok` - Cek stok server

---

## 🔄 Update Konfigurasi

### Via Web Interface

```
Buka: http://localhost:50123/config/edit
Edit nilai yang ingin diubah
Klik: "Simpan Perubahan"
Restart bot
```

### Via File

```bash
# Edit .vars.json
nano .vars.json

# Restart bot
pm2 restart bot-vpn
# atau
sudo systemctl restart bot-vpn
```

---

## 🗄️ Database Management

### Lokasi Database
```bash
./data/botvpn.db
```

### Backup Database

```bash
# Manual backup
cp data/botvpn.db data/botvpn.db.backup-$(date +%Y%m%d)

# Auto backup (via cron)
# Add to crontab: crontab -e
0 2 * * * cd /path/to/bot-vpn && cp data/botvpn.db data/botvpn.db.backup-$(date +\%Y\%m\%d)
```

### Restore Database

```bash
# Stop bot
pm2 stop bot-vpn

# Restore backup
cp data/botvpn.db.backup-YYYYMMDD data/botvpn.db

# Start bot
pm2 start bot-vpn
```

### Migrasi dari v2.0

Jika upgrade dari versi lama yang database di root:

```bash
# Jalankan migration script
./scripts/migrate-db-to-data.sh

# Atau manual
mkdir -p ./data
cp ./botvpn.db ./botvpn.db.backup
mv ./botvpn.db ./data/botvpn.db
```

---

## 🐛 Troubleshooting

### Bot tidak start setelah setup

```bash
# Check logs
pm2 logs bot-vpn
# atau
sudo journalctl -u bot-vpn -f

# Verify config exists
cat .vars.json

# Check database
ls -lh data/botvpn.db
```

### Database permission error

```bash
# Fix permissions
sudo chown -R $USER:$USER ./data/
chmod 755 ./data/
chmod 644 ./data/botvpn.db
```

### Port already in use

```bash
# Check what's using port 50123
sudo lsof -i :50123
# atau
sudo netstat -tlnp | grep 50123

# Kill process atau ubah port di .vars.json
```

### Module not found errors

```bash
# Reinstall dependencies
rm -rf node_modules package-lock.json
npm install --production
```

**Troubleshooting lengkap**: Lihat [TROUBLESHOOTING.md](TROUBLESHOOTING.md)

---

## 🔒 Security Best Practices

### 1. Protect Config File
```bash
chmod 600 .vars.json
```

### 2. Firewall Setup
```bash
# Allow SSH, Bot API, dan Web Config
sudo ufw allow 22/tcp
sudo ufw allow 50123/tcp
sudo ufw enable
```

### 3. Reverse Proxy (Nginx)
```nginx
server {
    listen 80;
    server_name your-domain.com;

    location / {
        proxy_pass http://localhost:50123;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }
}
```

### 4. SSL/TLS (Let's Encrypt)
```bash
sudo apt install certbot python3-certbot-nginx
sudo certbot --nginx -d your-domain.com
```

### 5. Regular Backups
```bash
# Backup script: backup-bot.sh
#!/bin/bash
DATE=$(date +%Y%m%d-%H%M%S)
tar -czf /backup/bot-vpn-backup-$DATE.tar.gz \
  .vars.json \
  data/ \
  ecosystem.config.js
```

---

## 📊 Monitoring

### PM2 Monitoring

```bash
# Real-time monitoring
pm2 monit

# Logs
pm2 logs bot-vpn --lines 100

# CPU & Memory usage
pm2 status
```

### Custom Logs

Logs disimpan di:
- Console output: via PM2/systemd
- Error logs: via Winston logger (jika dikonfigurasi)

```bash
# View logs
pm2 logs bot-vpn

# Clear logs
pm2 flush
```

---

## 🤝 Contributing

Contributions are welcome! Please:

1. Fork repository
2. Create feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit changes (`git commit -m 'Add AmazingFeature'`)
4. Push to branch (`git push origin feature/AmazingFeature`)
5. Open Pull Request

---

## 📝 License

Distributed under the MIT License. See `LICENSE` for more information.

---

## 👨‍💻 Author

**alrescha79-cmd**

- GitHub: [@alrescha79-cmd](https://github.com/alrescha79-cmd)
- Repository: [bot-vpn](https://github.com/alrescha79-cmd/bot-vpn)

---

## 🙏 Acknowledgments

- [Telegraf](https://telegraf.js.org/) - Modern Telegram Bot Framework
- [SQLite](https://www.sqlite.org/) - Lightweight database
- [SSH2](https://github.com/mscdex/ssh2) - SSH2 client for Node.js
- [Express](https://expressjs.com/) - Web framework
- [TypeScript](https://www.typescriptlang.org/) - Typed JavaScript

---

## 📞 Support

Jika ada pertanyaan atau issue:

1. **Check dokumentasi** - [DOCUMENTATION_INDEX.md](DOCUMENTATION_INDEX.md)
2. **Troubleshooting** - [TROUBLESHOOTING.md](TROUBLESHOOTING.md)
3. **Open issue** - [GitHub Issues](https://github.com/alrescha79-cmd/bot-vpn/issues)

---

## 🗺️ Roadmap

- [x] Web-based configuration
- [x] Multi-protocol support (SSH, VMess, VLess, Trojan, Shadowsocks)
- [x] QRIS payment integration
- [x] Role-based access control
- [x] Auto-start support (PM2 & systemd)
- [ ] Wireguard protocol support
- [ ] Multi-language support
- [ ] Admin dashboard (web UI)
- [ ] API documentation (Swagger)
- [ ] Docker deployment support

---

<div align="center">

**⭐ Star this repo if you find it useful! ⭐**

Made with ❤️ by alrescha79-cmd

</div>
