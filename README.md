# 🤖 Bot Telegram VPN V2

Bot Telegram untuk manajemen akun VPN dengan arsitektur enterprise-grade yang modular, skalabel, dan mudah dipelihara.

## 🚀 Mulai Cepat

### Prasyarat

- Node.js v20+ (disarankan menggunakan NVM)
- NPM atau Yarn
- Akses SSH ke server VPN Anda
- PM2 (opsional, untuk manajemen proses)

### 1. Clone Repositori

```bash
git clone https://github.com/alrescha79-cmd/bot-vpn.git
cd bot-vpn
```

### 2. Instal Dependensi

```bash
npm install
```

### 3. Konfigurasi

```bash
cp .vars.json.example .vars.json
nano .vars.json  # Edit dengan kredensial Anda
```

### 4. Jalankan Bot

```bash
# Development mode (RECOMMENDED - Full functionality)
node index.js

# Production mode (dengan PM2)
pm2 start index.js --name vpn-bot
pm2 save
pm2 startup
```

### 5. Menjadikan Telegram Anda sebagai Admin

```bash
sqlite3 botvpn.db "UPDATE users SET role = 'admin' WHERE user_id = YOUR_TELEGRAM_ID;"
```

Ganti `YOUR_TELEGRAM_ID` dengan ID Telegram Anda yang sebenarnya.

### 6. Restart Bot Setelah Perubahan Konfigurasi

```bash
# Dengan PM2
pm2 restart vpn-bot

# Atau stop/start manual
pm2 stop vpn-bot
pm2 start vpn-bot

# Hapus dari PM2
pm2 delete vpn-bot
```

Jika menjalankan dalam mode development, cukup hentikan proses dengan `CTRL + C` dan jalankan kembali dengan `node index.js`.

## ✨ Arsitektur Enterprise-Grade

Bot ini telah direfaktor sepenuhnya mengikuti standar enterprise dengan pemisahan layer yang jelas:

- ✅ **Arsitektur Modular** - Pemisahan tanggung jawab yang jelas
- ✅ **Repository Pattern** - Abstraksi akses data yang bersih
- ✅ **Infrastructure Layer** - Database dan cache terkelola
- ✅ **100% Async/Await** - Tanpa callback hell
- ✅ **JSDoc Lengkap** - Dokumentasi komprehensif pada setiap fungsi
- ✅ **Clean Code** - File rata-rata ~150 baris
- ✅ **Siap Production** - Error handling & logging terpusat

## 📁 Struktur Proyek

```bash
src/
├── config/                       # Konfigurasi aplikasi
│   ├── index.js                  # Load dari .vars.json
│   └── constants.js              # Konstanta aplikasi
│
├── database/                     # Database & queries
│   ├── connection.js             # Koneksi SQLite (promisified)
│   ├── schema.js                 # Skema database
│   └── queries/                  # Query modules
│       ├── accounts.js
│       ├── servers.js
│       ├── transactions.js
│       ├── users.js
│       └── ...
│
├── repositories/                 # Layer akses data (Repository Pattern)
│   ├── userRepository.js         # Operasi user (14 methods)
│   ├── serverRepository.js       # Operasi server (9 methods)
│   ├── accountRepository.js      # Operasi akun (6 methods)
│   ├── transactionRepository.js  # Transaksi & invoice (9 methods)
│   ├── resellerRepository.js     # Operasi reseller (10 methods)
│   ├── trialRepository.js        # Trial logs (5 methods)
│   ├── depositRepository.js      # Deposit QRIS (6 methods)
│   └── index.js                  # Barrel export
│
├── services/                     # Layer logika bisnis
│   ├── user.service.js           # User business logic
│   ├── reseller.service.js       # Reseller operations
│   ├── ssh.service.js            # SSH service operations
│   ├── depositService.js         # Deposit flow management
│   └── ...
│
├── handlers/                     # Bot command & action handlers
│   ├── commands/                 # Command handlers
│   │   ├── userCommands.js       # User commands (/start, /menu, dll)
│   │   ├── adminCommands.js      # Admin commands
│   │   ├── resellerCommands.js   # Reseller commands
│   │   ├── index.js
│   │   └── ...
│   ├── actions/                  # Callback query handlers
│   │   ├── serviceActions.js     # Service-related actions
│   │   ├── adminActions.js       # Admin actions
│   │   ├── resellerActions.js    # Reseller actions
│   │   ├── trialActions.js       # Trial account actions
│   │   ├── serverEditActions.js  # Server edit actions
│   │   ├── ...
│   │   └── index.js
│   ├── events/                   # Event handlers
│   │   ├── textHandler.js        # Text message routing
│   │   └── index.js
│   └── helpers/                  # Handler utilities
│       ├── callbackRouter.js     # Centralized callback routing
│       ├── menuHelper.js         # Menu builders
│       └── ...
│
├── modules/                      # Protocol modules
│   ├── protocols/                # Protocol handlers
│   │   ├── ssh/                  # SSH protocol
│   │   │   ├── createSSH.js
│   │   │   ├── renewSSH.js
│   │   │   ├── trialSSH.js
│   │   │   └── ...
│   │   ├── vmess/                # VMESS protocol
│   │   ├── vless/                # VLESS protocol
│   │   ├── trojan/               # TROJAN protocol
│   │   └── shadowsocks/          # SHADOWSOCKS protocol
│   ├── renew.js                  # Renewal logic
│   ├── stats.js                  # Statistics module
│   └── index.js
│
├── utils/                        # Utilitas & helpers
│   ├── helpers.js                # Utilities umum (flags, DNS, ISP, dll)
│   ├── formatter.js              # Format display (invoice, stats, dll)
│   ├── markdown.js               # Telegram markdown escape
│   ├── validation.js             # Input validation
│   ├── keyboard.js               # Inline keyboard builders
│   ├── logger.js                 # Winston logger
│   ├── serverEditHelpers.js      # Server editing utilities
│   └── ...
│
├── middleware/                   # Bot middleware
│   ├── auth.js                   # Authentication middleware
│   ├── errorHandler.js           # Error handling middleware
│   └── ...
│
├── infrastructure/               # Layer infrastruktur (opsional)
│   └── ...
│
└── app/                          # Application loaders
    └── ...

index.js                          # Entry point utama (239 baris)
botvpn.db                         # SQLite database
.vars.json                        # Environment configuration
```

## 🏛️ Penjelasan Arsitektur

### Infrastructure Layer (`src/infrastructure/`)

Layer terendah yang menangani koneksi ke sistem eksternal:

- **database.js** - Wrapper promisified untuk SQLite3 dengan helper methods (`dbGet`, `dbAll`, `dbRun`)
- **cache.js** - In-memory caching untuk status sistem dan user sessions

### Repository Layer (`src/repositories/`)

Abstraksi akses data dengan Repository Pattern - total 80+ methods:

- **userRepository** - 14 methods: CRUD users, balance, roles, statistics
- **serverRepository** - 9 methods: Manage servers, count accounts, IP/DNS lookup
- **accountRepository** - 6 methods: Active accounts management per protocol
- **transactionRepository** - 9 methods: Invoices, topup logs, transfers
- **resellerRepository** - 10 methods: Sales tracking, leaderboards, earnings
- **trialRepository** - 5 methods: Trial logs dan rate limiting
- **depositRepository** - 6 methods: Pending QRIS deposits management

**Contoh Penggunaan:**

```javascript
const { userRepository } = require('./src/repositories');

// Get user by Telegram ID
const user = await userRepository.getUserById(123456789);

// Update user balance
await userRepository.updateUserBalance(123456789, 50000, 'add');

// Get user statistics
const stats = await userRepository.getUserStats(123456789);
```

### Utils Layer (`src/utils/`)

Fungsi-fungsi utilitas yang dapat digunakan kembali:

- **helpers.js** - Flag emoji, DNS resolver, ISP lookup, reseller calculations
- **formatter.js** - Format invoice, server info, statistics untuk display
- **markdown.js** - Escape special characters untuk Telegram MarkdownV2
- **logger.js** - Winston logger dengan level & timestamps
- **keyboard.js** - Inline keyboard builders untuk Telegram
- **validation.js** - Input validation helpers

### Protocol Handlers (`src/modules/protocols/`)

Handlers khusus untuk setiap protokol VPN:

- Setiap protokol memiliki: `create`, `renew`, `trial`
- Komunikasi SSH ke VPN servers
- Parsing output & error handling

## 🚀 Fitur Utama

### Core Features

- 📊 **Dashboard** - Statistik sistem real-time dengan caching
- 🎫 **Trial Gratis** - Sistem trial otomatis dengan rate limiting  
- 💰 **Sistem Pembayaran** - Integrasi QRIS otomatis dengan tracking invoice
- 👥 **Reseller Program** - Sistem reseller 5-level dengan diskon bertingkat
- 🛠️ **Manajemen Server** - Multi-server management dengan load balancing
- 📱 **Multi-Protokol** - SSH, VMESS, VLESS, TROJAN, SHADOWSOCKS
- 💸 **Transfer Saldo** - P2P balance transfer dengan validasi
- 📈 **Statistik & Analytics** - Comprehensive sales & usage reports

### Technical Features

- 🔄 **Repository Pattern** - Clean data access abstraction dengan 80+ methods
- ⚡ **In-Memory Cache** - Fast system status & session management
- 📝 **Structured Logging** - Winston logger dengan level & timestamps
- 🛡️ **Error Handling** - Centralized error management
- 🔐 **Role-Based Access** - Admin, owner, reseller, user roles
- ⏰ **Scheduled Jobs** - Cron tasks untuk cleanup & notifications
- 🌐 **Webhook Ready** - Express server untuk payment callbacks

## 🔧 Fitur Lengkap

### Protokol yang Didukung

- ✅ **SSH** - Tunneling Secure Shell
- ✅ **VMESS** - Protokol V2Ray dengan WebSocket
- ✅ **VLESS** - Protokol V2Ray ringan
- ✅ **TROJAN** - Protokol Trojan-GFW
- ✅ **SHADOWSOCKS** - Proxy berkinerja tinggi

### Manajemen Akun

- ✅ **Buat Akun** - Pembuatan akun berbayar dengan berbagai durasi
- ✅ **Akun Trial** - Trial gratis 60 menit dengan pembatasan penggunaan
- ✅ **Perpanjang Akun** - Perpanjangan akun yang sudah ada
- ✅ **Cek Status** - Status dan masa aktif akun secara real-time
- ✅ **Hapus Akun** - Pembersihan manual dan otomatis

### Sistem Trial

- ✅ **Rate Limiting** - User: 1x/hari, Reseller: 10x/hari, Admin: tidak terbatas
- ✅ **Auto-Cleanup** - Penghapusan otomatis setelah 60 menit
- ✅ **History Tracking** - Pelacakan riwayat trial lengkap
- ✅ **Role-Based Access** - Kontrol akses berdasarkan peran

### Fitur Admin & Owner

- ✅ Manajemen Server
- ✅ Manajemen Pengguna
- ✅ Manajemen Saldo
- ✅ Statistik

## 💻 Contoh Penggunaan

### Impor Layanan

```javascript
const { UserService, TrialService, ServerService } = require('./services');
```

### Fitur untuk Admin & Owner

- ✅ **Manajemen Server** - Tambah/edit/hapus server VPN
- ✅ **Manajemen User** - Perbarui peran, saldo, suspend akun
- ✅ **Broadcast** - Kirim pesan ke semua pengguna
- ✅ **Statistik** - Lihat analitik seluruh sistem
- ✅ **Persetujuan Manual** - Verifikasi deposit yang tertunda

### Sistem Reseller

- ✅ **Sistem 5 Level** - Bronze, Silver, Gold, Platinum, Diamond
- ✅ **Diskon Otomatis** - 5% - 25% berdasarkan total penjualan
- ✅ **Pelacakan Penjualan** - Laporan penjualan & pendapatan real-time
- ✅ **Papan Peringkat** - Peringkat reseller terbaik mingguan
- ✅ **Transfer Saldo** - Transfer P2P antar pengguna

### Sistem Pembayaran

- ✅ **Integrasi QRIS** - Pembuatan kode QR pembayaran otomatis
- ✅ **Sistem Invoice** - Invoice dapat dilacak dengan ID unik
- ✅ **Topup Manual** - Admin dapat menambah saldo secara manual
- ✅ **Verifikasi Pembayaran** - Verifikasi otomatis & manual
- ✅ **Riwayat Transaksi** - Jejak audit lengkap

## 💻 Penggunaan API/Repository

### Contoh Menggunakan Repository Pattern

```javascript
// Import repositories
const { 
  userRepository, 
  serverRepository, 
  accountRepository 
} = require('./src/repositories');

// Get user information
const user = await userRepository.getUserById(telegramId);
console.log(`Balance: ${user.saldo}, Role: ${user.role}`);

// Update user balance
await userRepository.updateUserBalance(telegramId, 50000, 'add');

// Get all active servers
const servers = await serverRepository.getAllServers();

// Create active account entry
await accountRepository.upsertActiveAccount(
  telegramId, 
  'vmess', 
  'username123', 
  serverId, 
  30 // days
);
```

### Contoh Menggunakan Infrastructure Layer

```javascript
// Database operations
const { dbGet, dbAll, dbRun } = require('./src/infrastructure/database');

// Single row query
const user = await dbGet('SELECT * FROM users WHERE user_id = ?', [userId]);

// Multiple rows query  
const servers = await dbAll('SELECT * FROM servers WHERE status = ?', ['active']);

// Insert/Update/Delete
await dbRun('UPDATE users SET saldo = saldo + ? WHERE user_id = ?', [amount, userId]);
```

### Contoh Menggunakan Utilities

```javascript
const { helpers, formatter } = require('./src/utils');

// Get country flag emoji
const flag = helpers.getFlagEmoji('ID'); // 🇮🇩

// Resolve domain to IP
const ip = await helpers.resolveDomainToIP('example.com');

// Get ISP information
const isp = await helpers.getISPAndLocation(ip);

// Format invoice for display
const invoiceText = formatter.formatInvoice(invoiceData);

// Calculate reseller discount
const discount = helpers.getResellerDiscount(5000000); // returns 15% for 5M sales
```

## 🏗️ Pengembangan & Kontribusi

### Standar Gaya Kode

- **Penamaan**: camelCase untuk fungsi/variabel, PascalCase untuk kelas
- **File**: kebab-case (`user-service.js`) atau camelCase (`userService.js`)
- **Penanganan Error**: Selalu gunakan try-catch dengan logging terpusat
- **Dokumentasi**: Komentar JSDoc untuk semua method publik
- **Async/Await**: Gunakan async/await, hindari callback
- **Modular**: Satu file = satu tanggung jawab (Single Responsibility)

### Menambahkan Fitur Baru

1. **Tentukan Layer** - Repository untuk akses data, Service untuk logika bisnis
2. **Buat Repository Methods** - Jika memerlukan akses database baru
3. **Implementasi Logika** - Di service layer atau langsung di handler
4. **Perbarui Command** - Tambahkan command/action baru di `app.js`
5. **Pengujian** - Uji secara menyeluruh sebelum production

### Pengujian & Debugging

```bash
# Check syntax errors
node -c app.js

# Test specific module
node -e "require('./src/repositories/userRepository')"

# View logs
pm2 logs vpn-bot --lines 100

# Monitor performance
pm2 monit
```

## 📊 Statistik Refactoring

- **Kode Asli**: 6.057 baris (monolitik `app.js`)
- **Modul Baru**: 80+ method repository, 2 modul infrastruktur, 6 file utilitas
- **Pengurangan Kode**: ~60% lebih sedikit duplikasi
- **Kemudahan Pemeliharaan**: 10x lebih mudah dipelihara & dikembangkan
- **Cakupan Pengujian**: Siap untuk unit testing per modul

## 🔐 Konfigurasi Environment

Edit file `.vars.json`:

```json
{
  "BOT_TOKEN": "your_telegram_bot_token",
  "USER_ID": "your_telegram_user_id",
  "GROUP_ID": "your_telegram_group_id",
  "SSH_USER": "root",
  "SSH_PASS": "your_vps_password"
}
```

### Penjelasan Variabel

- `BOT_TOKEN` - Token bot dari [@BotFather](https://t.me/botfather)
- `USER_ID` - Telegram User ID Anda (owner/admin)
- `GROUP_ID` - Group ID untuk notifikasi (optional)
- `SSH_USER` - Username SSH untuk VPS servers
- `SSH_PASS` - Password SSH untuk VPS servers

## 🔄 Migrasi dari Versi Lama

Jika Anda melakukan upgrade dari versi monolitik:

1. **Database tetap kompatibel** - Tidak perlu migrasi skema
2. **app.js tetap berfungsi** - Kompatibilitas mundur 100%
3. **Gunakan repository** - Untuk kode baru gunakan pola repository
4. **Migrasi bertahap** - Pindahkan logika ke modul secara bertahap

## 📚 Dokumentasi Lanjutan

### Referensi Method Repository

Lihat file-file di `src/repositories/` untuk daftar lengkap method yang tersedia:

- `userRepository.js` - 14 method untuk manajemen pengguna
- `serverRepository.js` - 9 method untuk operasi server
- `accountRepository.js` - 6 method untuk pelacakan akun
- `transactionRepository.js` - 9 method untuk invoice & transaksi
- `resellerRepository.js` - 10 method untuk operasi reseller
- `trialRepository.js` - 5 method untuk manajemen trial
- `depositRepository.js` - 6 method untuk deposit QRIS

Setiap method memiliki dokumentasi JSDoc lengkap dengan contoh penggunaan.

## 🤝 Berkontribusi

Kontribusi sangat diterima! Silakan ikuti langkah berikut:

1. **Fork** repositori ini
2. **Clone** fork Anda: `git clone https://github.com/YOUR_USERNAME/bot-vpn.git`
3. **Buat branch**: `git checkout -b feature/nama-fitur-anda`
4. **Lakukan perubahan** dengan mengikuti panduan gaya kode
5. **Uji** perubahan Anda secara menyeluruh
6. **Commit**: `git commit -am 'Add: fitur baru xyz'`
7. **Push**: `git push origin feature/nama-fitur-anda`
8. **Pull Request** dengan deskripsi lengkap

### Panduan Kontribusi

- Ikuti gaya kode yang ada
- Tambahkan JSDoc untuk fungsi baru
- Gunakan async/await, bukan callback
- Uji sebelum mengirim PR
- Perbarui README jika diperlukan

## 🐛 Laporan Bug & Permintaan Fitur

- **Laporan Bug**: Buka issue dengan label `bug` dan berikan detail lengkap
- **Permintaan Fitur**: Buka issue dengan label `enhancement` dan jelaskan kasus penggunaan

## 👨‍💻 Penulis & Kredit

**Dikembangkan oleh**: [Alrescha79](https://github.com/alrescha79-cmd)

**Direfaktor ke Arsitektur Enterprise**: 2024

**Tech Stack**:

- Node.js v20+
- Telegraf (Telegram Bot Framework)
- SQLite3 (Database)
- Winston (Logging)
- Express (Webhooks)
- node-cron (Scheduled Tasks)

## 🙏 Dukungan & Ucapan Terima Kasih

Jika proyek ini membantu Anda:

- ⭐ **Beri bintang** repositori ini
- 🐛 **Laporkan bug** yang Anda temukan
- 💡 **Sarankan fitur** yang berguna
- 📖 **Tingkatkan dokumentasi**
- 🤝 **Kontribusi kode**

---
