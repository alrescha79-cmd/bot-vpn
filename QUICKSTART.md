# 🚀 Quick Setup Guide

Panduan singkat untuk setup dan deploy Bot VPN v3.0

---

## 📋 Pre-requisites

```bash
# Check Node.js version (need 18+)
node --version

# Check npm
npm --version

# Install dependencies (if fresh clone)
npm install
```

---

## 🏠 Local Development Setup

### 1. First Time Setup

```bash
# Ensure no .vars.json exists (test setup mode)
rm -f .vars.json

# Start development server
npm run dev
```

### 2. Configure via Web Interface

```
Open browser: http://localhost:50123/setup

Fill in:
✓ Bot Token (dari @BotFather)
✓ User ID (Chat ID admin)
✓ Group ID (untuk notifikasi)
✓ Store Name
✓ QRIS Data
✓ Merchant ID
✓ API Key
✓ Port (default: 50123)

Click: "Simpan & Lanjutkan"
```

### 3. Restart & Verify

```bash
# Stop (Ctrl+C)
# Start again
npm run dev

# Check logs - should see:
✅ Configuration loaded successfully
✅ Bot started successfully!
```

---

## 🏗️ Build for Production

### 1. Clean Build

```bash
npm run build
```

**Expected Output:**
```
🧹 Cleaning build artifacts...
✅ Removed old dist/
🔨 Compiling TypeScript...
✅ TypeScript compilation complete
📦 Copying frontend assets...
  ✅ Copied config-setup.html

═══════════════════════════════════════════════════════════
✅ BUILD COMPLETE - PRODUCTION READY
═══════════════════════════════════════════════════════════

📂 Build output: ./dist/

⚠️  IMPORTANT FOR DEPLOYMENT:
   • .vars.json is NOT included in dist/
   • Database files are NOT included in dist/
   • You must configure via web interface on first run
   • Database will be created automatically in ./data/

═══════════════════════════════════════════════════════════
```

### 2. Verify Build

```bash
# Check dist folder structure
ls -la dist/

# Should see:
dist/
├── api/
├── app/
├── config/
├── database/
├── frontend/
│   └── config-setup.html
├── handlers/
├── modules/
└── ... (other compiled code)

# Should NOT see:
# .vars.json ❌
# *.db files ❌
```

### 3. Test Production Build Locally

```bash
# Clean runtime files (test fresh install)
rm -f .vars.json
rm -rf data/

# Start production mode
NODE_ENV=production npm start

# Should show setup mode:
🔧 APPLICATION IN SETUP MODE
👉 Open: http://localhost:50123/setup
```

---

## 🌐 VPS Deployment

### 1. Prepare Files

```bash
# Create deployment package
tar -czf bot-vpn-deploy.tar.gz \
  dist/ \
  index.js \
  package.json \
  package-lock.json \
  ecosystem.config.js

# Upload to VPS
scp bot-vpn-deploy.tar.gz user@your-vps:/var/www/
```

### 2. VPS Setup

```bash
# SSH to VPS
ssh user@your-vps

# Extract
cd /var/www
tar -xzf bot-vpn-deploy.tar.gz
mv bot-vpn-deploy bot-vpn
cd bot-vpn

# Install dependencies (production only)
npm install --production

# Check structure
ls -la
# Should have: dist/, index.js, package.json, node_modules/
# Should NOT have: .vars.json, data/, src/
```

### 3. Initial Run & Setup

```bash
# Start application (will be in setup mode)
node index.js

# In another terminal or open browser:
# http://your-vps-ip:50123/setup

# Fill configuration form
# Click "Simpan & Lanjutkan"

# Stop application (Ctrl+C)
```

### 4. Setup Auto-Start (PM2)

```bash
# Install PM2 globally
sudo npm install -g pm2

# Start with PM2
pm2 start index.js --name bot-vpn

# Verify running
pm2 status

# Setup auto-start on boot
pm2 startup
# Copy-paste the command shown
# Usually: sudo env PATH=$PATH:/usr/bin pm2 startup systemd -u user --hp /home/user

# Save PM2 process list
pm2 save

# View logs
pm2 logs bot-vpn
```

### 5. Test Auto-Start

```bash
# Reboot VPS
sudo reboot

# After reboot, SSH back
ssh user@your-vps

# Check PM2 status
pm2 status

# Should show bot-vpn running ✅
```

---

## 🔧 Post-Deployment

### Database Migration (If Upgrading)

If you're upgrading from older version with `botvpn.db` in root folder:

```bash
# Run migration script
./scripts/migrate-db-to-data.sh

# Or manually:
mkdir -p ./data
cp ./botvpn.db ./botvpn.db.backup-$(date +%Y%m%d)
mv ./botvpn.db ./data/botvpn.db
```

**New installations automatically use `./data/botvpn.db`** ✅

### Configuration Management

**View Config:**
```bash
cat .vars.json
```

**Edit Config (Web):**
```
http://your-vps-ip:50123/config/edit
```

**Edit Config (Manual):**
```bash
nano .vars.json
pm2 restart bot-vpn
```

### Database Management

**Location:**
```bash
ls -la data/botvpn.db
```

**Backup:**
```bash
cp data/botvpn.db data/botvpn.db.backup-$(date +%Y%m%d)
```

**Reset (Fresh DB):**
```bash
pm2 stop bot-vpn
mv data/botvpn.db data/botvpn.db.old
pm2 start bot-vpn
# New empty database created
```

### Monitoring

**PM2 Dashboard:**
```bash
pm2 monit
```

**Logs:**
```bash
pm2 logs bot-vpn           # Live logs
pm2 logs bot-vpn --lines 100  # Last 100 lines
pm2 logs bot-vpn --err     # Error logs only
```

**Status:**
```bash
pm2 status
pm2 describe bot-vpn
```

---

## 🆘 Common Issues & Solutions

### Issue: "Setup Mode Loop"

**Problem:** Bot terus di setup mode meski sudah setup.

**Solution:**
```bash
# Check if .vars.json exists
ls -la .vars.json

# If exists but corrupted
cat .vars.json
# If invalid JSON, delete and setup again
rm .vars.json

# Re-setup via /setup
```

### Issue: "Database Error"

**Problem:** `SQLITE_CANTOPEN` error.

**Solution:**
```bash
# Check data directory exists
ls -la data/

# Create if not exists
mkdir -p data

# Fix permissions
chmod 755 data/

# Restart
pm2 restart bot-vpn
```

### Issue: "Port Already in Use"

**Problem:** Port 50123 already used.

**Solution:**
```bash
# Find what's using the port
sudo lsof -i :50123

# Either kill that process OR change port
nano .vars.json
# Change "PORT": "50123" to another port
pm2 restart bot-vpn
```

### Issue: "Bot Not Responding"

**Problem:** Bot tidak respond di Telegram.

**Solution:**
```bash
# Check PM2 status
pm2 status

# Check logs for errors
pm2 logs bot-vpn --err

# Common causes:
# 1. Wrong BOT_TOKEN → edit .vars.json
# 2. Network issue → check VPS connectivity
# 3. Telegram API down → wait

# Restart
pm2 restart bot-vpn
```

---

## ✅ Verification Checklist

### Pre-Deployment
- [ ] Build successful: `npm run build`
- [ ] No `.vars.json` in `dist/`
- [ ] No `*.db` files in `dist/`
- [ ] `dist/frontend/config-setup.html` exists

### Post-Deployment
- [ ] Files uploaded to VPS
- [ ] Dependencies installed: `npm install --production`
- [ ] Setup completed via web interface
- [ ] `.vars.json` created
- [ ] `data/botvpn.db` created
- [ ] Bot responding to `/start` command

### Auto-Start
- [ ] PM2 or systemd configured
- [ ] Process running after VPS reboot
- [ ] Logs accessible

### Production
- [ ] Bot commands working
- [ ] Payment integration working
- [ ] Database persisting data
- [ ] No errors in logs

---

## 📱 Quick Commands Reference

```bash
# Development
npm run dev              # Start dev server
npm run build            # Build production
npm run build:watch      # Build with watch

# Production (Local Test)
NODE_ENV=production npm start

# PM2
pm2 start index.js --name bot-vpn
pm2 restart bot-vpn
pm2 stop bot-vpn
pm2 logs bot-vpn
pm2 monit
pm2 status
pm2 delete bot-vpn

# systemd
sudo systemctl start bot-vpn
sudo systemctl stop bot-vpn
sudo systemctl restart bot-vpn
sudo systemctl status bot-vpn
sudo journalctl -u bot-vpn -f

# Database
cp data/botvpn.db data/backup.db     # Backup
sqlite3 data/botvpn.db ".tables"     # List tables
sqlite3 data/botvpn.db ".schema"     # Show schema

# Logs
tail -f logs/error.log
tail -f logs/output.log
```

---

## 📞 Need Help?

1. Check logs first: `pm2 logs bot-vpn`
2. Verify config: `cat .vars.json`
3. Check database: `ls -la data/`
4. See [DEPLOYMENT.md](./DEPLOYMENT.md) for detailed guide
5. See [CHANGELOG_V3.md](./CHANGELOG_V3.md) for technical details

---

**Ready to deploy! 🚀**
