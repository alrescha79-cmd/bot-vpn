# 🚀 Deployment Guide - Bot VPN v3.0

Panduan deployment production-ready untuk Bot VPN Telegram di VPS.

---

## 📋 Table of Contents

1. [Build & Preparation](#build--preparation)
2. [VPS Deployment](#vps-deployment)
3. [Initial Configuration](#initial-configuration)
4. [Auto-Start Setup](#auto-start-setup)
5. [Database Management](#database-management)
6. [Troubleshooting](#troubleshooting)

---

## 🔨 Build & Preparation

### 1. Build Production

```bash
# Di local/development environment
npm run build
```

Output akan ada di folder `dist/` dengan karakteristik:
- ✅ Hanya berisi kode JavaScript hasil compile
- ✅ Asset frontend (HTML untuk config setup)
- ❌ TIDAK berisi `.vars.json` (konfigurasi)
- ❌ TIDAK berisi `*.db` atau `*.sqlite` (database)

### 2. Files to Deploy

Upload ke VPS:
```
your-app/
├── dist/               # ← Hasil build (UPLOAD)
├── node_modules/       # ← Install di VPS dengan npm install
├── index.js            # ← Entry point (UPLOAD)
├── package.json        # ← Dependencies (UPLOAD)
├── package-lock.json   # ← Lock file (UPLOAD)
└── .vars.json.example  # ← Template config (OPSIONAL)
```

**JANGAN UPLOAD:**
- `.vars.json` (akan dibuat via web interface)
- `*.db`, `*.sqlite`, `data/` (akan dibuat otomatis)
- `node_modules/` dari local (install fresh di VPS)
- `src/` (tidak perlu, sudah di-compile ke `dist/`)

---

## 🌐 VPS Deployment

### 1. Persiapan VPS

```bash
# Update system
sudo apt update && sudo apt upgrade -y

# Install Node.js (gunakan NodeSource untuk versi terbaru)
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs

# Verify installation
node --version  # Should be v20.x
npm --version
```

### 2. Upload & Install

```bash
# Buat directory aplikasi
mkdir -p /var/www/bot-vpn
cd /var/www/bot-vpn

# Upload files (gunakan scp, rsync, atau git)
# Contoh dengan scp:
scp -r dist/ package*.json index.js user@your-vps:/var/www/bot-vpn/

# ⚠️ PENTING: Install dependencies di VPS
npm install --production
```

> **⚠️ CRITICAL:** Jangan copy `node_modules/` dari local!  
> Selalu jalankan `npm install --production` di VPS untuk memastikan binary dependencies ter-compile untuk OS target.  
> Error `Cannot find module 'xxx'` berarti step ini terlewat.

### 3. Struktur Directory di VPS

```
/var/www/bot-vpn/
├── dist/               # Compiled code
├── node_modules/       # Dependencies
├── index.js            # Entry point
├── package.json
├── data/               # ← Akan dibuat otomatis untuk database
│   └── botvpn.db       # ← Database (auto-generated)
└── .vars.json          # ← Config (buat via web interface)
```

---

## ⚙️ Initial Configuration

### 1. Start Application (Setup Mode)

```bash
cd /var/www/bot-vpn
node index.js
```

Output akan menampilkan:
```
═══════════════════════════════════════════════════════════
🔧 APPLICATION IN SETUP MODE
═══════════════════════════════════════════════════════════

Configuration file not found.
Please complete the initial setup:

👉 Open: http://localhost:50123/setup

═══════════════════════════════════════════════════════════
```

### 2. Setup via Web Interface

1. **Buka browser:** `http://your-vps-ip:50123/setup`
2. **Isi form konfigurasi:**
   - Bot Token (dari @BotFather)
   - User ID Admin
   - Group ID
   - Nama Store
   - Data QRIS, Merchant ID, API Key
   - Port (default: 50123)
3. **Klik "Simpan & Lanjutkan"**
4. **Restart aplikasi**

### 3. Verify Configuration

```bash
# Check .vars.json created
cat .vars.json

# Check database created
ls -lh data/botvpn.db

# IMPORTANT: Ensure correct permissions
# Database and data folder must be writable by application user
sudo chown -R $USER:$USER data/
chmod 755 data/
chmod 644 data/botvpn.db
```

**⚠️ Permission Issue Prevention:**
- Never run the app with `sudo` unless required by your VPS setup
- Always ensure data directory is owned by the user running the application
- If you see `SQLITE_READONLY` errors, check file ownership with `ls -la data/`
- See [TROUBLESHOOTING.md](./TROUBLESHOOTING.md) for common permission issues

---

## 🔄 Auto-Start Setup

Pilih salah satu metode:

### Option A: PM2 (Recommended)

PM2 adalah process manager untuk Node.js yang mudah dan powerful.

#### Install PM2

```bash
sudo npm install -g pm2
```

#### Start Application

```bash
cd /var/www/bot-vpn
pm2 start index.js --name bot-vpn
```

#### Setup Auto-Start on Reboot

```bash
# Generate startup script
pm2 startup

# Copy-paste command yang muncul (biasanya seperti ini):
sudo env PATH=$PATH:/usr/bin pm2 startup systemd -u your-user --hp /home/your-user

# Save current PM2 process list
pm2 save
```

#### PM2 Useful Commands

```bash
pm2 status              # Check status
pm2 logs bot-vpn        # View logs
pm2 restart bot-vpn     # Restart
pm2 stop bot-vpn        # Stop
pm2 delete bot-vpn      # Remove from PM2
pm2 monit               # Monitor resources
```

#### PM2 Ecosystem File (Optional)

Buat file `ecosystem.config.js`:

```javascript
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
```

Start dengan ecosystem:
```bash
pm2 start ecosystem.config.js
pm2 save
```

---

### Option B: systemd Service

Alternatif untuk auto-start menggunakan systemd.

#### Create Service File

```bash
sudo nano /etc/systemd/system/bot-vpn.service
```

Isi dengan:

```ini
[Unit]
Description=Bot VPN Telegram Service
After=network.target

[Service]
Type=simple
User=www-data
Group=www-data
WorkingDirectory=/var/www/bot-vpn
Environment="NODE_ENV=production"
Environment="PORT=50123"
Environment="DB_DIR=/var/www/bot-vpn/data"
Environment="DB_PATH=/var/www/bot-vpn/data/botvpn.db"
ExecStart=/usr/bin/node /var/www/bot-vpn/index.js
Restart=always
RestartSec=10
StandardOutput=append:/var/log/bot-vpn/output.log
StandardError=append:/var/log/bot-vpn/error.log

[Install]
WantedBy=multi-user.target
```

#### Setup Log Directory

```bash
sudo mkdir -p /var/log/bot-vpn
sudo chown www-data:www-data /var/log/bot-vpn
```

#### Enable & Start Service

```bash
# Reload systemd
sudo systemctl daemon-reload

# Enable auto-start on boot
sudo systemctl enable bot-vpn

# Start service
sudo systemctl start bot-vpn

# Check status
sudo systemctl status bot-vpn
```

#### systemd Useful Commands

```bash
sudo systemctl status bot-vpn    # Check status
sudo systemctl restart bot-vpn   # Restart
sudo systemctl stop bot-vpn      # Stop
sudo systemctl start bot-vpn     # Start
sudo journalctl -u bot-vpn -f    # View logs (follow)
sudo journalctl -u bot-vpn --since "1 hour ago"  # Recent logs
```

---

## 🗄️ Database Management

### Database Location

Database disimpan di: `/var/www/bot-vpn/data/botvpn.db`

**Karakteristik:**
- ✅ Otomatis dibuat saat pertama kali run
- ✅ Hanya schema/tabel (no seed data)
- ✅ Persisten setelah reboot
- ✅ Berada di luar folder `dist/`

### Backup Database

```bash
# Backup manual
cp data/botvpn.db data/botvpn.db.backup-$(date +%Y%m%d)

# Backup otomatis dengan cron (daily at 2 AM)
crontab -e
# Add line:
0 2 * * * cp /var/www/bot-vpn/data/botvpn.db /var/www/bot-vpn/data/backups/botvpn.db.$(date +\%Y\%m\%d)
```

### Reset Database (Fresh Start)

```bash
# Stop aplikasi
pm2 stop bot-vpn  # atau: sudo systemctl stop bot-vpn

# Backup existing database
mv data/botvpn.db data/botvpn.db.old

# Start aplikasi (akan create new database)
pm2 start bot-vpn  # atau: sudo systemctl start bot-vpn
```

---

## 🛠️ Configuration Management

### Edit Configuration (After Setup)

1. **Via Web Interface:**
   - Buka: `http://your-vps-ip:50123/config/edit`
   - Edit field yang diperlukan
   - Simpan perubahan
   - Restart aplikasi

2. **Manual Edit:**
   ```bash
   nano .vars.json
   # Edit konfigurasi
   # Restart aplikasi
   pm2 restart bot-vpn
   ```

### Environment Variables (Optional)

Untuk override konfigurasi via environment variables:

```bash
# PM2
pm2 start index.js --name bot-vpn --update-env -- \
  PORT=50123 \
  DB_PATH=./data/botvpn.db

# systemd (edit service file)
Environment="PORT=50123"
Environment="DB_PATH=/var/www/bot-vpn/data/botvpn.db"
```

---

## 🐛 Troubleshooting

### Bot Tidak Start (Setup Mode Loop)

**Problem:** Bot terus di setup mode meski sudah konfigurasi.

**Solution:**
```bash
# Check .vars.json exists
ls -la .vars.json

# Check content
cat .vars.json

# Verify JSON valid
node -e "console.log(JSON.parse(require('fs').readFileSync('.vars.json', 'utf8')))"

# If corrupted, recreate via web interface
rm .vars.json
# Akses /setup lagi
```

### Database Error

**Problem:** `SQLITE_CANTOPEN` atau database error.

**Solution:**
```bash
# Check data directory permissions
ls -la data/

# Fix permissions
sudo chown -R www-data:www-data /var/www/bot-vpn/data
sudo chmod 755 /var/www/bot-vpn/data

# Check environment variable
echo $DB_PATH
echo $DB_DIR
```

### Port Already in Use

**Problem:** Port 50123 sudah dipakai.

**Solution:**
```bash
# Check what's using the port
sudo lsof -i :50123

# Edit port di .vars.json
nano .vars.json
# Change "PORT": "50123" to another port

# Restart
pm2 restart bot-vpn
```

### View Logs

```bash
# PM2
pm2 logs bot-vpn

# systemd
sudo journalctl -u bot-vpn -f

# Manual logs
tail -f logs/error.log
tail -f logs/output.log
```

### Check Application Status

```bash
# PM2
pm2 status
pm2 describe bot-vpn

# systemd
sudo systemctl status bot-vpn

# Check if port is listening
sudo netstat -tulpn | grep :50123
# atau
sudo ss -tulpn | grep :50123
```

---

## 🔐 Security Tips

1. **Firewall Configuration**
   ```bash
   # Allow SSH
   sudo ufw allow 22/tcp
   
   # Allow bot web interface (jika perlu public access)
   sudo ufw allow 50123/tcp
   
   # Enable firewall
   sudo ufw enable
   ```

2. **Nginx Reverse Proxy (Optional)**
   ```nginx
   server {
       listen 80;
       server_name bot.yourdomain.com;
       
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

3. **Protect Config Files**
   ```bash
   chmod 600 .vars.json
   chmod 700 data/
   ```

---

## ✅ Production Checklist

- [ ] Build aplikasi dengan `npm run build`
- [ ] Upload files ke VPS (dist/, index.js, package.json)
- [ ] Install dependencies: `npm install --production`
- [ ] Konfigurasi via web interface: `/setup`
- [ ] Setup PM2 atau systemd untuk auto-start
- [ ] Test reboot VPS: `sudo reboot`
- [ ] Verify bot auto-start setelah reboot
- [ ] Setup database backup (cron job)
- [ ] Configure firewall (ufw)
- [ ] Monitor logs secara berkala

---

## 📞 Support

Jika ada masalah:
1. Check logs: `pm2 logs` atau `journalctl -u bot-vpn`
2. Verify config: `cat .vars.json`
3. Check database: `ls -lh data/`
4. Test port: `netstat -tulpn | grep 50123`

---

**Happy Deployment! 🚀**
