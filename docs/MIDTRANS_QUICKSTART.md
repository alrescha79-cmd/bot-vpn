# Quick Start - Midtrans Integration

## 🚀 Setup dalam 5 Menit

### 1. Daftar Midtrans Sandbox

```
https://dashboard.sandbox.midtrans.com/register
```

### 2. Ambil Credentials

1. Login → Settings → Access Keys
2. Copy 2 keys:
   - **Merchant ID**: `G123456789`
   - **Server Key**: `SB-Mid-server-xxxxx`

### 3. Edit Konfigurasi

```bash
nano .vars.json
```

```json
{
  "BOT_TOKEN": "your_bot_token",
  "USER_ID": "your_user_id",
  "MERCHANT_ID": "G123456789",
  "SERVER_KEY": "SB-Mid-server-xxxxx"
}
```

### 4. Set Environment

```bash
export MIDTRANS_ENV=sandbox
```

Atau tambah ke `ecosystem.config.js`:

```javascript
module.exports = {
  apps: [{
    name: 'bot-vpn',
    script: './index.js',
    env: {
      MIDTRANS_ENV: 'sandbox'
    }
  }]
}
```

### 5. Restart Bot

```bash
pm2 restart bot-vpn
pm2 logs bot-vpn
```

### 6. Test!

1. Buka bot di Telegram
2. Klik **💳 Top Up**
3. Pilih **10K**
4. Klik **✅ Konfirmasi**
5. QR Code muncul!

### 7. Simulasi Pembayaran (Sandbox)

**Metode 1: Simulator**
```
https://simulator.sandbox.midtrans.com/gopay/partner/app/payment-pin
```
Paste Order ID → Klik Pay

**Metode 2: Auto Success**
Di sandbox, payment biasanya auto-success setelah QR generated.

### 8. Verifikasi

- Tunggu 10-20 detik
- Saldo bertambah otomatis
- Notifikasi muncul ✅

## ✅ Selesai!

Bot sudah terintegrasi dengan Midtrans!

## 📖 Dokumentasi Lengkap

Baca: `docs/MIDTRANS_SETUP.md`

## 🐛 Troubleshooting

**QR tidak muncul?**
```bash
pm2 logs bot-vpn | grep -i error
```

**Payment tidak terdeteksi?**
- Klik tombol "🔄 Cek Status" di bot
- Tunggu 10 detik lagi

**Masih error?**
```bash
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

## 🚀 Production

Setelah testing OK:

1. Lengkapi dokumen di Midtrans
2. Tunggu approval
3. Ambil Production Server Key
4. Update `.vars.json`
5. Set `MIDTRANS_ENV=production`
6. Restart bot

Done! 🎉
