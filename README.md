# 🤖 Bot VPN Telegram - Production Ready v3.1.21

[![Node.js](https://img.shields.io/badge/node-%3E%3D18.0.0-brightgreen.svg)](https://nodejs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.3.3-blue.svg)](https://www.typescriptlang.org/)
[![License](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)

**Bot Telegram** untuk manajemen akun VPN multi-protocol dengan arsitektur production-ready. **Semua fitur & manajemen dilakukan via Telegram Bot** - web interface hanya untuk setup/edit konfigurasi awal.

---

## 🚀 One-Line Installation (Production)

```bash
curl -fsSL https://raw.githubusercontent.com/alrescha79-cmd/bot-vpn/main/scripts/install-production.sh | sudo bash
```

> 📖 **Informasi lengkap**: Lihat [Production Installation Guide](docs/PRODUCTION_INSTALL.md) untuk detail setup dan konfigurasi.

---

> **🆕 What's New in v3.1.22:**
> - ✅ **Pakasir Payment Gateway** - Payment gateway alternatif dengan QRIS & Virtual Account
> - ✅ **Auto-fallback Payment** - Otomatis gunakan Pakasir jika Midtrans/QRIS tidak dikonfigurasi
> - ✅ **Pakasir Webhook** - Auto-verification pembayaran via webhook
> - ✅ **Multi Payment Support** - Midtrans, Static QRIS, dan Pakasir dalam satu sistem
> - 📖 **[Pakasir Setup Guide](docs/PAKASIR_SETUP.md)** - Dokumentasi lengkap setup Pakasir

> **Previous Updates (v3.1.21):**
> - ✅ **Static QRIS Payment** - Support QRIS statis (Dana Bisnis, ShopeePay, GoPay) dengan verifikasi manual admin
> - ✅ **Dynamic QRIS** - Library `@agungjsp/qris-dinamis` untuk embed nominal otomatis di QR code
> - ✅ **Admin Verification System** - Admin panel untuk approve/reject deposit manual dengan inline buttons
> - ✅ **Payment Proof Upload** - User upload bukti pembayaran, admin langsung dapat notifikasi real-time
> - ✅ **Dual Payment Mode** - Midtrans (auto-verify) atau QRIS Statis (manual) dengan fallback otomatis

> **Previous Updates (v3.1.2):**
> - ✅ **Midtrans Payment Gateway** - Integrasi lengkap dengan Midtrans untuk pembayaran otomatis
> - ✅ **3-in-1 Protocol** - VMESS + VLESS + TROJAN dalam satu paket (harga 1.5x)
> - ✅ **Trial System Fixed** - Perbaikan bug SSH trial timeout & loading messages
> - ✅ **CLI Setup** - Setup konfigurasi manual via terminal untuk production
> - ✅ **Account Persistence** - Semua akun premium disimpan ke database SQLite
> - ✅ **Akunku Menu** - Lihat, detail, dan kelola akun yang telah dibuat

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
- **QRIS Dinamis** - QRIS dengan nominal otomatis (manual verification)
- **Midtrans** - Payment Gateway terintegrasi (Sandbox & Production) - Auto-verification
- **Pakasir** - Payment Gateway alternatif dengan QRIS & Virtual Account - Auto-verification
- **Auto-Verification** - Verifikasi pembayaran otomatis setiap 10 detik (Midtrans/Pakasir)
- **Manual Verification** - Admin approve manual untuk QRIS statis
- **Instant Webhook** - Webhook untuk verifikasi instant (Midtrans & Pakasir)
- **Deposit System** - Top-up saldo otomatis/manual
- **Transaction History** - Riwayat lengkap transaksi
- 📖 **[Setup QRIS Statis](docs/QRIS_SETUP.md)** - Panduan setup Dana Bisnis, ShopeePay, GoPay
- 📖 **[Setup Pakasir](docs/PAKASIR_SETUP.md)** - Panduan setup Pakasir Payment Gateway
- ⏳ **Payment Gateway Lainnya** - Xendit, Duitku, dll (Coming Soon)

### 🌐 Web Interface (Config Only)
- **Setup Mode** - Konfigurasi awal via web browser (satu kali setup)
- **Edit Mode** - Edit konfigurasi sistem tanpa coding
- **Bukan untuk user** - Web hanya untuk admin setup, bukan interface user

### 📱 Telegram Bot Interface
- **All Management via Bot** - Semua fitur diakses via Telegram
- **User-Friendly Menus** - Keyboard interaktif & inline buttons
- **Real-time Notifications** - Notifikasi langsung ke Telegram
- **Multi-User Support** - Handle multiple users simultaneously

### 🚀 Production Ready
- **Clean Build** - Dist tanpa config/database
- **Auto-Start** - PM2 & systemd support
- **Database Migration** - Auto-create schema
- **Error Handling** - Comprehensive logging

### 💾 Account Persistence (v3.1+)
- **Auto-Save Accounts** - Semua akun premium tersimpan otomatis ke SQLite
- **Akunku Menu** - Lihat semua akun yang telah dibuat
- **Account Details** - Lihat detail lengkap termasuk raw response
- **Delete Accounts** - Hapus akun dari database
- **Filter by Owner** - User/Reseller hanya lihat akun mereka, Admin lihat semua

---

## 📋 Prasyarat

- **Node.js** v18+ (v20+ recommended)
- **npm** v8+
- **SQLite3** (auto-installed)
- **VPS** dengan SSH access (untuk production)
- **Midtrans Merchant ID dan Server Key** (untuk payment gateway)
- **API Key lainnya** (jika menggunakan payment gateway lain)
- **Telegram Bot Token** (dari [@BotFather](https://t.me/BotFather))

> ⚠️ **PENTING**: Ini adalah **Telegram Bot**, bukan aplikasi web!
> - **Web interface** hanya untuk **setup/edit konfigurasi** (admin only)
> - **Semua fitur VPN management** dilakukan via **Telegram Bot**
> - Users berinteraksi dengan bot di Telegram, bukan via web browser

---

**Key Points:**
- 💬 **User Interface = Telegram Bot** (semua fitur ada di bot)
- 🌐 **Web Interface = Config Only** (admin setup saja, bukan untuk user)
- 🖥️ **VPS Management = Via SSH** (bot connect ke VPS untuk create/manage akun)

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

### 3. Setup Konfigurasi (via Web Interface - Satu Kali)

```bash
# Pastikan tidak ada .vars.json (agar masuk setup mode)
rm -f .vars.json

# Start development server
npm run dev
```

**Buka browser**: `http://localhost:50123/setup`

> ⚠️ **Ini hanya dilakukan SATU KALI saat setup awal!**  
> Setelah ini, semua manajemen via Telegram Bot.

Isi form dengan:
- ✅ **Bot Token** - Dari @BotFather
- ✅ **Admin User ID** - Telegram ID Anda (dapatkan dari @userinfobot)
- ✅ **Admin Username** - Username Telegram admin (tanpa @)
- ✅ **Group ID** - Group untuk notifikasi (optional)
- ✅ **Store Name** - Nama toko VPN Anda
- ✅ **QRIS Data** - String QRIS statis (Dana, ShopeePay, GoPay - lihat [QRIS Setup](docs/QRIS_SETUP.md))
- ✅ **Midtrans Keys** - Merchant ID & Server Key (optional, lihat [Midtrans Setup](docs/MIDTRANS_SETUP.md))

> 📖 **Setup Payment**: 
> - **QRIS Statis**: Lihat [QRIS Setup Guide](docs/QRIS_SETUP.md) untuk setup Dana Bisnis, ShopeePay, atau GoPay
> - **Midtrans**: Lihat [Quick Start Midtrans](docs/MIDTRANS_QUICKSTART.md) untuk setup 5 menit

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
| **[QUICKSTART.md](docs/QUICKSTART.md)** | Panduan setup cepat & deployment |
| **[DEPLOYMENT.md](docs/DEPLOYMENT.md)** | Deployment detail untuk VPS |
| **[QRIS_SETUP.md](docs/QRIS_SETUP.md)** | Setup QRIS Statis (Dana, ShopeePay, GoPay) |
| **[PAKASIR_SETUP.md](docs/PAKASIR_SETUP.md)** | Setup Pakasir Payment Gateway |
| **[CHANGELOG_V3.md](docs/CHANGELOG_V3.md)** | Changelog & implementation summary |
| **[TROUBLESHOOTING.md](docs/TROUBLESHOOTING.md)** | Troubleshooting common issues |
| **[MIGRATION_GUIDE.md](docs/MIGRATION_GUIDE.md)** | Upgrade dari v2.0 ke v3.0 |
| **[TESTING.md](docs/TESTING.md)** | Testing guide untuk account persistence |
| **[DOCUMENTATION_INDEX.md](docs/DOCUMENTATION_INDEX.md)** | Index semua dokumentasi |
| **[UPDATE_V3.1_SUMMARY.md](docs/UPDATE_V3.1_SUMMARY.md)** | Summary update v3.1 |

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

> 📱 **Remember**: Users akan menggunakan **Telegram Bot**, bukan web!  
> Web hanya perlu diakses **satu kali** untuk setup konfigurasi.

### Quick Install (Automated)

**One-line installation** untuk production server:

```bash
curl -s https://raw.githubusercontent.com/alrescha79-cmd/bot-vpn/main/scripts/install-production.sh | sudo bash
```

Script ini akan otomatis:
- ✅ Install Node.js, PM2, dan dependencies
- ✅ Download release terbaru dari GitHub
- ✅ Extract dan deploy aplikasi
- ✅ Setup auto-start dengan PM2
- ✅ Preserve config & database (jika update)

**Install versi spesifik:**

```bash
curl -s https://raw.githubusercontent.com/alrescha79-cmd/bot-vpn/main/scripts/install-production.sh | sudo bash -s -- --version v3.1.1
```

**Custom installation path:**

```bash
curl -s https://raw.githubusercontent.com/alrescha79-cmd/bot-vpn/main/scripts/install-production.sh | bash -s -- --path /opt/bot-vpn
```

📖 **Dokumentasi lengkap**: [PRODUCTION_INSTALL.md](docs/PRODUCTION_INSTALL.md)

---

### Manual Installation

Jika ingin install secara manual:

#### 1. Build Production

```bash
npm run build
```

Hasil build di folder `dist/`:
- ✅ Compiled JavaScript code
- ✅ Frontend assets (HTML untuk setup config)
- ❌ **TIDAK** ada `.vars.json` (config)
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

#### 3. Setup di VPS

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

#### 4. Auto-Start dengan PM2

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

#### 5. Auto-Start dengan systemd

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

**Detail lengkap**: Lihat [DEPLOYMENT.md](docs/DEPLOYMENT.md)

---

## 🎮 Penggunaan Bot Telegram

> 💬 **Semua fitur diakses via Telegram Bot** - tidak ada web dashboard untuk user!

### 👤 User Commands (via Telegram)

Buka bot di Telegram dan gunakan command:

- `/start` - Mulai bot & tampilkan menu utama
- `/menu` - Tampilkan menu utama dengan inline keyboard
- `/profile` - Lihat profil, saldo, dan informasi akun
- `/riwayat` - Lihat riwayat transaksi & pembelian
- **Create Account** - Buat akun SSH/VMess/VLess/Trojan/Shadowsocks (via menu)
- **Renew Account** - Perpanjang akun yang sudah ada (via menu)
- **Trial Account** - Request akun trial gratis (via menu)
- **Top-up Saldo** - Deposit via QRIS (via menu)

### 👨‍💼 Admin Commands (via Telegram)

- `/admin` - Menu admin lengkap
- `/broadcast` - Broadcast message ke semua user
- `/stats` - Statistik sistem (user, transaksi, revenue)
- **Manage Servers** - Tambah/edit/hapus server VPN (via menu)
- **Manage Users** - Kelola user & reseller (via menu)
- **Manage Prices** - Set harga per protocol (via menu)
- **View Reports** - Laporan lengkap (via menu)

### 💼 Reseller Commands (via Telegram)

- `/reseller` - Menu reseller
- `/harga` - Lihat daftar harga
- `/stok` - Cek stok server available
- **Create for Customer** - Buatkan akun untuk customer (via menu)
- **Commission Report** - Lihat komisi & earnings (via menu)

---

## 🔄 Update Konfigurasi Sistem

> ⚙️ **Web interface hanya untuk admin setup** - bukan untuk end-user!

### Via Web Interface (Admin Only)

```plaintext
Buka: http://localhost:50123/config/edit
Edit nilai konfigurasi sistem (bot token, API key, dll)
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

1. **Check dokumentasi** - [DOCUMENTATION_INDEX.md](docs/DOCUMENTATION_INDEX.md)
2. **Troubleshooting** - [TROUBLESHOOTING.md](docs/TROUBLESHOOTING.md)
3. **Open issue** - [GitHub Issues](https://github.com/alrescha79-cmd/bot-vpn/issues)

---

## ❓ FAQ (Frequently Asked Questions)

### Q: Apakah ini aplikasi web atau bot Telegram?
**A:** Ini adalah **Telegram Bot**. Web interface hanya untuk setup/edit konfigurasi sistem (admin only). Semua fitur manajemen VPN, user interaction, dan transaksi dilakukan via Telegram Bot.

### Q: Apakah user perlu akses web untuk membeli VPN?
**A:** **TIDAK**. User hanya perlu chat dengan bot di Telegram. Semua fitur (beli, renew, trial, top-up) ada di bot.

### Q: Untuk apa web interface?
**A:** Web interface hanya untuk:
- Setup konfigurasi pertama kali (bot token, API key, dll)
- Edit konfigurasi sistem oleh admin
- **BUKAN** untuk end-user atau dashboard user

### Q: Bagaimana user menggunakan bot?
**A:** 
1. User cari bot di Telegram (sesuai username bot Anda)
2. Ketik `/start`
3. Pilih menu yang muncul (inline keyboard)
4. Semua transaksi & management via chat Telegram

### Q: Apakah perlu database server terpisah?
**A:** TIDAK. Menggunakan SQLite3 yang auto-included. File database disimpan di `./data/botvpn.db`.

### Q: Apakah bisa handle banyak user sekaligus?
**A:** YA. Bot bisa handle multiple concurrent users. Tested untuk ratusan user.

### Q: Port 50123 untuk apa?
**A:** Port untuk web interface (setup config). Hanya admin yang perlu akses. Bisa diubah di config.

---

## 🗺️ Roadmap

- [x] Web-based configuration (admin setup only)
- [x] Multi-protocol support (SSH, VMess, VLess, Trojan, Shadowsocks)
- [x] QRIS payment integration
- [x] Role-based access control
- [x] Auto-start support (PM2 & systemd)
- [x] Telegram bot interface (full featured)
- [x] Account persistence to database (v3.1)
- [x] Akunku menu for account management (v3.1)
- [ ] Wireguard protocol support
- [ ] Multi-language support
- [ ] Admin web dashboard (monitoring & analytics)
- [ ] API documentation (Swagger)
- [ ] Docker deployment support

---

## 🛠️ Helper Scripts

Bot dilengkapi dengan berbagai helper scripts untuk memudahkan testing dan management:

### Account Management
```bash
# Check all saved accounts
./scripts/check-accounts.sh

# Check accounts by specific user
./scripts/check-accounts.sh <user_id>

# Monitor account persistence in real-time
./scripts/test-account-persist.sh

# Test data extraction patterns
node scripts/test-extraction.js
```

### Admin Tools
```bash
# Set user as admin/owner
./scripts/set-admin.sh <user_id>
```

### Database
```bash
# Direct database access
sqlite3 data/botvpn.db

# List all tables
sqlite3 data/botvpn.db ".tables"

# Query accounts
sqlite3 data/botvpn.db "SELECT * FROM accounts LIMIT 10;"
```

---

## 📱 Menu Akunku (v3.1+)

Fitur baru untuk melihat dan mengelola akun yang telah dibuat:

### Akses Menu
1. Buka bot di Telegram
2. Klik menu **Akunku** (menggantikan "Cek Saldo")
3. Lihat saldo dan list akun aktif

### Fitur Akunku
- **Detail Akun** - Lihat list semua akun, klik username untuk detail lengkap
- **Hapus Akun** - Hapus akun dari database
- **Filter Otomatis** - User/Reseller hanya lihat akun miliknya, Admin lihat semua

### Data yang Tersimpan
Setiap akun premium yang dibuat akan disimpan dengan informasi:
- Username
- Protocol (SSH/VMess/VLess/Trojan/Shadowsocks)
- Server domain
- Tanggal dibuat
- Tanggal expired
- Status (active/expired)
- Raw response (detail lengkap akun)

---

<div align="center">

**⭐ Star this repo if you find it useful! ⭐**

Made with ❤️ by alrescha79-cmd

</div>
