# QRIS Payment Integration

## Overview

Bot VPN sekarang sudah terintegrasi penuh dengan sistem pembayaran QRIS. User dapat melakukan top-up saldo secara otomatis melalui QRIS dan saldo akan langsung masuk setelah pembayaran terverifikasi.

## Features

✅ **Generate QRIS** - Otomatis generate QR code untuk setiap transaksi
✅ **Auto-Verification** - Pembayaran otomatis terverifikasi setiap 10 detik
✅ **Auto-Credit** - Saldo otomatis masuk setelah pembayaran sukses
✅ **Expiry Management** - QR code expire otomatis setelah 30 menit
✅ **Payment Tracking** - Tracking status pembayaran realtime
✅ **Database Recording** - Semua transaksi tersimpan di database

## Configuration

### 1. Setup QRIS Credentials

Edit file `.vars.json` dan tambahkan konfigurasi QRIS:

```json
{
  "BOT_TOKEN": "your_bot_token",
  "USER_ID": "your_user_id",
  "GROUP_ID": "your_group_id",
  "NAMA_STORE": "Your Store Name",
  "PORT": 50123,
  "DATA_QRIS": "your_static_qris_string",
  "MERCHANT_ID": "your_merchant_id",
  "API_KEY": "your_api_key",
  "ADMIN_USERNAME": "admin"
}
```

### 2. QRIS Provider Settings

File: `src/services/qris.service.ts`

**Penting:** Sesuaikan endpoint API dengan provider QRIS Anda:

```typescript
// Line 50-55: Generate QRIS endpoint
const response = await axios.post(
  'https://api.qris-payment.com/v1/generate', // ⚠️ Ganti dengan endpoint provider Anda
  {
    merchant_id: config.MERCHANT_ID,
    amount: amount,
    invoice_id: invoiceId,
    customer_id: userId,
    expired_minutes: 30,
    callback_url: `${config.PORT}/api/qris/callback`
  },
  {
    headers: {
      'Authorization': `Bearer ${config.API_KEY}`,
      'Content-Type': 'application/json'
    }
  }
);

// Line 110-115: Check payment status endpoint
const response = await axios.get(
  `https://api.qris-payment.com/v1/status/${invoiceId}`, // ⚠️ Ganti dengan endpoint provider Anda
  {
    headers: {
      'Authorization': `Bearer ${config.API_KEY}`,
      'Content-Type': 'application/json'
    }
  }
);
```

### 3. Supported QRIS Providers

Anda dapat menggunakan provider QRIS mana saja yang mendukung API, contoh:

- **Xendit** - https://xendit.co
- **Midtrans** - https://midtrans.com
- **Moota** - https://moota.co
- **Duitku** - https://duitku.com
- **Custom Provider** - Provider lainnya dengan REST API

## How It Works

### Flow Diagram

```
User Click Top Up
       ↓
Select Amount (10K, 20K, 50K, dst)
       ↓
Confirm Amount
       ↓
Generate QRIS Code ← API Call to Provider
       ↓
Display QR Code with Payment Info
       ↓
Auto-Check Status Every 10s ← API Call to Check Payment
       ↓
Payment Detected (PAID)
       ↓
Update Database (pending_deposits → status: paid)
       ↓
Credit User Saldo
       ↓
Notify User ✅
       ↓
Notify Admin (if GROUP_ID configured)
```

### Database Schema

**Table: `pending_deposits`**

```sql
CREATE TABLE pending_deposits (
  unique_code TEXT PRIMARY KEY,      -- Invoice ID
  user_id INTEGER,                   -- Telegram User ID
  amount INTEGER,                    -- Deposit amount
  original_amount INTEGER,           -- Original amount (before fees)
  timestamp INTEGER,                 -- Unix timestamp
  status TEXT,                       -- pending|paid|expired|cancelled
  qr_message_id INTEGER              -- Telegram message ID of QR code
);
```

## User Flow

### 1. Pilih Nominal

User klik menu **💳 Top Up** dan memilih nominal:
- 10K (Rp 10.000)
- 20K (Rp 20.000)
- 50K (Rp 50.000)
- 100K (Rp 100.000)
- 200K (Rp 200.000)
- 500K (Rp 500.000)
- ✏️ Input Manual

### 2. Konfirmasi

Bot menampilkan konfirmasi:
```
💰 Konfirmasi Top Up

Jumlah: Rp 200.000

Silakan konfirmasi jumlah top up Anda.

[✅ Konfirmasi] [❌ Batal]
```

### 3. Generate QR

Setelah konfirmasi, bot generate QRIS:
```
⏳ Generating QRIS code...
```

### 4. Display QR Code

Bot menampilkan QR code dengan info:
```
💳 QRIS Payment - Deposit

💰 Amount: Rp 200.000
🆔 Invoice: DEP1732445678123456789
⏰ Expired: 24/11/2025, 14:30

📱 Scan QR code untuk melakukan pembayaran
✅ Pembayaran akan otomatis terverifikasi
⚠️ QR Code valid selama 30 menit

Status: Menunggu pembayaran...

[🔄 Cek Status] [❌ Batalkan] [🔙 Menu Utama]
```

### 5. Auto-Verification

Bot mengecek status pembayaran otomatis setiap 10 detik selama 30 menit.

### 6. Payment Success

Ketika pembayaran berhasil:
```
✅ PEMBAYARAN BERHASIL!

💰 Amount: Rp 200.000
🆔 Invoice: DEP1732445678123456789
✅ Status: Paid
💳 Saldo Baru: Rp 450.000

Terima kasih! Saldo Anda telah ditambahkan.

[💰 Cek Saldo] [🔙 Menu Utama]
```

Dan notifikasi terpisah:
```
🎉 Deposit Berhasil!

💰 Saldo Anda telah ditambah Rp 200.000
💳 Saldo sekarang: Rp 450.000
```

## Manual Check

User dapat mengklik tombol **🔄 Cek Status** untuk manual check pembayaran kapan saja.

## Cancel Payment

User dapat membatalkan deposit dengan klik **❌ Batalkan**. Status akan berubah menjadi `cancelled`.

## Admin Notification

Jika `GROUP_ID` dikonfigurasi, admin akan menerima notifikasi:

```
💰 Deposit Notification

👤 User: 647143027
💵 Amount: Rp 200.000
🆔 Invoice: DEP1732445678123456789
✅ Status: Success
```

## Fallback Mode

Jika API provider gagal atau tidak tersedia, bot akan menggunakan **Static QRIS** dari `DATA_QRIS` sebagai fallback:

- QR code menggunakan nilai static dari config
- Verifikasi pembayaran tetap berjalan (jika API available)
- User harus manual confirm atau admin approve

## Testing

### Test Flow

1. Klik **💳 Top Up**
2. Pilih nominal test (misal 10K)
3. Konfirmasi
4. Lihat QR code muncul
5. Lakukan pembayaran via QRIS
6. Tunggu auto-verification (max 30 menit)
7. Cek saldo bertambah

### Manual Test Payment Status

```bash
# Via terminal/API testing tool
curl -X GET \
  'https://api.qris-payment.com/v1/status/DEP1732445678123456789' \
  -H 'Authorization: Bearer YOUR_API_KEY'
```

## Troubleshooting

### QR Code tidak muncul

**Penyebab:**
- API_KEY tidak valid
- MERCHANT_ID salah
- Endpoint API salah
- Network timeout

**Solusi:**
- Cek kredensial di `.vars.json`
- Cek endpoint di `qris.service.ts`
- Cek log error di terminal: `pm2 logs bot-vpn`

### Payment tidak terdeteksi

**Penyebab:**
- Auto-check belum berjalan
- API status check error
- Invoice ID tidak match

**Solusi:**
- Klik **🔄 Cek Status** manual
- Cek log: `pm2 logs bot-vpn`
- Verifikasi invoice ID di database:
  ```bash
  sqlite3 data/botvpn.db "SELECT * FROM pending_deposits WHERE status='pending'"
  ```

### Saldo tidak bertambah

**Penyebab:**
- Database update gagal
- User tidak ditemukan
- Transaction rollback

**Solusi:**
- Cek log error
- Manual update saldo via admin command
- Restore dari backup jika perlu

## Security Notes

⚠️ **Penting:**

1. **Jangan share API_KEY** di public repo
2. **Gunakan HTTPS** untuk production
3. **Validate payment** di server side
4. **Log all transactions** untuk audit
5. **Backup database** secara regular

## Future Improvements

- [ ] Webhook callback untuk instant verification
- [ ] Multiple payment methods (VA, E-Wallet)
- [ ] Payment receipt/invoice PDF
- [ ] Refund mechanism
- [ ] Payment analytics dashboard
- [ ] Scheduled payment (recurring)

## Support

Jika ada masalah dengan integrasi QRIS, silakan:

1. Cek dokumentasi provider QRIS Anda
2. Cek log bot: `pm2 logs bot-vpn`
3. Lihat troubleshooting guide
4. Contact developer

---

**Last Updated:** November 24, 2025
