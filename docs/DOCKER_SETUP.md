# 🐳 Panduan Instalasi Docker di VPS (Production)

Panduan instalasi dan deployment **Bot Telegram VPN Multi-Protocol** menggunakan **Docker** dan **Docker Compose**.

---

## 📋 Keuntungan Menggunakan Docker

- ⚡ **Zero-Dependency Setup**: Tidak perlu install manual Node.js, PM2, TypeScript, SQLite compiler di VPS host.
- 🔒 **Isolasi Penuh & Keamanan**: Bot berjalan di container terisolasi dengan minimal footprint.
- 💾 **Persistensi Data Aman**: Database SQLite (`./data/botvpn.db`) dan backup berada di host volume.
- 🔄 **Auto-Restart & Healthcheck**: Docker otomatis restart bot jika crash dan memonitor status web server.

---

## 🚀 Langkah 1: Persiapan di VPS

### 1. Install Docker & Docker Compose di VPS

**Untuk Ubuntu / Debian:**
```bash
sudo apt update && sudo apt install -y curl git
curl -fsSL https://get.docker.com | sudo bash
sudo usermod -aG docker $USER
```

Verifikasi instalasi:
```bash
docker --version
docker compose version
```

---

## ⚙️ Langkah 2: Clone & Konfigurasi Bot

### 1. Clone Repository
```bash
git clone https://github.com/alrescha79-cmd/bot-vpn.git /opt/bot-vpn
cd /opt/bot-vpn
```

### 2. Isi Kunci Rahasia / Konfigurasi (.env)

Gunakan wizard interaktif terminal:
```bash
# Menggunakan Node.js wizard (jika ada Node)
node scripts/setup-config.js
```

Atau copy `.env.example` ke `.env` lalu edit dengan nano:
```bash
cp .env.example .env
nano .env
```

**Contoh isi `.env` minimal:**
```env
NODE_ENV=production
PORT=50123

# Telegram Token & Admin ID (Wajib)
BOT_TOKEN=1234567890:ABCdefGHIjklMNOpqrsTUVwxyz
USER_ID=123456789
ADMIN_USERNAME=MyTelegramUsername
NAMA_STORE=Super VPN Store

# Payment Gateway (Pilih salah satu atau isi yang digunakan)
TRIPAY_API_KEY=DEV-xxx
TRIPAY_PRIVATE_KEY=xxx
TRIPAY_MERCHANT_CODE=T12345
TRIPAY_ENV=production

# Atau Duitku:
# DUITKU_MERCHANT_CODE=D1234
# DUITKU_API_KEY=xxx

# Atau Pakasir:
# PAKASIR_PROJECT=my-slug
# PAKASIR_API_KEY=xxx
```

---

## 🏃 Langkah 3: Menjalankan Bot dengan Docker Compose

```bash
# Build dan jalankan di background (-d)
docker compose up -d --build
```

### Cek Status & Log Container
```bash
# Cek apakah container berjalan
docker compose ps

# Pantau log secara real-time
docker compose logs -f
```

---

## 🌐 Langkah 4: Webhook & Port Setup

Pastikan port `50123` terbuka di firewall VPS:
```bash
sudo ufw allow 50123/tcp
```

### URL Webhook untuk Payment Gateway:
Ganti `IP_VPS_ANDA` atau domain:
- **Tripay**: `http://IP_VPS_ANDA:50123/api/tripay/notification`
- **Duitku**: `http://IP_VPS_ANDA:50123/api/duitku/notification`
- **Pakasir**: `http://IP_VPS_ANDA:50123/api/pakasir/notification`
- **Midtrans**: `http://IP_VPS_ANDA:50123/api/midtrans/notification`

---

## 🛠️ Perintah Berguna / Maintenance

| Operasi | Perintah |
|---|---|
| **Restart Bot** | `docker compose restart` |
| **Stop Bot** | `docker compose down` |
| **Update & Rebuild** | `git pull && docker compose up -d --build` |
| **Lihat Log** | `docker compose logs -f bot-vpn` |
| **Set Admin Role di DB** | `sqlite3 data/botvpn.db "UPDATE users SET role = 'admin' WHERE user_id = 123456789;"` |
| **Backup Database** | `cp data/botvpn.db data/botvpn_backup.db` |
