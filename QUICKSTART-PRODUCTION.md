# ⚡ Quick Start - Production Deployment

**5-Minute Guide untuk Deploy ke VPS**

---

## 📦 Step 1: Build di Local

```bash
cd /home/son/Projects/bot-tele
npm run build
```

✅ Hasilnya di folder `dist/`

---

## 🚀 Step 2: Upload ke VPS

Upload files berikut:

```bash
# Method 1: SCP
scp -r dist/ package.json package-lock.json index.js user@vps-ip:/var/www/bot-vpn/

# Method 2: Git
git clone https://github.com/alrescha79-cmd/bot-vpnv2.git
cd bot-vpnv2
npm run build
```

---

## ⚠️ Step 3: Install Dependencies (CRITICAL!)

```bash
# SSH ke VPS
ssh user@vps-ip

# Masuk ke folder aplikasi
cd /var/www/bot-vpn

# Install dependencies
npm install --production
```

> **🔴 JANGAN SKIP STEP INI!**  
> Error `Cannot find module 'xxx'` = Anda melewatkan step ini!

---

## 🎯 Step 4: Setup Konfigurasi

```bash
# Jalankan aplikasi (akan masuk setup mode)
NODE_ENV=production node index.js
```

Buka browser: `http://vps-ip:50123/setup`

Isi form, klik **Simpan & Lanjutkan**

---

## ✅ Step 5: Auto-Start dengan PM2

```bash
# Install PM2 global
npm install -g pm2

# Start aplikasi
pm2 start index.js --name bot-vpn --env production

# Save & Auto-start on boot
pm2 save
pm2 startup
```

---

## 🔍 Quick Diagnostics

```bash
# Check if running
pm2 status

# View logs
pm2 logs bot-vpn

# Restart
pm2 restart bot-vpn

# Stop
pm2 stop bot-vpn
```

---

## ❌ Common Errors & Fixes

### Error: `Cannot find module 'node-cron'`

**Fix:**
```bash
cd /var/www/bot-vpn
npm install --production
```

### Error: `SQLITE_READONLY`

**Fix:**
```bash
sudo chown -R $USER:$USER /var/www/bot-vpn/data/
```

### Error: `Port already in use`

**Fix:**
```bash
pm2 stop bot-vpn
# or
lsof -i :50123 | grep node | awk '{print $2}' | xargs kill
```

---

## 📚 Full Documentation

- **Deployment Guide:** [DEPLOYMENT.md](./DEPLOYMENT.md)
- **Troubleshooting:** [TROUBLESHOOTING.md](./TROUBLESHOOTING.md)
- **Main README:** [README.md](./README.md)

---

## ✅ Checklist Deployment

- [ ] Build di local: `npm run build`
- [ ] Upload: `dist/`, `package.json`, `package-lock.json`, `index.js`
- [ ] **Install dependencies:** `npm install --production` ⚠️
- [ ] Setup config via web: `http://vps-ip:50123/setup`
- [ ] Start with PM2: `pm2 start index.js --name bot-vpn`
- [ ] Auto-start: `pm2 save && pm2 startup`
- [ ] Test bot di Telegram

---

**🎉 Done! Bot sudah running di VPS!**

Untuk monitoring: `pm2 monit`
