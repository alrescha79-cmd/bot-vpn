# 🐳 Panduan Lengkap Instalasi & Deployment Docker di VPS (Production)

Panduan komprehensif instalasi **Bot Telegram VPN Multi-Protocol** menggunakan **Docker Image Resmi** dari GitHub Container Registry (`ghcr.io/alrescha79-cmd/bot-vpn:latest`).

---

## ⚡ Mengapa Docker Sangat Direkomendasikan?

1. **Zero Setup Host**: Tidak perlu install manual Node.js, PM2, TypeScript compiler, Python, Make, atau GCC di VPS host.
2. **Instant Deploy**: Menjalankan image pre-built hasil CI/CD otomatis hanya butuh hitungan detik.
3. **Database Persisten**: Data SQLite (`data/botvpn.db`) tersimpan aman di host volume, tidak hilang saat container restart atau update.
4. **Isolasi & Keamanan**: Proses bot terisolasi dalam container sandbox dengan resource limit 512MB RAM.
5. **Auto-Heal & Auto-Restart**: Docker otomatis me-restart bot saat crash atau server reboot.

---

## 🛠️ Langkah 1: Cek Versi & Install Docker di VPS

### 1. Cek Apakah Docker Sudah Terinstall di VPS
Buka terminal VPS dan jalankan:
```bash
docker --version
docker compose version
```

- Jika muncul output seperti `Docker version 24.x.x` atau `26.x.x` dan `Docker Compose version v2.x.x`, lewati langkah instalasi Docker dan lanjut ke **Langkah 2**.
- Jika muncul `command not found`, lakukan instalasi berikut:

### 2. Install Docker Resmi (Ubuntu / Debian / CentOS / AlmaLinux)

```bash
# 1. Update paket & install curl
sudo apt update && sudo apt install -y curl

# 2. Install Docker Engine & Docker Compose via script resmi
curl -fsSL https://get.docker.com | sudo bash

# 3. Beri permission user aktif ke group docker (agar bisa run docker tanpa sudo)
sudo usermod -aG docker $USER

# 4. Aktifkan & start service docker
sudo systemctl enable docker
sudo systemctl start docker
```

Verifikasi kembali:
```bash
docker --version
docker compose version
```

---

## 🚀 Langkah 2: Deploy Cepat Menggunakan Image Pre-Built (Metode Paling Cepat)

Anda **tidak perlu clone seluruh source code** jika menggunakan image pre-built. Cukup siapkan 1 folder di VPS:

### 1. Buat Direktori Kerja
```bash
mkdir -p /opt/bot-vpn && cd /opt/bot-vpn
```

### 2. Buat File `docker-compose.yml`
```bash
nano docker-compose.yml
```
Paste konfigurasi berikut:

```yaml
version: '3.8'

services:
  bot-vpn:
    image: ghcr.io/alrescha79-cmd/bot-vpn:latest
    container_name: bot-vpn
    restart: unless-stopped
    ports:
      - "50123:50123"
    env_file:
      - .env
    volumes:
      - ./data:/app/data
    logging:
      driver: "json-file"
      options:
        max-size: "10m"
        max-file: "3"
    deploy:
      resources:
        limits:
          memory: 512M
```

### 3. Buat File Kunci Rahasia `.env`
```bash
nano .env
```
Isi konfigurasi Anda:

```env
NODE_ENV=production
PORT=50123

# --- Telegram Bot & Admin (Wajib) ---
BOT_TOKEN=1234567890:ABCdefGHIjklMNOpqrsTUVwxyz
USER_ID=123456789
ADMIN_USERNAME=AdminVPN
GROUP_ID=-1001234567890
NAMA_STORE=Super VPN Store

# --- Database Directory ---
DB_DIR=/app/data
DB_PATH=/app/data/botvpn.db

# ==============================================================================
# PAYMENT GATEWAY (Isi gateway yang Anda gunakan, biarkan kosong jika tidak dipakai)
# ==============================================================================

# 1. TRIPAY (https://tripay.co.id)
TRIPAY_API_KEY=
TRIPAY_PRIVATE_KEY=
TRIPAY_MERCHANT_CODE=
TRIPAY_ENV=production

# 2. DUITKU (https://duitku.com)
DUITKU_MERCHANT_CODE=
DUITKU_API_KEY=
DUITKU_ENV=production

# 3. PAKASIR (https://pakasir.com)
PAKASIR_PROJECT=
PAKASIR_API_KEY=

# 4. MIDTRANS (https://midtrans.com)
MERCHANT_ID=
SERVER_KEY=
MIDTRANS_ENV=production

# 5. STATIC / DYNAMIC QRIS (Dana Bisnis, BCA, Gopay, ShopeePay String)
DATA_QRIS=
```

---

## 🏃 Langkah 3: Menjalankan Bot

Jalankan perintah berikut untuk mengunduh image dan menyalakan container:

```bash
docker compose pull
docker compose up -d
```

### Cek Status & Log Container
```bash
# Cek status running container
docker compose ps

# Pantau live logs
docker compose logs -f
```

---

## 🌐 Langkah 4: Buka Port & Atur Webhook di Provider

Pastikan firewall VPS mengizinkan port `50123`:
```bash
sudo ufw allow 50123/tcp
```

### Daftarkan URL Webhook ke Dashboard Payment Gateway Anda:
Ganti `IP_VPS_ANDA` dengan IP Publik VPS Anda (atau domain Anda jika menggunakan reverse proxy/Cloudflare):

| Gateway | URL Callback / Webhook |
|---|---|
| **Tripay** | `http://IP_VPS_ANDA:50123/api/tripay/notification` |
| **Duitku** | `http://IP_VPS_ANDA:50123/api/duitku/notification` |
| **Pakasir** | `http://IP_VPS_ANDA:50123/api/pakasir/notification` |
| **Midtrans** | `http://IP_VPS_ANDA:50123/api/midtrans/notification` |

---

## 🔄 Langkah 5: Cara Update Bot ke Versi Terbaru

Setiap ada update atau rilis baru di GitHub, Anda cukup menjalankan 2 perintah:

```bash
cd /opt/bot-vpn
docker compose pull
docker compose up -d
```
> *Database SQLite di `./data` tetap aman dan tidak akan terhapus atau ter-reset.*

---

## 🛠️ Perintah Berguna (Cheat Sheet)

| Kebutuhan | Perintah |
|---|---|
| **Cek Live Logs** | `docker compose logs -f` |
| **Restart Bot** | `docker compose restart` |
| **Stop Bot** | `docker compose down` |
| **Update Image Terbaru** | `docker compose pull && docker compose up -d` |
| **Set Admin Role di DB SQLite** | `sqlite3 data/botvpn.db "UPDATE users SET role = 'admin' WHERE user_id = 123456789;"` |
| **Backup Database Manual** | `cp data/botvpn.db data/botvpn_backup_$(date +%F).db` |
| **Masuk ke Terminal Container** | `docker compose exec bot-vpn sh` |
