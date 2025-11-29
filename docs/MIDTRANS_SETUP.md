# Midtrans QRIS Integration Setup

## 📋 Overview

Panduan lengkap integrasi Midtrans untuk pembayaran QRIS di Bot VPN. Midtrans adalah payment gateway terpercaya di Indonesia yang mendukung berbagai metode pembayaran termasuk QRIS.

## 🔧 Prerequisites

- Akun Midtrans (Sandbox atau Production)
- Node.js >= 18.x
- Bot VPN sudah terinstall

## 📝 Step 1: Daftar Akun Midtrans

### 1.1 Sandbox (Testing)

1. Buka https://dashboard.sandbox.midtrans.com/register
2. Isi form registrasi
3. Verifikasi email
4. Login ke dashboard

### 1.2 Production (Live)

1. Buka https://dashboard.midtrans.com/register
2. Isi form registrasi lengkap (KTP, NPWP, dll)
3. Tunggu approval dari Midtrans (1-3 hari kerja)
4. Login ke dashboard setelah approved

## 🔑 Step 2: Dapatkan API Credentials

### 2.1 Login ke Dashboard

**Sandbox:** https://dashboard.sandbox.midtrans.com/
**Production:** https://dashboard.midtrans.com/

### 2.2 Ambil Credentials

1. Login ke Midtrans Dashboard
2. Klik **Settings** → **Access Keys**
3. Anda akan melihat 3 keys:

#### Midtrans Access Keys:

| Key | Format | Kegunaan | Dibutuhkan Bot? |
|-----|--------|----------|----------------|
| **Merchant ID** | `G123456789` | Identifier merchant | ✅ Ya |
| **Client Key** | `SB-Mid-client-xxxxx` | Frontend integration | ❌ Tidak |
| **Server Key** | `SB-Mid-server-xxxxx` | Backend/Server API | ✅ Ya |

**Yang perlu dicopy:**
- ✅ **Merchant ID** (contoh: `G123456789`)
- ✅ **Server Key** (contoh: `SB-Mid-server-xxxxxxxxxxxxxxxxx`)
- ❌ Client Key (tidak digunakan untuk bot)

**Contoh:**
```
Sandbox:
  Merchant ID: G123456789
  Server Key: SB-Mid-server-abc123def456ghi789

Production:
  Merchant ID: G987654321  
  Server Key: Mid-server-xyz789uvw456rst123
```

## ⚙️ Step 3: Konfigurasi Bot

### 3.1 Edit `.vars.json`

Buka file `.vars.json` di root project:

```json
{
  "BOT_TOKEN": "your_telegram_bot_token",
  "USER_ID": "your_telegram_user_id",
  "GROUP_ID": "your_group_id",
  "NAMA_STORE": "Your Store Name",
  "PORT": 50123,
  "DATA_QRIS": "00020101021226660014ID.LINKAJA.WWW011893600915133...",
  "MERCHANT_ID": "G123456789",
  "SERVER_KEY": "SB-Mid-server-xxxxxxxxxxxxxxxxx",
  "ADMIN_USERNAME": "admin"
}
```

**Penjelasan:**
- `MERCHANT_ID`: Isi dengan **Merchant ID** dari Midtrans (contoh: `G123456789`)
- `SERVER_KEY`: Isi dengan **Server Key** dari Midtrans (contoh: `SB-Mid-server-xxxxx`)
- `DATA_QRIS`: Static QRIS sebagai fallback (optional)

**📝 Catatan Penting:**
- Untuk **Sandbox**: Gunakan credentials dari dashboard sandbox
- Untuk **Production**: Gunakan credentials dari dashboard production
- Jangan share Server Key di public repository!

### 3.2 Set Environment Variable

Tambahkan environment untuk mode Midtrans:

**Untuk Sandbox (Testing):**
```bash
export MIDTRANS_ENV=sandbox
```

**Untuk Production (Live):**
```bash
export MIDTRANS_ENV=production
```

Atau tambahkan ke file `.env`:
```env
MIDTRANS_ENV=sandbox
```

### 3.3 Permanent Setup (PM2)

Edit `ecosystem.config.js`:

```javascript
module.exports = {
  apps: [{
    name: 'bot-vpn',
    script: './index.js',
    env: {
      NODE_ENV: 'production',
      MIDTRANS_ENV: 'sandbox'  // or 'production'
    }
  }]
}
```

## 🧪 Step 4: Testing di Sandbox

### 4.1 Restart Bot

```bash
pm2 restart bot-vpn
pm2 logs bot-vpn --lines 50
```

### 4.2 Test Flow

1. Buka bot di Telegram
2. Klik **💳 Top Up**
3. Pilih nominal (misal **10K**)
4. Klik **✅ Konfirmasi**
5. QR Code akan muncul

### 4.3 Test Payment (Sandbox)

Midtrans Sandbox menyediakan test payment simulator:

**Metode 1: Manual Payment (Simulator)**

1. Copy order ID dari bot (contoh: `ORDER-1732445678123-647143027`)
2. Buka: https://simulator.sandbox.midtrans.com/gopay/partner/app/payment-pin
3. Paste order ID
4. Klik "Pay" untuk simulasi pembayaran sukses

**Metode 2: Gopay Simulator**

Midtrans Sandbox menggunakan Gopay simulator:
- Deeplink akan membuka simulator
- Payment otomatis sukses di sandbox

**Metode 3: Auto-Success**

Di sandbox, beberapa payment auto-success setelah QR generated.

### 4.4 Verifikasi

1. Tunggu 10-20 detik
2. Saldo akan otomatis bertambah
3. Notifikasi muncul: "🎉 Deposit Berhasil!"
4. Cek database:
   ```bash
   sqlite3 data/botvpn.db "SELECT * FROM pending_deposits ORDER BY timestamp DESC LIMIT 5"
   ```

## 🚀 Step 5: Go Production

### 5.1 Persiapan

1. **Lengkapi Dokumen Bisnis** di Midtrans Dashboard:
   - KTP
   - NPWP
   - Dokumen usaha (SIUP/NIB)
   - Website/Platform URL

2. **Tunggu Approval** (1-3 hari kerja)

3. **Dapatkan Production Server Key**

### 5.2 Update Konfigurasi

Edit `.vars.json`:
```json
{
  "SERVER_KEY": "Mid-server-xxxxxxxxxxxxxxxxx"
}
```

Set environment:
```bash
export MIDTRANS_ENV=production
```

### 5.3 Deploy

```bash
# Update config
pm2 restart bot-vpn

# Monitor logs
pm2 logs bot-vpn
```

### 5.4 First Transaction Test

1. Test dengan nominal kecil (10.000)
2. Scan QR dengan aplikasi yang support QRIS (Gopay, OVO, Dana, dll)
3. Verify pembayaran
4. Cek saldo masuk

## 🔔 Step 6: Setup Webhook (Optional)

Webhook membuat verifikasi pembayaran lebih cepat (instant) dibanding polling.

### 6.1 Create Webhook Endpoint

File: `src/api/midtrans.webhook.ts` (sudah akan saya buat)

### 6.2 Setup di Midtrans Dashboard

1. Login ke Midtrans Dashboard
2. **Settings** → **Configuration**
3. **Payment Notification URL**: `https://your-domain.com/api/midtrans/notification`
4. **Recurring Notification URL**: Same as above
5. Klik **Save**

### 6.3 Configure Nginx (jika pakai)

```nginx
server {
    listen 80;
    server_name your-domain.com;

    location /api/midtrans/ {
        proxy_pass http://localhost:50123/api/midtrans/;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }
}
```

## 📊 Monitoring & Logs

### Check Transactions

**Via Dashboard:**
https://dashboard.midtrans.com/transactions

**Via Database:**
```bash
sqlite3 data/botvpn.db "SELECT * FROM pending_deposits WHERE status='paid' ORDER BY timestamp DESC"
```

**Via Logs:**
```bash
pm2 logs bot-vpn | grep -i "payment\|midtrans"
```

## 🐛 Troubleshooting

### Error: "Access denied due to unauthorized transaction"

**Penyebab:** Server Key salah atau tidak valid

**Solusi:**
1. Cek Server Key di dashboard
2. Pastikan menggunakan Server Key (bukan Client Key)
3. Pastikan environment (sandbox/production) sesuai

### Error: "Transaction not found"

**Penyebab:** Order ID tidak ditemukan di Midtrans

**Solusi:**
1. Cek log untuk melihat response dari Midtrans
2. Pastikan order berhasil dibuat
3. Cek di dashboard Midtrans → Transactions

### QR Code tidak muncul

**Penyebab:** API call gagal

**Solusi:**
```bash
# Cek log detail
pm2 logs bot-vpn --lines 100 | grep -i error

# Test API manual
curl -X POST https://api.sandbox.midtrans.com/v2/charge \
  -H "Authorization: Basic $(echo -n 'YOUR_SERVER_KEY:' | base64)" \
  -H "Content-Type: application/json" \
  -d '{
    "payment_type": "gopay",
    "transaction_details": {
      "order_id": "TEST-001",
      "gross_amount": 10000
    }
  }'
```

### Payment stuck di "pending"

**Penyebab:** 
- Auto-verification belum jalan
- Payment belum selesai di Midtrans

**Solusi:**
1. Klik tombol "🔄 Cek Status" di bot
2. Cek status di Midtrans Dashboard
3. Cek log: `pm2 logs bot-vpn`

### Saldo tidak bertambah meski sudah bayar

**Penyebab:** Database update gagal

**Solusi:**
```bash
# Cek pending deposits
sqlite3 data/botvpn.db "SELECT * FROM pending_deposits WHERE status='pending'"

# Manual update (jika perlu)
sqlite3 data/botvpn.db "UPDATE users SET saldo = saldo + 10000 WHERE user_id = 'USER_ID'"
```

## 💰 Biaya & Fee

### Midtrans Fee

- **QRIS:** 0.7% per transaksi
- **Minimal Fee:** Rp 100
- **Settlement:** T+1 (next business day)

### Contoh Perhitungan

```
User top up: Rp 100.000
Fee Midtrans: Rp 700 (0.7%)
Yang diterima: Rp 99.300

Tapi user tetap dapat Rp 100.000 di bot
(Fee ditanggung owner)
```

**Tips:** Tambahkan biaya admin ke nominal top up jika mau fee ditanggung user.

## 📱 Supported Payment Methods

Midtrans QRIS support semua aplikasi yang support QRIS:

✅ Gopay
✅ OVO  
✅ Dana
✅ LinkAja
✅ ShopeePay
✅ Bank Mobile Apps (BCA, Mandiri, BRI, BNI, dll)

## 🔒 Security Best Practices

1. **Jangan commit Server Key** ke git
2. **Gunakan environment variable** untuk sensitive data
3. **Enable webhook** untuk instant verification
4. **Validate signature** di webhook (saya sudah implementasi)
5. **Log semua transaksi** untuk audit
6. **Backup database** secara berkala

## 📚 Resources

- **Midtrans Dashboard:** https://dashboard.midtrans.com
- **API Documentation:** https://api-docs.midtrans.com
- **Postman Collection:** https://docs.midtrans.com/#api-docs
- **Support:** support@midtrans.com
- **Status Page:** https://status.midtrans.com

## 🆘 Support

Jika ada masalah:

1. **Cek dokumentasi:** https://docs.midtrans.com
2. **Cek logs:** `pm2 logs bot-vpn`
3. **Cek dashboard:** https://dashboard.midtrans.com/transactions
4. **Contact Midtrans:** support@midtrans.com (response time: 1-2 hari)

---

**Last Updated:** November 24, 2025
**Version:** 3.0
**Author:** Bot VPN Team
