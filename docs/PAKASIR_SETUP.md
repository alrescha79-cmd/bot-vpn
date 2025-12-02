# Pakasir Payment Gateway Integration

Dokumentasi ini menjelaskan cara mengintegrasikan Pakasir sebagai payment gateway untuk bot VPN Telegram.

## Overview

Pakasir adalah payment gateway Indonesia yang mendukung berbagai metode pembayaran:
- QRIS (GoPay, OVO, ShopeePay, Dana, dll)
- Virtual Account (BNI, BRI, Mandiri, dll)

## Konfigurasi

### 1. Buat Akun Pakasir

1. Daftar di [https://app.pakasir.com](https://app.pakasir.com)
2. Buat Proyek baru
3. Catat `Slug` dan `API Key` dari proyek Anda

### 2. Konfigurasi .vars.json

Tambahkan konfigurasi berikut ke file `.vars.json`:

```json
{
  "BOT_TOKEN": "your-bot-token",
  "USER_ID": 123456789,
  "GROUP_ID": "-1001234567890",
  "PORT": 50123,
  
  "PAKASIR_PROJECT": "your-project-slug",
  "PAKASIR_API_KEY": "your-api-key"
}
```

### 3. Setup Webhook

1. Login ke dashboard Pakasir
2. Edit proyek Anda
3. Set Webhook URL ke:
   ```
   http://YOUR_SERVER_IP:PORT/api/pakasir/notification
   ```

## Prioritas Payment Gateway

Bot akan memilih payment gateway dengan urutan prioritas:

1. **Midtrans** - Jika `MERCHANT_ID` dan `SERVER_KEY` dikonfigurasi
2. **Static QRIS** - Jika `DATA_QRIS` dikonfigurasi (tanpa Midtrans)
3. **Pakasir** - Jika `PAKASIR_PROJECT` dan `PAKASIR_API_KEY` dikonfigurasi

> **Note:** Pakasir akan digunakan sebagai fallback jika Midtrans dan Static QRIS tidak dikonfigurasi.

## Flow Pembayaran

### Deposit dengan Pakasir

1. User memilih menu **Top-up Saldo**
2. User memasukkan nominal deposit
3. Bot generate QRIS via Pakasir API
4. User melakukan pembayaran (scan QR)
5. Pakasir mengirim webhook notification
6. Bot memproses pembayaran dan update saldo user

### Status Pembayaran

Bot akan melakukan auto-check status pembayaran setiap 10 detik selama 30 menit. Alternatifnya, Pakasir akan mengirim webhook saat pembayaran berhasil.

## API Endpoints

### Webhook Endpoint

```
POST /api/pakasir/notification
```

Payload yang diterima dari Pakasir:

```json
{
  "amount": 22000,
  "order_id": "ORDER-1234567890-123456789",
  "project": "your-project-slug",
  "status": "completed",
  "payment_method": "qris",
  "completed_at": "2024-09-10T08:07:02.819+07:00"
}
```

## Metode Pembayaran yang Didukung

| Metode | Kode |
|--------|------|
| QRIS | `qris` |
| BNI Virtual Account | `bni_va` |
| BRI Virtual Account | `bri_va` |
| CIMB Niaga Virtual Account | `cimb_niaga_va` |
| Permata Virtual Account | `permata_va` |
| Maybank Virtual Account | `maybank_va` |
| Bank Sampoerna Virtual Account | `sampoerna_va` |
| BNC Virtual Account | `bnc_va` |
| ATM Bersama | `atm_bersama_va` |
| Artha Graha | `artha_graha_va` |

## Troubleshooting

### Webhook tidak diterima

1. Pastikan server dapat diakses dari internet
2. Pastikan port tidak diblokir firewall
3. Cek apakah Webhook URL sudah benar di dashboard Pakasir

### Payment tidak terverifikasi

1. Cek log untuk melihat error
2. Pastikan `PAKASIR_PROJECT` sesuai dengan slug proyek
3. Pastikan `PAKASIR_API_KEY` valid

### Mode Sandbox

Untuk testing, Pakasir menyediakan mode Sandbox. Gunakan API simulation untuk test webhook:

```bash
curl -X POST https://app.pakasir.com/api/paymentsimulation \
  -H "Content-Type: application/json" \
  -d '{
    "project": "your-project-slug",
    "order_id": "ORDER-123",
    "amount": 10000,
    "api_key": "your-api-key"
  }'
```

## Support

- Dokumentasi Pakasir: [https://app.pakasir.com/docs](https://app.pakasir.com/docs)
- GitHub Issues: [Repository Issues](https://github.com/alrescha79-cmd/bot-vpnv2/issues)
