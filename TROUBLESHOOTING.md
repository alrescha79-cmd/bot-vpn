# 🔧 Troubleshooting Guide

## Common Issues & Solutions

### 1. ❌ Database Error: `SQLITE_ERROR: no such table: users`

**Symptom:**
```
error: ❌ Error saving user: SQLITE_ERROR: no such table: users
```

**Cause:** Database schema not initialized.

**Solution:** The application now auto-initializes all tables on startup. If you see this error:
1. Make sure the database file has proper permissions (see issue #2)
2. Delete the corrupted database file and restart the app to recreate it
3. Check logs for `✅ Database schema initialized successfully`

---

### 2. ❌ Database Error: `SQLITE_READONLY: attempt to write a readonly database`

**Symptom:**
```
error: ❌ Failed to initialize database schema
error: SQLITE_READONLY: attempt to write a readonly database
```

**Cause:** Database file or data directory owned by wrong user (usually `root`).

**Solution:**
```bash
# Fix ownership of database file
sudo chown -R $USER:$USER ./data/

# Or if database is in root directory
sudo chown $USER:$USER ./botvpn.db
```

**Prevention:** Don't run the app with `sudo` unless absolutely necessary.

---

### 3. ❌ Error Tambah Server: `no such column: isp` atau `no such column: lokasi`

**Symptom:**
```
error: ❌ Gagal tambah server
info: 📥 Proses tambah server dimulai
error: ❌ Error saat tambah server
```

**Cause:** Database schema outdated - missing `isp` and `lokasi` columns in Server table.

**Solution:**

**Option 1: Delete database (fresh start - CAUTION: loses all data):**
```bash
# Stop bot
pkill -9 node

# Delete database
rm -f ./data/botvpn.db ./botvpn.db

# Restart bot (will recreate with new schema)
npm run dev  # or NODE_ENV=production node index.js
```

**Option 2: Manual migration (preserves data):**
```bash
# Backup first
cp ./data/botvpn.db ./data/botvpn.db.backup

# Add columns manually
sqlite3 ./data/botvpn.db <<EOF
ALTER TABLE Server ADD COLUMN isp TEXT DEFAULT 'Tidak diketahui';
ALTER TABLE Server ADD COLUMN lokasi TEXT DEFAULT 'Tidak diketahui';
ALTER TABLE Server ADD COLUMN created_at TEXT DEFAULT CURRENT_TIMESTAMP;
.quit
EOF

# Restart bot
npm run dev
```

**Option 3: Let auto-migration handle it (recommended):**
```bash
# Just restart the bot - schema.ts will auto-add missing columns
npm run dev
```

**Verify fix:**
```bash
# Check Server table schema
sqlite3 ./data/botvpn.db "PRAGMA table_info(Server);"

# Should see columns: id, domain, auth, harga, nama_server, quota, iplimit, 
# batas_create_akun, total_create_akun, isp, lokasi, created_at
```

---

### 4. ⚠️ Setup Mode - Bot Not Starting

**Symptom:**
```
⚠️ Application in SETUP MODE - Bot will not start
```

**Cause:** `.vars.json` file missing or incomplete.

**Solution:**
1. Open the setup page: `http://localhost:50123/setup`
2. Fill in all required configuration fields
3. Click "Simpan & Lanjutkan"
4. Restart the application

**Verify:**
- Check that `.vars.json` exists in project root
- Verify it contains all required fields from `.vars.json.example`

---

### 4. 🔌 Port Already in Use

**Symptom:**
```
Error: listen EADDRINUSE: address already in use :::50123
```

**Solution:**
```bash
# Find process using the port
lsof -i :50123

# Kill the process
kill -9 <PID>

# Or change port in .vars.json
```

---

### 5. 📦 Module Not Found in Production

**Symptom:**
```
Error: Cannot find module 'node-cron'
Error: Cannot find module './dist/config'
```

**Cause:** 
- Missing dependencies (`node_modules/` not installed)
- Running production build without building first

**Solution:**
```bash
# If deploying to VPS or new location
cd /path/to/deployment/folder

# CRITICAL: Install dependencies first!
npm install --production

# Then run
NODE_ENV=production node index.js
```

**Prevention:**
- ⚠️ **NEVER copy `node_modules/` from local to VPS** - binary dependencies may be incompatible
- ✅ **ALWAYS run `npm install --production`** on the target server
- ✅ Make sure `package.json` and `package-lock.json` are uploaded

**Quick Check:**
```bash
# Verify node_modules exists
ls node_modules/ | head -10

# Should see folders like: telegraf/, sqlite3/, express/, node-cron/, etc.
```

---

### 6. 🔌 Port Already in Use

**Symptom:**
```
npm error The operation was rejected by your operating system.
npm error It is likely you do not have the permissions...
```

**Cause:** Previous installation with `sudo` caused ownership issues.

**Solution:**
```bash
# Fix node_modules ownership
sudo chown -R $USER:$USER node_modules/

# Reinstall if needed
npm install
```

---

## Quick Diagnostic Commands

```bash
# Check database permissions
ls -la ./data/ ./botvpn.db

# Check if port is available
lsof -i :50123

# Check configuration file
cat .vars.json | head -20

# Check logs
tail -f logs/bot.log  # if using file logging

# Test database connection
sqlite3 ./data/botvpn.db "SELECT name FROM sqlite_master WHERE type='table';"
```

---

## Getting Help

If you encounter issues not covered here:

1. Check application logs for detailed error messages
2. Ensure all dependencies are installed: `npm install`
3. Verify Node.js version: `node --version` (requires v20+)
4. Check `.vars.json.example` for required configuration format
5. Review [DEPLOYMENT.md](./docs/DEPLOYMENT.md) for deployment-specific issues

---

## Development vs Production Checklist

**Development:**
- ✅ Run with `npm run dev`
- ✅ Uses TypeScript directly via ts-node
- ✅ Auto-reloads on file changes
- ✅ Can use `console.log` for debugging

**Production:**
- ✅ Build first: `npm run build`
- ✅ Run: `NODE_ENV=production node index.js`
- ✅ Uses compiled JavaScript from `dist/`
- ✅ Setup via web interface on first run
- ✅ Database auto-created in `./data/`
- ✅ Use PM2 or systemd for auto-restart

---

**Last Updated:** November 23, 2025
