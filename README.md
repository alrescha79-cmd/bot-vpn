# 🤖 Bot Telegram VPN V2

Bot Telegram untuk manajemen akun VPN dengan arsitektur modern, modular, dan mudah dipelihara.

## ✨ Yang Baru - Arsitektur Direfaktor

Bot ini telah direfaktor dengan standar tingkat enterprise:

- ✅ **Arsitektur Modular** - Pemisahan tanggung jawab
- ✅ **Lapisan Layanan** - Logika bisnis yang dapat digunakan ulang
- ✅ **Kode Bersih** - Mudah dibaca & dipelihara
- ✅ **Siap Type-Safe** - Siap migrasi ke TypeScript
- ✅ **Dapat Diuji** - Setiap modul dapat diuji secara independen
- ✅ **Ter Dokumentasi Baik** - Dokumentasi komprehensif

## 📁 Struktur Proyek

```bash
bot/
├── config/              # Manajemen konfigurasi
│   └── index.js         # Muat dari .vars.json
├── utils/               # Fungsi utilitas
│   ├── database.js      # SQLite yang dipromisifikasi
│   ├── logger.js        # Logger Winston
│   ├── ssh.js           # Utilitas koneksi SSH
│   └── helpers.js       # Pembantu umum
├── services/            # Lapisan logika bisnis
│   ├── vpn-account.service.js
│   ├── user.service.js
│   ├── trial.service.js
│   └── server.service.js
├── middleware/          # Middleware bot
│   └── auth.middleware.js
├── handlers/            # Penanganan perintah
│   └── trial.handler.js
└── app.js              # Aplikasi utama
```

## 🚀 Mulai Cepat

### Prasyarat

- Node.js v20+ (disarankan menggunakan NVM)
- NPM atau Yarn
- Akses SSH ke server VPN Anda
- PM2 (opsional, untuk manajemen proses)

### 1. Clone Repositori

```bash
git clone https://github.com/alrescha79-cmd/bot-vpn.git
```

```bash
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
# Dev
node app.js
```

```bash
# Prod (dengan PM2)
pm2 start app.js --name vpn-bot
pm2 save
pm2 startup
```

### 5. Menjadikan Telegram Anda sebagai Admin (Opsional)

```sql
sudo sqlite3 botvpn.db "UPDATE users SET role = 'admin' WHERE user_id = YOUR_TELEGRAM_ID;"
```

Ganti `YOUR_TELEGRAM_ID` dengan ID Telegram Anda.

### 6. Restart Bot Setelah Perubahan Konfigurasi

```bash
pm2 restart vpn-bot
```

```bash
# hentikan bot
pm2 stop vpn-bot

# hapus bot dari pm2
pm2 delete vpn-bot
```

Jika menjalankan dalam mode pengembangan, cukup hentikan proses `CTRL + C` dan jalankan kembali.

Catatan: Gunakan perintah `sudo` jika diperlukan.

## 🔧 Fitur

### Protokol yang Didukung

- ✅ SSH
- ✅ VMESS
- ✅ VLESS
- ✅ TROJAN
- ✅ SHADOWSOCKS

### Manajemen Akun

- ✅ Buat Akun (berbayar)
- ✅ Akun Trial (60 menit)
- ✅ Perpanjang Akun
- ✅ Periksa Akun
- ✅ Hapus Akun

### Sistem Trial

- ✅ Batas Harian (Pengguna: 1x, Reseller: 10x, Admin: ∞)
- ✅ Hapus otomatis setelah 60 menit
- ✅ Pelacakan riwayat trial
- ✅ Akses berbasis peran

### Fitur Admin

- ✅ Manajemen Server
- ✅ Manajemen Pengguna
- ✅ Manajemen Saldo
- ✅ Statistik

## 💻 Contoh Penggunaan

### Impor Layanan

```javascript
const { UserService, TrialService, ServerService } = require('./services');
```

### Operasi Database

```javascript
const db = require('./utils/database');
const user = await db.get('SELECT * FROM users WHERE user_id = ?', [userId]);
```

### Buat Akun VPN

```javascript
const { VPNAccountService } = require('./services');
const server = await ServerService.getServerById(1);
const result = await VPNAccountService.createAccount(
  server, 'vmess', 'user123', 'pass', 30, 100, 2
);
```

### Perintah Terlindungi

```javascript
const { isAdmin } = require('./middleware/auth.middleware');

bot.command('admin', isAdmin, async (ctx) => {
  await ctx.reply('Panel admin');
});
```

## 🏗️ Pengembangan

### Gaya Kode

- **Penamaan**: camelCase untuk fungsi, PascalCase untuk kelas
- **File**: kebab-case (misalnya, `user.service.js`)
- **Penanganan Error**: Selalu gunakan try-catch dengan logging
- **Dokumentasi**: Komentar JSDoc untuk metode publik

### Menambahkan Fitur Baru

1. Buat layanan jika diperlukan di `services/`
2. Buat penanganan di `handlers/`
3. Tambahkan middleware jika diperlukan
4. Daftarkan penanganan di `app.js`
5. Uji secara menyeluruh

### Pengujian

```bash
# Periksa sintaks
node -c app.js

# Uji modul spesifik
node -c services/user.service.js

# Periksa log
pm2 logs vpn-bot
```

## 📊 Statistik

- **Modul Baru**: 13 file
- **Baris Kode**: ~1,500 (lapisan direfaktor)
- **Pengurangan Kode**: ~60% lebih sedikit duplikasi
- **Dapat Dipelihara**: 10x lebih mudah

## 🔐 Variabel Lingkungan

Edit `.vars.json`:

```json
{
  "BOT_TOKEN": "token_bot_anda",
  "USER_ID": "id_telegram_anda",
  "GROUP_ID": "id_grup_anda",
  "SSH_USER": "root",
  "SSH_PASS": "password_vps_anda",
}
```

## 🤝 Berkontribusi

1. Fork repositori
2. Buat cabang fitur: `git checkout -b nama-fitur`
3. Komit perubahan: `git commit -am 'Tambah fitur'`
4. Push ke cabang: `git push origin nama-fitur`
5. Ajukan pull request

## 👨‍💻 Penulis

Dikembangkan oleh [Alrescha79](https://github.com/alrescha79-cmd)

## 🙏 Dukungan

Jika Anda merasa proyek ini membantu:

- ⭐ Beri bintang pada repositori
- 🐛 Laporkan bug
- 💡 Sarankan fitur
- 📖 Tingkatkan dokumentasi

---

Dibuat dengan ❤️ menggunakan praktik Node.js modern
