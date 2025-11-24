# 🔄 Migration Guide: v2.x → v3.0

Panduan migrasi untuk user yang sudah punya instalasi lama.

---

## ⚠️ Breaking Changes

### 1. Database Location
- **v2.x:** `./botvpn.db` (di root project)
- **v3.0:** `./data/botvpn.db` (di folder `data/`)

### 2. Configuration Loading
- **v2.x:** Langsung load `.vars.json` atau error
- **v3.0:** Support setup mode jika `.vars.json` tidak ada

### 3. Build Output
- **v2.x:** `dist/` bisa include config & DB (jika ada)
- **v3.0:** `dist/` clean, config & DB di-exclude

---

## 🔧 Migration Steps

### Option A: In-Place Update (Recommended)

Untuk instalasi yang sudah running, update tanpa kehilangan data:

```bash
# 1. Backup dulu!
cp .vars.json .vars.json.backup
cp botvpn.db botvpn.db.backup

# 2. Stop aplikasi
pm2 stop bot-vpn
# atau: sudo systemctl stop bot-vpn

# 3. Pull update
git pull origin main
# atau download versi baru

# 4. Install dependencies baru
npm install

# 5. Migrate database location
mkdir -p data
mv botvpn.db data/botvpn.db

# 6. Build
npm run build

# 7. Restart
pm2 restart bot-vpn
# atau: sudo systemctl restart bot-vpn

# 8. Verify
pm2 logs bot-vpn
# Check: Database location updated, bot working
```

### Option B: Fresh Install

Untuk clean install dari scratch:

```bash
# 1. Backup config & database dari instalasi lama
cd /path/to/old-installation
cp .vars.json ~/backup-vars.json
cp botvpn.db ~/backup-db.sqlite

# 2. Stop old installation
pm2 stop bot-vpn
pm2 delete bot-vpn

# 3. Install versi baru
cd /var/www
mv bot-vpn bot-vpn-old
git clone <repo> bot-vpn
cd bot-vpn

# 4. Install dependencies
npm install --production

# 5. Build
npm run build

# 6. Restore config
cp ~/backup-vars.json .vars.json

# 7. Restore database
mkdir -p data
cp ~/backup-db.sqlite data/botvpn.db

# 8. Start dengan PM2
pm2 start ecosystem.config.js

# 9. Verify
pm2 logs bot-vpn
```

---

## 🗄️ Database Migration

### Automatic (Recommended)

Database schema akan di-update otomatis saat aplikasi start:

```javascript
// v3.0 includes safe column additions
// Existing data tetap aman
```

### Manual (Jika ada masalah)

```bash
# Backup dulu
cp data/botvpn.db data/botvpn.db.before-migration

# Check schema
sqlite3 data/botvpn.db ".schema users"

# Jika ada kolom yang hilang, akan ditambahkan otomatis
# saat aplikasi start pertama kali
```

---

## 📝 Configuration Check

### Verify Config Format

```bash
# Check JSON valid
cat .vars.json | python3 -m json.tool

# atau dengan Node.js
node -e "console.log(JSON.parse(require('fs').readFileSync('.vars.json', 'utf8')))"
```

### Update Config Structure (Jika perlu)

Jika ada field baru di v3.0:

```bash
# Lihat example
cat .vars.json.example

# Edit config Anda
nano .vars.json
# Tambahkan field baru jika ada
```

---

## 🔄 PM2 Configuration Update

### Update PM2 Process

```bash
# Stop old process
pm2 stop bot-vpn
pm2 delete bot-vpn

# Start dengan config baru
pm2 start ecosystem.config.js

# Save
pm2 save

# Verify
pm2 status
pm2 logs bot-vpn
```

### Update Environment Variables

Edit `ecosystem.config.js` jika perlu customize:

```javascript
env: {
  NODE_ENV: 'production',
  PORT: 50123,
  DB_DIR: './data',           // ← New in v3.0
  DB_PATH: './data/botvpn.db' // ← New in v3.0
}
```

---

## 🔒 systemd Service Update

Jika menggunakan systemd:

```bash
# Stop service
sudo systemctl stop bot-vpn

# Update service file
sudo nano /etc/systemd/system/bot-vpn.service
```

Add environment variables:

```ini
Environment="DB_DIR=/var/www/bot-vpn/data"
Environment="DB_PATH=/var/www/bot-vpn/data/botvpn.db"
```

Restart service:

```bash
sudo systemctl daemon-reload
sudo systemctl start bot-vpn
sudo systemctl status bot-vpn
```

---

## ✅ Verification After Migration

### 1. Check Application Running

```bash
# PM2
pm2 status
pm2 logs bot-vpn --lines 50

# systemd
sudo systemctl status bot-vpn
sudo journalctl -u bot-vpn --since "5 minutes ago"
```

Expected output:
```
✅ Configuration loaded successfully
✅ Connected to SQLite3 at: ./data/botvpn.db
✅ Database schema verified/updated successfully
✅ Bot started successfully!
```

### 2. Check Database

```bash
# Verify location
ls -la data/botvpn.db

# Check tables
sqlite3 data/botvpn.db ".tables"

# Check user count (should match old DB)
sqlite3 data/botvpn.db "SELECT COUNT(*) FROM users;"
```

### 3. Check Configuration

```bash
# Config exists
ls -la .vars.json

# Config readable
cat .vars.json

# Web interface accessible
curl http://localhost:50123/health
```

### 4. Test Bot Functions

```
Telegram:
1. /start → Should respond ✅
2. /menu → Should show menu ✅
3. Check user data intact ✅
4. Test create account ✅
```

---

## 🐛 Troubleshooting Migration Issues

### Issue: "Database not found"

**Problem:**
```
Error: SQLITE_CANTOPEN: unable to open database file
```

**Solution:**
```bash
# Check database location
ls -la botvpn.db        # Old location
ls -la data/botvpn.db   # New location

# If still in old location, move it
mkdir -p data
mv botvpn.db data/

# Restart
pm2 restart bot-vpn
```

### Issue: "Configuration not loaded"

**Problem:**
```
🔧 APPLICATION IN SETUP MODE
```

**Solution:**
```bash
# Check config exists
ls -la .vars.json

# If exists but not loading
cat .vars.json  # Check format

# If missing, restore from backup
cp .vars.json.backup .vars.json

# Restart
pm2 restart bot-vpn
```

### Issue: "Lost user data"

**Problem:** Database baru (kosong), user data hilang.

**Solution:**
```bash
# Stop app
pm2 stop bot-vpn

# Restore database dari backup
cp botvpn.db.backup data/botvpn.db

# Restart
pm2 start bot-vpn

# Verify data
sqlite3 data/botvpn.db "SELECT COUNT(*) FROM users;"
```

### Issue: "Build errors"

**Problem:** TypeScript compilation errors setelah update.

**Solution:**
```bash
# Clean install
rm -rf node_modules package-lock.json
npm install

# Clean build
rm -rf dist
npm run build

# Check errors
npm run type-check
```

---

## 📊 Data Integrity Check

### Before Migration

```bash
# Count records in each table
sqlite3 botvpn.db "SELECT COUNT(*) FROM users;"
sqlite3 botvpn.db "SELECT COUNT(*) FROM Server;"
sqlite3 botvpn.db "SELECT COUNT(*) FROM invoice_log;"
# ... check all important tables
```

### After Migration

```bash
# Verify same counts
sqlite3 data/botvpn.db "SELECT COUNT(*) FROM users;"
sqlite3 data/botvpn.db "SELECT COUNT(*) FROM Server;"
sqlite3 data/botvpn.db "SELECT COUNT(*) FROM invoice_log;"
# Should match "before" counts
```

---

## 🆕 New Features Available After Migration

### 1. Web-based Config Management

```
Access: http://your-server:50123/config/edit

Benefits:
- No need SSH untuk edit config
- User-friendly form
- Instant validation
- Safe & easy
```

### 2. Improved Logging

```bash
# Clearer logs
pm2 logs bot-vpn

# Look for:
✅ Configuration loaded successfully
✅ Database schema verified/updated successfully
🆕 Initializing new database schema...
```

### 3. Health Check Endpoint

```bash
# Check app status
curl http://localhost:50123/health

# Response:
{
  "status": "ok",
  "setupMode": false,
  "timestamp": "2025-11-23T..."
}
```

---

## 💡 Tips for Smooth Migration

1. **Always Backup First**
   ```bash
   tar -czf backup-$(date +%Y%m%d).tar.gz \
     .vars.json botvpn.db
   ```

2. **Test in Staging First**
   - Setup test VPS
   - Practice migration
   - Verify all works
   - Then do production

3. **Gradual Rollout**
   - If you have multiple instances
   - Migrate one at a time
   - Monitor each before next

4. **Schedule Maintenance**
   - Pick low-traffic time
   - Notify users in advance
   - Keep old backup running until verified

5. **Monitor Closely**
   ```bash
   # First hour after migration
   watch -n 10 'pm2 status && pm2 logs bot-vpn --lines 5'
   ```

---

## 📞 Rollback Plan

If migration fails, rollback steps:

```bash
# 1. Stop new version
pm2 stop bot-vpn
pm2 delete bot-vpn

# 2. Restore old files
cd /var/www
mv bot-vpn bot-vpn-v3-failed
mv bot-vpn-old bot-vpn
cd bot-vpn

# 3. Restore database to old location
mv data/botvpn.db botvpn.db
# atau restore dari backup:
cp botvpn.db.backup botvpn.db

# 4. Start old version
pm2 start index.js --name bot-vpn

# 5. Verify
pm2 logs bot-vpn
# Test bot di Telegram
```

---

## ✅ Migration Checklist

Pre-Migration:
- [ ] Backup `.vars.json`
- [ ] Backup `botvpn.db`
- [ ] Note current user count
- [ ] Note current server count
- [ ] PM2/systemd config saved

Migration:
- [ ] Pull/download v3.0
- [ ] `npm install`
- [ ] Move DB to `data/`
- [ ] `npm run build`
- [ ] Update PM2/systemd config
- [ ] Restart application

Post-Migration:
- [ ] App running (PM2/systemd)
- [ ] Database at correct location
- [ ] User count matches
- [ ] Bot responds to `/start`
- [ ] Config editable via web
- [ ] Logs show no errors
- [ ] Test reboot (auto-start works)

---

## 📈 Expected Downtime

- **In-place update:** 2-5 minutes
- **Fresh install:** 10-15 minutes
- **With testing:** 30-60 minutes

---

**Good luck with your migration! 🚀**

If you encounter issues not covered here, check:
- [DEPLOYMENT.md](./DEPLOYMENT.md) - Troubleshooting section
- [QUICKSTART.md](./QUICKSTART.md) - Common issues
- Project logs: `pm2 logs` atau `journalctl -u bot-vpn`
