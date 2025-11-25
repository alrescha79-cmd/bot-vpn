# 📝 Changelog & Implementation Summary

## Version 3.1.2 - Payment Gateway & 3-in-1 Protocol (November 2025)

### 🎯 Fitur Utama

#### ✅ Integrasi Payment Gateway Midtrans
- **Dual Environment Support** - Sandbox untuk testing & Production untuk live
- **Instant Payment Verification** - Webhook real-time untuk update status pembayaran
- **Secure Transaction** - Enkripsi signature untuk keamanan transaksi
- **Auto Top-up** - Saldo otomatis masuk setelah pembayaran berhasil
- **Transaction Monitoring** - Dashboard admin untuk monitoring transaksi
- **Comprehensive Logging** - Detailed logs untuk debugging & audit

#### ✅ Protokol 3-in-1 (VMESS + VLESS + TROJAN)
- **Single Purchase, Triple Protocol** - Satu kali beli dapat 3 protokol sekaligus
- **Unified UUID** - UUID yang sama untuk ketiga protokol (konsisten)
- **Smart Pricing** - Harga 1.5x lipat dari harga normal (value for money)
- **Complete Link Generation** - 6 link total (TLS + gRPC untuk masing-masing protokol)
- **Seamless Renewal** - Perpanjangan langsung untuk ketiga protokol
- **Username Validation** - Validasi otomatis untuk mencegah duplikasi
- **Exclusive for Premium** - Hanya tersedia untuk pembelian & renewal (tidak termasuk trial)

#### ✅ Perbaikan Sistem Trial
- **SSH Trial Connection** - Fixed timeout issue dengan optimasi command execution
- **Consistent User Experience** - Loading message uniform untuk semua protokol
- **Improved Error Handling** - Error messages yang lebih informatif
- **Server Selection Enhancement** - Tampilan server tanpa harga untuk trial (lebih clean)
- **All Protocols Working** - SSH, VMESS, VLESS, TROJAN, SHADOWSOCKS trial berfungsi sempurna

#### ✅ Setup Konfigurasi Manual via Terminal
- **CLI-based Setup** - Setup konfigurasi langsung dari terminal untuk production environment
- **Interactive Prompts** - Input interaktif dengan validasi real-time
- **Secure Input** - Password & sensitive data handling yang aman
- **Environment Detection** - Auto-detect production vs development mode
- **Validation & Verification** - Validasi format Telegram Bot Token, User ID, dll
- **Quick Setup** - Setup selesai dalam hitungan menit tanpa web browser

### 📦 File Baru

#### Payment Gateway
- `src/services/qris.service.ts` - Service untuk QRIS payment
- `src/api/midtrans.webhook.ts` - Webhook handler untuk Midtrans
- `docs/MIDTRANS_SETUP.md` - Panduan lengkap setup Midtrans
- `docs/MIDTRANS_QUICKSTART.md` - Quick start guide 5 menit
- `docs/MIDTRANS_KEYS_EXPLAINED.md` - Penjelasan detail API keys
- `docs/QRIS_INTEGRATION.md` - Dokumentasi integrasi QRIS

#### Protokol 3-in-1
- `src/modules/protocols/create3IN1.ts` - Modul create akun 3-in-1
- `src/modules/protocols/renew3IN1.ts` - Modul renewal akun 3-in-1

#### Setup & Documentation
- `scripts/install-production.sh` - Script instalasi production dengan CLI setup
- `docs/PRODUCTION_INSTALL.md` - Panduan instalasi production lengkap

### 🔧 File yang Dimodifikasi

#### Configuration
- `src/config/constants.ts`
  - Tambah environment variables untuk Midtrans
  - Configuration constants untuk payment gateway
  - Dual environment support (Sandbox/Production)

- `.vars.json.example`
  - Tambah field Midtrans credentials
  - Field untuk QRIS configuration
  - Dokumentasi inline untuk setiap field

#### Handlers
- `src/handlers/actions/createActions.ts`
  - Integrasi 3-in-1 protocol handler
  - Payment confirmation dengan Midtrans
  - Price multiplier 1.5x untuk 3-in-1
  - Marking accounts di database untuk tracking

- `src/handlers/actions/serviceActions.ts`
  - Tambah button "3 IN 1" untuk create & renew
  - Conditional rendering (tidak tampil di trial)
  - Handler registration untuk 3-in-1 actions

- `src/handlers/actions/renewActions.ts`
  - Support renewal 3-in-1 accounts
  - Validation untuk ketiga protokol
  - Price calculation dengan multiplier

- `src/handlers/actions/trialActions.ts`
  - Loading message untuk semua protokol trial
  - Server validation improvement
  - Error handling yang lebih baik

- `src/handlers/events/textHandler.ts`
  - Username validation untuk 3-in-1
  - Prevent duplicate username across protocols
  - State management untuk 3-in-1 flow

#### Services
- `src/services/depositService.ts`
  - Integrasi Midtrans payment creation
  - Auto-verification setiap 10 detik
  - Transaction status update
  - Webhook processing

#### Modules
- `src/modules/protocols/ssh/trialSSH.ts`
  - Optimasi command execution (menghindari timeout)
  - Simplified user creation script
  - JSON output format yang konsisten
  - Better error handling dengan exit codes

- All protocol create/renew modules
  - Handler mapping untuk 3-in-1
  - Username validation integration

### 🐛 Bug Fixes

1. **SSH Trial Timeout**
   - Root cause: Command execution terlalu kompleks dengan nested shell
   - Fix: Simplified command script, remove unnecessary nesting
   - Result: Execution time berkurang dari 45+ detik ke <10 detik

2. **3-in-1 Stuck Bug**
   - Root cause: Handler action tidak ter-register dengan benar
   - Fix: Explicit registration di registerProtocolActions()
   - Result: Flow create & renew 3-in-1 berjalan lancar

3. **Trial Server Selection Pricing**
   - Root cause: Server selection menampilkan harga untuk trial
   - Fix: Conditional rendering berdasarkan action type
   - Result: Trial hanya menampilkan nama server (tanpa harga)

4. **Duplicate Username Issue**
   - Root cause: Tidak ada validasi cross-protocol
   - Fix: Check ke database akun_aktif sebelum create
   - Result: Username unique across all protocols

5. **Midtrans Payment Status**
   - Root cause: Manual check tidak update status di database
   - Fix: Update transaction status setelah verifikasi
   - Result: Status payment tersinkronisasi dengan Midtrans

### 📊 Peningkatan Performa

1. **Trial Account Creation**
   - Before: 45+ detik (timeout)
   - After: <10 detik
   - Improvement: 78% faster

2. **3-in-1 Account Creation**
   - Single API call untuk 3 protokol
   - Parallel execution untuk efficiency
   - Consistent UUID generation

3. **Payment Verification**
   - Auto-check setiap 10 detik
   - Instant webhook update
   - Reduced manual intervention

### 🧪 Testing Checklist

#### Payment Gateway
- [x] Midtrans Sandbox payment creation
- [x] Webhook callback processing
- [x] Auto-verification service
- [x] Transaction status update
- [x] Balance top-up after payment
- [x] Admin transaction monitoring
- [x] Error handling & logging

#### 3-in-1 Protocol
- [x] Create 3-in-1 account (VMESS+VLESS+TROJAN)
- [x] Link generation (6 links total)
- [x] Renew 3-in-1 account
- [x] Username validation
- [x] Price calculation (1.5x multiplier)
- [x] Database tracking
- [x] Exclusion from trial menu

#### Trial System
- [x] SSH trial creation (no timeout)
- [x] Loading message for all protocols
- [x] Server selection without pricing
- [x] VMESS, VLESS, TROJAN, SHADOWSOCKS trials
- [x] Error handling & user feedback

#### CLI Setup
- [x] Interactive prompts working
- [x] Input validation
- [x] Config file generation
- [x] Database initialization
- [x] Service restart

### 🚀 Upgrade Notes

**Dari v3.1.0/v3.1.1 ke v3.1.2:**

1. **Pull kode terbaru**
   ```bash
   git pull origin main
   ```

2. **Update dependencies**
   ```bash
   npm install
   ```

3. **Update konfigurasi**
   - Tambahkan Midtrans credentials ke `.vars.json`
   - Atau jalankan `/config/edit` untuk update via web
   - Atau gunakan `scripts/install-production.sh` untuk CLI setup

4. **Build ulang**
   ```bash
   npm run build
   ```

5. **Restart bot**
   ```bash
   pm2 restart bot-vpn
   # atau
   systemctl restart bot-vpn
   ```

6. **Verifikasi**
   - Test create 3-in-1 account
   - Test trial SSH
   - Test Midtrans payment (Sandbox)
   ```bash
   pm2 logs bot-vpn
   ```

### 📝 Migration Notes

#### Update .vars.json

Tambahkan field baru:

```json
{
  "MIDTRANS_MERCHANT_ID": "your-merchant-id",
  "MIDTRANS_CLIENT_KEY": "your-client-key",
  "MIDTRANS_SERVER_KEY": "your-server-key",
  "MIDTRANS_IS_PRODUCTION": false
}
```

#### Database Migration

Tidak ada perubahan schema. Database akan tetap kompatibel.

#### Breaking Changes

**Tidak ada breaking changes.** Update ini backward compatible.

### 🎓 Best Practices

1. **Payment Gateway Setup**
   - Mulai dengan Sandbox untuk testing
   - Verifikasi webhook URL accessible
   - Test payment flow sebelum production
   - Monitor transaction logs

2. **3-in-1 Usage**
   - Recommended untuk user yang ingin flexibility
   - Pricing yang fair (1.5x untuk 3 protokol)
   - Educate users tentang keuntungan 3-in-1

3. **Trial System**
   - Monitor trial usage untuk prevent abuse
   - Set reasonable limits per user role
   - Regular cleanup trial accounts

4. **CLI Setup**
   - Gunakan untuk production deployment
   - Simpan credential dengan aman
   - Document setup steps untuk team

### 📞 Support & Resources

**Dokumentasi:**
- [Midtrans Setup Guide](docs/MIDTRANS_SETUP.md)
- [Midtrans Quick Start](docs/MIDTRANS_QUICKSTART.md)
- [Production Installation](docs/PRODUCTION_INSTALL.md)
- [QRIS Integration](docs/QRIS_INTEGRATION.md)

**Troubleshooting:**
- Check logs: `pm2 logs bot-vpn`
- Webhook testing: Use Midtrans Dashboard
- Trial issues: Check SSH connection & server status
- 3-in-1 issues: Verify handler registration

**Community:**
- Report bugs: GitHub Issues
- Feature requests: GitHub Discussions
- Support: Telegram Group

---

**Version:** 3.1.2  
**Release Date:** 25 November 2025  
**Status:** ✅ Production Ready  
**Major Updates:** Payment Gateway, 3-in-1 Protocol, Trial Fixes, CLI Setup

---

## Version 3.1.0 - Account Persistence Update (November 2025)

### 🎯 Major Features

#### ✅ Account Persistence to Database
- **Auto-save premium accounts** - Semua akun non-trial tersimpan otomatis ke SQLite
- **New database table** `accounts` dengan schema lengkap:
  - id, username, protocol, server, created_at, expired_at
  - owner_user_id, status (active/expired), raw_response
- **Indexes** pada username, owner_user_id, dan status untuk performa optimal

#### ✅ Akunku Menu (Replaces "Cek Saldo")
- **View all accounts** - Lihat list akun yang telah dibuat
- **Detail view** - Klik username untuk detail lengkap termasuk raw response
- **Delete accounts** - Hapus akun dari database
- **Role-based filtering** - User/Reseller lihat akun mereka, Admin lihat semua

#### ✅ Enhanced Admin Access
- **Fixed broadcast** - Admin dapat mengirim broadcast tanpa error
- **Fixed all admin tools** - 12 admin action handlers diperbaiki
- **Database-only authorization** - Simplified auth check dari database role
- **Top-up history access** - Admin dapat melihat riwayat top-up

#### ✅ Improved Data Extraction
- **Flexible regex patterns** - Handle berbagai format message dengan space berbeda
- **Emoji support** - Ekstraksi data dari message dengan emoji
- **Better error handling** - Graceful fallback jika ekstraksi gagal
- **Debug logging** - Detailed logs untuk troubleshooting

### 📦 New Files

#### Utilities
- `src/utils/accountPersistence.ts` - Account persistence helper
  - extractUsername(), extractServer(), extractExpiryDate()
  - persistAccountIfPremium() - Main persistence function
  - Trial detection

#### Repositories
- `src/repositories/accountRepository.ts` - Account data access layer
  - saveCreatedAccount()
  - getAccountsByOwner()
  - getAllAccounts()
  - getAccountById()
  - deleteAccountById()

#### Helper Scripts
- `scripts/check-accounts.sh` - View saved accounts in database
- `scripts/set-admin.sh` - Set user as admin/owner
- `scripts/test-account-persist.sh` - Monitor persistence logs
- `scripts/test-extraction.js` - Test regex extraction patterns

#### Documentation
- `docs/TESTING.md` - Testing guide for account persistence
- Updated `README.md` with v3.1 features
- Updated `DOCUMENTATION_INDEX.md`

### 🔧 Files Modified

#### Database Schema
- `src/database/schema.ts`
  - Added `accounts` table with full schema
  - Added `topup_log` table for admin features
  - Proper indexes for performance

#### Handlers
- `src/handlers/actions/createActions.ts`
  - Integrated `persistAccountIfPremium()` after account creation
  - Non-blocking with try-catch

- `src/handlers/events/textHandler.ts`
  - Added persistence for text-based account creation
  - Only for 'create' action (not 'renew')

- `src/handlers/actions/navigationActions.ts`
  - New `registerAkunkuAction()` - Main Akunku menu
  - New `registerAkunkuDetailAction()` - List accounts with buttons
  - New `registerAkunkuViewAccountAction()` - View single account detail
  - New `registerAkunkuDeleteAction()` - Delete account selection
  - New `registerAkunkuConfirmDeleteAction()` - Confirm deletion
  - Graceful error handling for missing tables

- `src/handlers/actions/adminToolsActions.ts`
  - Fixed all 12 admin handlers authorization
  - Changed from config check to database role check
  - Simplified: `user.role === 'admin' || user.role === 'owner'`

- `src/handlers/actions/adminActions.ts`
  - Fixed main admin menu authorization

#### Infrastructure
- `index.js`
  - Added `initializeDatabase()` from infrastructure/database
  - Ensures both database systems are initialized

- `src/utils/keyboard.ts`
  - Changed "Cek Saldo" to "Akunku"

- `src/handlers/helpers/menuHelper.ts`
  - Updated menu text for Akunku

### 🐛 Bug Fixes

1. **Database not initialized error**
   - Root cause: Two database systems (legacy + new infrastructure)
   - Fix: Call `initializeDatabase()` in main startup

2. **Regex extraction failures**
   - Root cause: Patterns too strict for varied message formats
   - Fix: Flexible regex with `\*?` and emoji support

3. **Admin broadcast permission denied**
   - Root cause: Auth check used config file instead of database
   - Fix: Both action handler AND text handler now check database role

4. **Akunku menu errors**
   - Root cause: Table might not exist yet + no error handling
   - Fix: Try-catch with fallback to empty array

### 📊 Testing Checklist

- [x] Account creation saves to database (all protocols)
- [x] Akunku menu displays saved accounts
- [x] Detail view shows full account info
- [x] Delete account works correctly
- [x] Admin can view all accounts
- [x] User/Reseller sees only their accounts
- [x] Broadcast works for admin
- [x] All admin tools accessible
- [x] Trial accounts NOT saved (as expected)
- [x] Graceful error handling

### 🚀 Upgrade Notes

**From v3.0 to v3.1:**

1. **Pull latest code**
   ```bash
   git pull origin main
   ```

2. **Install dependencies** (if any new)
   ```bash
   npm install
   ```

3. **Build**
   ```bash
   npm run build
   ```

4. **Restart bot**
   ```bash
   pm2 restart bot-vpn
   # or
   systemctl restart bot-vpn
   ```

5. **Verify**
   ```bash
   ./scripts/check-accounts.sh
   ```

Database schema will auto-migrate on restart.

---

## Version 3.0.0 - Production Ready Deployment (Previous)

### 🎯 Tujuan Utama
Membuat aplikasi **production-ready** dengan:
- ✅ Frontend setup & edit konfigurasi
- ✅ Build bersih (tanpa config/database)
- ✅ Initial setup mode via web
- ✅ Database auto-create di production
- ✅ Auto-start support (PM2/systemd)

---

## 📦 Files Created

### Frontend
- `src/frontend/config-setup.html` - Modern web interface untuk setup & edit konfigurasi

### Backend Services
- `src/services/config.service.ts` - Service untuk manage konfigurasi
- `src/api/config.routes.ts` - API routes untuk config management
- `src/config/setup-mode.ts` - Logic untuk setup mode dan middleware

### Build & Deployment
- `scripts/build-clean.js` - Clean build script (exclude config & DB)
- `ecosystem.config.js` - PM2 configuration
- `deployment/bot-vpn.service` - systemd service file

### Documentation
- `DEPLOYMENT.md` - Comprehensive deployment guide
- `README_NEW.md` - Updated README dengan v3.0 features

---

## 🔧 Files Modified

### Core Configuration
- `src/config/index.ts`
  - Added setup mode support
  - Graceful handling jika `.vars.json` tidak ada
  - Return minimal config untuk setup mode

### Database
- `src/database/connection.ts`
  - Database path configurable via env vars
  - Auto-create `data/` directory
  - Database location outside `dist/`
  - Flag `isNewDatabase()` untuk detect first-time

- `src/database/schema.ts`
  - Production-ready initialization
  - Better error handling
  - Log info untuk new vs existing database

### Build & Ignore
- `.gitignore`
  - Added `data/` directory
  - All database files (*.db, *.sqlite, *.sqlite3)
  - Better organization

- `package.json`
  - New build script: `npm run build` → uses clean build script
  - Added `start:prod` script

### Main Entry Point
- `index.js`
  - Integration dengan setup mode
  - Config API routes
  - Conditional bot initialization (skip if setup mode)
  - Express server start first untuk setup

---

## 🌟 Key Features

### 1. Web-based Configuration Setup

**Initial Setup (First Time)**
- Aplikasi detect `.vars.json` tidak ada
- Auto-redirect ke `/setup`
- User isi form konfigurasi via browser
- Save ke `.vars.json`
- Restart aplikasi → normal mode

**Edit Configuration (After Setup)**
- Akses `/config/edit`
- Form pre-populated dengan config saat ini
- Edit dan save
- Restart untuk apply changes

### 2. Clean Build Process

**Before (v2.0)**
```
dist/
├── compiled-code/
├── .vars.json          ← ❌ Config file included
└── botvpn.db          ← ❌ Database included
```

**After (v3.0)**
```
dist/
├── compiled-code/
└── frontend/
    └── config-setup.html

data/                   ← ✅ Separate, persisten
└── botvpn.db

.vars.json             ← ✅ Runtime, not in build
```

### 3. Production Deployment Flow

```
┌─────────────┐
│   Build     │  npm run build
│  (Local)    │  → dist/ (clean)
└──────┬──────┘
       │
       ▼
┌─────────────┐
│  Upload to  │  dist/, index.js, package.json
│     VPS     │  (NO config, NO database)
└──────┬──────┘
       │
       ▼
┌─────────────┐
│   Install   │  npm install --production
│Dependencies │
└──────┬──────┘
       │
       ▼
┌─────────────┐
│   Start     │  node index.js
│    App      │  (Setup Mode)
└──────┬──────┘
       │
       ▼
┌─────────────┐
│   Setup     │  http://vps:50123/setup
│   Config    │  Fill form → Save
└──────┬──────┘
       │
       ▼
┌─────────────┐
│   Restart   │  pm2 restart / systemctl restart
│     App     │  (Normal Mode)
└──────┬──────┘
       │
       ▼
┌─────────────┐
│  Running    │  Bot active + DB auto-created
│  Production │  Survives reboot
└─────────────┘
```

### 4. Database Management

**Development**
- Location: `./data/botvpn.db`
- Auto-create schema jika tidak ada
- Bisa hapus & recreate untuk testing

**Production**
- Location: Configurable (env: `DB_PATH`)
- Default: `./data/botvpn.db`
- Auto-create schema saat first run
- Empty tables (no seed data)
- Persisten setelah reboot
- Outside `dist/` untuk clean separation

### 5. Auto-Start Support

**PM2**
- Config: `ecosystem.config.js`
- Commands: `pm2 start/stop/restart/logs`
- Auto-restart on crash
- Startup on reboot: `pm2 startup`

**systemd**
- Service: `deployment/bot-vpn.service`
- Commands: `systemctl start/stop/restart/status`
- Auto-restart on failure
- Logs: `journalctl -u bot-vpn`

---

## 🧪 Testing Checklist

### Local Development
- [ ] Clone project
- [ ] `npm install`
- [ ] Hapus `.vars.json` (test setup mode)
- [ ] `npm run dev`
- [ ] Akses `http://localhost:50123/setup`
- [ ] Isi form → Save
- [ ] Restart → Bot should start normally
- [ ] Test `/config/edit` untuk edit config

### Build Process
- [ ] `npm run build`
- [ ] Verify `dist/` tidak ada `.vars.json`
- [ ] Verify `dist/` tidak ada `*.db`
- [ ] Verify `dist/frontend/config-setup.html` exists
- [ ] Check console output → "BUILD COMPLETE"

### Production Simulation
- [ ] Hapus `.vars.json` dan `data/`
- [ ] `NODE_ENV=production npm start`
- [ ] App in setup mode
- [ ] Akses setup page
- [ ] Complete setup
- [ ] Restart → Check database created in `data/`
- [ ] Restart again → Should persist

### VPS Deployment (Real)
- [ ] Upload `dist/`, `index.js`, `package*.json`
- [ ] `npm install --production`
- [ ] Start app (setup mode)
- [ ] Complete setup via web
- [ ] Setup PM2 atau systemd
- [ ] Reboot VPS
- [ ] Verify app auto-start
- [ ] Check database persists

---

## 📊 File Size Comparison

**Before (with config & DB in build)**
```
dist/                    ~5 MB
├── code/                ~4 MB
├── .vars.json           ~1 KB
└── botvpn.db            ~500 KB
```

**After (clean build)**
```
dist/                    ~4 MB
└── code/                ~4 MB

# Separate (not in build)
data/botvpn.db          ~500 KB  (auto-created)
.vars.json              ~1 KB    (created via web)
```

---

## ⚠️ Breaking Changes

### For Existing Users

1. **Configuration File**
   - Sebelumnya: `.vars.json` bisa dicopy langsung
   - Sekarang: Harus setup via web interface atau manual create

2. **Database Location**
   - Sebelumnya: `./botvpn.db`
   - Sekarang: `./data/botvpn.db` (configurable)

3. **Build Output**
   - Sebelumnya: `dist/` include everything
   - Sekarang: `dist/` only code, config & DB separate

### Migration Steps

Jika sudah ada instalasi lama:

```bash
# Backup config dan database
cp .vars.json .vars.json.backup
cp botvpn.db data/botvpn.db

# Pull update
git pull origin main

# Install dependencies
npm install

# Build
npm run build

# Verify config exists
ls -la .vars.json

# Start
npm start
```

---

## 🎓 Best Practices Applied

1. **12-Factor App Principles**
   - Config via environment (or setup interface)
   - Build once, deploy anywhere
   - Stateless processes (database separate)

2. **Security**
   - No sensitive data in repository
   - Config & database in `.gitignore`
   - Permissions properly set

3. **Maintainability**
   - Clear separation: code vs data vs config
   - Comprehensive documentation
   - Type-safe TypeScript

4. **Reliability**
   - Auto-restart on crash (PM2/systemd)
   - Survives reboot
   - Error handling & logging

5. **User Experience**
   - Web-based setup (no manual file editing)
   - Clear status messages
   - Health check endpoints

---

## 🚀 Next Steps (Future Enhancements)

Potential improvements untuk versi berikutnya:

1. **Authentication untuk Config Interface**
   - Login protection untuk `/setup` dan `/config/edit`
   - JWT atau session-based auth

2. **Database Migration System**
   - Automated schema migrations
   - Version tracking

3. **Multi-instance Support**
   - Load balancing
   - Shared database

4. **Monitoring Dashboard**
   - Real-time metrics
   - Performance monitoring

5. **Backup Automation**
   - Scheduled backups
   - Cloud backup integration

6. **Docker Support**
   - Dockerfile
   - Docker Compose
   - Easy containerized deployment

---

## ✅ Success Criteria Met

- ✅ Frontend modern untuk setup & edit config
- ✅ Build process bersih (no sensitive files)
- ✅ Setup mode otomatis saat first run
- ✅ Database auto-create dengan schema kosong
- ✅ Support PM2 dan systemd
- ✅ Config & database persisten setelah reboot
- ✅ Production ready deployment
- ✅ Comprehensive documentation
- ✅ Backward compatible (with migration)

---

## 📞 Support & Maintenance

**For Developers:**
- Code structure clear & modular
- TypeScript untuk type safety
- Comments & documentation inline

**For DevOps:**
- Deployment guide lengkap
- PM2 & systemd configs ready
- Troubleshooting section

**For End Users:**
- Web-based setup (no technical knowledge needed)
- Clear error messages
- Health check endpoints

---

**Version:** 3.0.0  
**Date:** 2025-11-23  
**Status:** ✅ Production Ready
