# Midtrans Access Keys Explained

## 📋 Overview

Midtrans menyediakan 3 jenis keys untuk integrasi payment. Dokumen ini menjelaskan masing-masing key dan penggunaannya.

## 🔑 Tiga Keys Midtrans

### 1. Merchant ID

**Format:**
```
Sandbox: G123456789
Production: G987654321
```

**Kegunaan:**
- Identifier unik untuk merchant/toko Anda
- Digunakan untuk identifikasi transaksi
- Diperlukan untuk beberapa API calls

**Digunakan di Bot?**
✅ **YA** - Disimpan di `.vars.json` sebagai `MERCHANT_ID`

**Lokasi:**
Dashboard → Settings → Access Keys

---

### 2. Client Key

**Format:**
```
Sandbox: SB-Mid-client-xxxxxxxxxxxxx
Production: Mid-client-xxxxxxxxxxxxx
```

**Kegunaan:**
- Digunakan untuk **frontend integration** (website, mobile app)
- Untuk Snap.js, Mobile SDK
- Eksekusi di client-side (browser, app)

**Digunakan di Bot?**
❌ **TIDAK** - Bot adalah backend/server application, tidak perlu Client Key

**Contoh Penggunaan (Frontend):**
```javascript
// Example: Website payment page
snap.pay('SNAP_TOKEN', {
  clientKey: 'SB-Mid-client-xxxxx'
});
```

---

### 3. Server Key

**Format:**
```
Sandbox: SB-Mid-server-xxxxxxxxxxxxx
Production: Mid-server-xxxxxxxxxxxxx
```

**Kegunaan:**
- Digunakan untuk **backend/server integration**
- API calls dari server
- Generate payment, check status, dll
- **WAJIB dijaga kerahasiaannya** (jangan expose ke client)

**Digunakan di Bot?**
✅ **YA** - Disimpan di `.vars.json` sebagai `API_KEY`

**Keamanan:**
- ⚠️ **SANGAT RAHASIA** - Jangan commit ke git
- ⚠️ Jangan kirim ke client
- ⚠️ Jangan share di public

---

## 📝 Mapping ke Bot VPN

| Midtrans Key | Bot Config | File | Digunakan? |
|--------------|------------|------|------------|
| **Merchant ID** | `MERCHANT_ID` | `.vars.json` | ✅ Ya |
| **Client Key** | - | - | ❌ Tidak |
| **Server Key** | `API_KEY` | `.vars.json` | ✅ Ya |

## ⚙️ Konfigurasi `.vars.json`

```json
{
  "BOT_TOKEN": "71237271378271238.....",
  "USER_ID": "67566....",
  "GROUP_ID": "-1001....",
  "NAMA_STORE": "VPN Store",
  "PORT": 50123,
  "DATA_QRIS": "00020101...",
  "MERCHANT_ID": "G123456789",
  "API_KEY": "SB-Mid-server-xxxxxxxxxxxxx",
  "ADMIN_USERNAME": "admin"
}
```

**Penjelasan:**
- `MERCHANT_ID` = **Merchant ID** dari Midtrans
- `API_KEY` = **Server Key** dari Midtrans
- Client Key **TIDAK** digunakan

## 🔍 Cara Ambil Keys

### Step 1: Login Dashboard

**Sandbox:**
```
https://dashboard.sandbox.midtrans.com/
```

**Production:**
```
https://dashboard.midtrans.com/
```

### Step 2: Navigate

1. Klik **Settings** di sidebar
2. Klik **Access Keys**

### Step 3: Copy Keys

Anda akan melihat 3 keys:

```
┌─────────────────────────────────────────────┐
│  Midtrans Access Keys                       │
├─────────────────────────────────────────────┤
│                                             │
│  Merchant ID:   G123456789                  │  ← Copy ini
│                                             │
│  Client Key:    SB-Mid-client-abc123def456  │  ← Tidak perlu
│                                             │
│  Server Key:    SB-Mid-server-xyz789uvw456  │  ← Copy ini
│                                             │
└─────────────────────────────────────────────┘
```

**Yang perlu dicopy:**
1. ✅ Merchant ID
2. ✅ Server Key
3. ❌ Client Key (skip)

## 🎯 Use Cases

### Backend/Server (Bot VPN)

```typescript
// Generate payment - NEEDS SERVER KEY
const auth = Buffer.from(SERVER_KEY + ':').toString('base64');
axios.post('https://api.midtrans.com/v2/charge', {
  // payload
}, {
  headers: {
    'Authorization': `Basic ${auth}`
  }
});
```

**Keys Used:**
- ✅ Server Key (via API_KEY)
- ✅ Merchant ID (for logging/tracking)

### Frontend/Website (Not applicable for bot)

```html
<script src="https://app.midtrans.com/snap/snap.js" 
        data-client-key="SB-Mid-client-xxxxx">
</script>
```

**Keys Used:**
- ✅ Client Key
- ❌ Server Key (never expose to frontend!)

## ⚠️ Security Best Practices

### DO ✅

1. **Store Server Key in environment/config file**
   ```bash
   # .env
   MIDTRANS_SERVER_KEY=SB-Mid-server-xxxxx
   ```

2. **Add to .gitignore**
   ```gitignore
   .vars.json
   .env
   ```

3. **Use different keys for sandbox/production**
   ```javascript
   const serverKey = process.env.MIDTRANS_ENV === 'production'
     ? process.env.PROD_SERVER_KEY
     : process.env.SANDBOX_SERVER_KEY;
   ```

### DON'T ❌

1. ❌ **Jangan commit Server Key ke git**
   ```javascript
   // BAD!
   const serverKey = 'SB-Mid-server-abc123def456'; 
   ```

2. ❌ **Jangan kirim Server Key ke client**
   ```javascript
   // BAD!
   res.json({ serverKey: process.env.SERVER_KEY });
   ```

3. ❌ **Jangan share di public**
   - GitHub issues
   - Stack Overflow
   - Discord/Telegram groups

## 🧪 Testing

### Verify Keys Setup

```bash
# Test dengan curl
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

**Expected Response:**
```json
{
  "status_code": "201",
  "status_message": "Success",
  "transaction_id": "...",
  "order_id": "TEST-001",
  "actions": [...]
}
```

## 📚 Reference

- **Midtrans Docs:** https://docs.midtrans.com
- **API Reference:** https://api-docs.midtrans.com
- **Authentication:** https://docs.midtrans.com/#authentication

## ❓ FAQ

### Q: Apakah Client Key wajib untuk bot?

**A:** ❌ Tidak. Client Key hanya untuk frontend (website/mobile app).

### Q: Kenapa ada 2 keys di bot (MERCHANT_ID dan API_KEY)?

**A:** 
- `MERCHANT_ID` = Identifier merchant Anda
- `API_KEY` = Server Key untuk autentikasi API

### Q: Apakah bisa pakai Client Key di bot?

**A:** ❌ Tidak bisa. Bot adalah server application, harus pakai Server Key.

### Q: Server Key sandbox bisa untuk production?

**A:** ❌ Tidak. Sandbox dan Production adalah environment terpisah.

### Q: Bagaimana cara switch dari sandbox ke production?

**A:**
1. Ambil Production Server Key & Merchant ID
2. Update `.vars.json`
3. Set `MIDTRANS_ENV=production`
4. Restart bot

---

**Last Updated:** November 24, 2025
