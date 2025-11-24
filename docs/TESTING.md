# 🧪 Testing Account Persistence

## ✅ Bot Status
Bot telah di-restart dengan code terbaru yang memiliki:
- ✅ Infrastructure database initialization
- ✅ Account persistence di createActions.ts (button menu)
- ✅ Account persistence di textHandler.ts (text command)
- ✅ Tabel accounts sudah ada di database

## 📋 Testing Steps

### 1️⃣ Test Create Account (Button Menu)
1. Buka bot di Telegram
2. Klik menu **Create Account**
3. Pilih protocol (SSH/VMess/VLess/Trojan/Shadowsocks)
4. Pilih server
5. Input username dan detail lainnya
6. Konfirmasi pembayaran
7. **Account harus berhasil dibuat**

### 2️⃣ Verify Account Saved to Database
```bash
# Method 1: Check via script
./scripts/check-accounts.sh

# Method 2: Direct database query
sqlite3 data/botvpn.db "SELECT * FROM accounts ORDER BY created_at DESC LIMIT 5;"
```

### 3️⃣ Test Akunku Menu
1. Klik menu **Akunku**
2. Harus tampil informasi saldo dan list akun aktif
3. Klik **Detail Akun**
4. Harus muncul list username yang bisa diklik
5. Klik salah satu username
6. Harus tampil detail lengkap akun

### 4️⃣ Monitor Logs Real-time
```bash
# Monitor persistence logs
./scripts/test-account-persist.sh

# Or manual
tail -f bot.log | grep -E "(persist|Account persisted|Extracted data)"
```

## 🔍 Expected Log Messages

### ✅ Success (Premium Account)
```
debug: Extracted data: username=testuser, server=sg1.example.com, expired_at=2025-01-24T...
info: ✅ Account persisted: testuser (SSH) for user 123456
```

### ⏭️ Skipped (Trial Account)
```
info: ⏭️ Skipping trial account persistence
```

### ⚠️ Warning (Extraction Failed)
```
warn: ⚠️ Could not extract username or server from message. username=null, server=sg1.example.com
```

### ❌ Error
```
error: ❌ Failed to persist account: <error details>
```

## 🐛 Troubleshooting

### Problem: Account not saved
**Check:**
1. Apakah bot sudah restart setelah build?
   ```bash
   ps aux | grep "node.*index"
   ```

2. Apakah tabel accounts ada?
   ```bash
   sqlite3 data/botvpn.db ".tables" | grep accounts
   ```

3. Apakah ada error di logs?
   ```bash
   tail -100 bot.log | grep -i error
   ```

### Problem: "Database not initialized" error
**Solution:** Bot belum di-restart dengan code baru
```bash
# Kill old process
pkill -f "node.*index"

# Start bot
NODE_ENV=development node index.js > bot.log 2>&1 &
```

### Problem: Akunku menu shows "Error getting all accounts"
**Check:**
1. Database connection
   ```bash
   sqlite3 data/botvpn.db "SELECT COUNT(*) FROM accounts;"
   ```

2. Infrastructure database initialization
   ```bash
   grep "Infrastructure database initialized" bot.log
   ```

## 📊 Quick Commands

```bash
# Check bot status
ps aux | grep "node.*index"

# Check accounts
./scripts/check-accounts.sh

# Check by user
./scripts/check-accounts.sh <user_id>

# Monitor logs
tail -f bot.log

# Restart bot
pkill -f "node.*index" && NODE_ENV=development node index.js > bot.log 2>&1 &
```

## ✅ Verification Checklist
- [ ] Bot running with latest code
- [ ] Infrastructure database initialized (check logs)
- [ ] Table accounts exists
- [ ] Create account via button menu
- [ ] Check account saved to database
- [ ] View account in Akunku menu
- [ ] View account details
- [ ] Persistence logs showing success
