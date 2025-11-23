# 🤖 Bot VPN Telegram v3.0

Bot Telegram modern untuk manajemen VPN dengan fitur setup konfigurasi via web interface dan production-ready deployment.

---

## ✨ Features

### Core Features
- 🔐 **Multi-protocol VPN Support** - SSH, VMESS, VLESS, Trojan, Shadowsocks
- 👥 **User Management** - Admin, Reseller, User roles
- 💰 **Payment Integration** - QRIS payment system
- 📊 **Statistics & Monitoring** - Server stats, user activity
- 🔄 **Auto Renewal** - Automated account renewal
- 🎯 **Trial System** - Time-limited trial accounts

### New in v3.0
- ⚙️ **Web-based Configuration** - Setup dan edit konfigurasi via browser
- 🚀 **Production Ready** - Clean build, persisten config & database
- 🔧 **Initial Setup Mode** - First-time setup wizard
- 📦 **Clean Build** - Tidak include config/database di build output
- 🔄 **Auto-start Support** - PM2 dan systemd ready
- 🗄️ **Flexible Database** - Database path configurable, auto-create schema

---

## 📋 Requirements

- Node.js 18+ (Recommended: 20.x LTS)
- npm 9+
- SQLite3
- Telegram Bot Token (dari @BotFather)

---

## 🚀 Quick Start (Development)

### 1. Clone & Install

```bash
git clone <repository-url>
cd bot-tele
npm install
```

### 2. Setup Configuration

**Option A: Via Web Interface (Recommended)**
```bash
npm run dev
# Buka browser: http://localhost:50123/setup
# Isi form konfigurasi
# Restart aplikasi
```

**Option B: Manual**
```bash
cp .vars.json.example .vars.json
nano .vars.json  # Edit konfigurasi
```

### 3. Run Development

```bash
npm run dev
```

---

## 🏗️ Build & Production

### Build

```bash
npm run build
```

Output ada di `dist/` folder dengan karakteristik:
- ✅ Clean code (TypeScript → JavaScript)
- ✅ Frontend assets included
- ❌ NO `.vars.json` (config dibuat via web interface)
- ❌ NO `*.db` files (database auto-created)

### Production Deployment

Lihat dokumentasi lengkap: **[DEPLOYMENT.md](./DEPLOYMENT.md)**

Quick overview:
1. Build: `npm run build`
2. Upload ke VPS: `dist/`, `index.js`, `package*.json`
3. Install: `npm install --production`
4. Setup config: Akses `http://vps-ip:50123/setup`
5. Auto-start: Setup PM2 atau systemd

---

## 📁 Project Structure

```
bot-tele/
├── src/                    # Source code (TypeScript)
│   ├── api/               # API routes
│   │   └── config.routes.ts
│   ├── app/               # App initialization
│   ├── config/            # Configuration
│   │   ├── index.ts
│   │   ├── constants.ts
│   │   └── setup-mode.ts
│   ├── database/          # Database layer
│   │   ├── connection.ts
│   │   ├── schema.ts
│   │   └── queries/
│   ├── frontend/          # Web interface
│   │   └── config-setup.html
│   ├── handlers/          # Bot handlers
│   ├── modules/           # Business logic
│   ├── services/          # Services
│   │   └── config.service.ts
│   └── utils/             # Utilities
│
├── dist/                  # Build output (generated)
├── data/                  # Runtime data (auto-created)
│   └── botvpn.db         # SQLite database
├── deployment/            # Deployment configs
│   └── bot-vpn.service   # systemd service
├── scripts/               # Build scripts
│   └── build-clean.js
│
├── index.js              # Entry point
├── package.json
├── tsconfig.json
├── ecosystem.config.js   # PM2 config
├── .vars.json.example    # Config template
├── DEPLOYMENT.md         # Deployment guide
└── README.md
```

---

## ⚙️ Configuration

### Configuration Fields

File: `.vars.json` (dibuat via web interface atau manual)

```json
{
  "BOT_TOKEN": "your_bot_token",
  "USER_ID": 123456789,
  "GROUP_ID": "-1001234567890",
  "NAMA_STORE": "Your Store Name",
  "PORT": 50123,
  "DATA_QRIS": "qris_data_string",
  "MERCHANT_ID": "merchant_id",
  "API_KEY": "api_key",
  "ADMIN_USERNAME": "YourUsername"
}
```

### Environment Variables

Opsional, untuk override config:

```bash
export NODE_ENV=production
export PORT=50123
export DB_DIR=./data
export DB_PATH=./data/botvpn.db
```

---

## 🗄️ Database

### Location
- Development: `./data/botvpn.db`
- Production: Configurable via `DB_PATH` env

### Behavior
- ✅ **Auto-create** schema jika database tidak ada
- ✅ **Empty tables** (no seed data) di production
- ✅ **Persisten** setelah reboot
- ✅ **Outside dist/** folder untuk clean build

### Backup

```bash
# Manual backup
cp data/botvpn.db data/botvpn.db.backup

# Automated (cron)
0 2 * * * cp /path/to/data/botvpn.db /path/to/backups/botvpn.db.$(date +\%Y\%m\%d)
```

---

## 🛠️ Development

### Available Scripts

```bash
npm run dev           # Development mode (nodemon + ts-node)
npm run build         # Build production
npm run build:watch   # Build with watch mode
npm start             # Start production (from dist/)
npm run start:prod    # Start with NODE_ENV=production
npm run type-check    # TypeScript type checking
```

### Development Workflow

1. Make changes di `src/`
2. Hot-reload otomatis via nodemon
3. Test perubahan
4. Build: `npm run build`
5. Test production build: `npm run start:prod`

---

## 🎯 Usage

### Admin Commands
- `/start` - Memulai bot
- `/menu` - Menu utama
- `/stats` - Statistik sistem
- `/backup` - Backup database
- `/restore` - Restore database

### Reseller Commands
- `/resellerMenu` - Menu reseller
- `/commission` - Lihat komisi
- `/upgrade` - Upgrade level reseller

### User Commands
- `/topup` - Top up saldo
- `/mysaldo` - Cek saldo
- `/myaccount` - Lihat akun aktif

---

## 🔧 Configuration Management

### Initial Setup
1. Jalankan aplikasi pertama kali
2. Akses `http://localhost:50123/setup`
3. Isi semua field konfigurasi
4. Klik "Simpan & Lanjutkan"
5. Restart aplikasi

### Edit Configuration
1. Akses `http://localhost:50123/config/edit`
2. Edit field yang diperlukan
3. Simpan perubahan
4. Restart aplikasi

---

## 📦 Deployment

### PM2 (Recommended)

```bash
# Install PM2
npm install -g pm2

# Start aplikasi
pm2 start ecosystem.config.js

# Setup auto-start
pm2 startup
pm2 save

# Monitor
pm2 monit
```

### systemd

```bash
# Copy service file
sudo cp deployment/bot-vpn.service /etc/systemd/system/

# Enable & start
sudo systemctl daemon-reload
sudo systemctl enable bot-vpn
sudo systemctl start bot-vpn

# Check status
sudo systemctl status bot-vpn
```

**Dokumentasi lengkap:** [DEPLOYMENT.md](./DEPLOYMENT.md)

---

## 🐛 Troubleshooting

### Bot tidak start (stuck di setup mode)
```bash
# Check .vars.json exists and valid
cat .vars.json
node -e "JSON.parse(require('fs').readFileSync('.vars.json'))"
```

### Database error
```bash
# Check permissions
ls -la data/
chmod 755 data/
```

### Port already in use
```bash
# Find process
sudo lsof -i :50123
# Kill or change port di .vars.json
```

### View logs
```bash
# PM2
pm2 logs bot-vpn

# systemd
sudo journalctl -u bot-vpn -f
```

---

## 📄 License

MIT License

---

## 🤝 Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

---

## 📞 Support

- 📧 Email: support@example.com
- 💬 Telegram: @YourChannel
- 🐛 Issues: [GitHub Issues](https://github.com/yourusername/bot-vpn/issues)

---

**Made with ❤️ for production deployment**
