# 🚀 Production Auto Installer - Bot VPN

Dokumentasi lengkap untuk menggunakan script auto-installer pada production server.

---

## 📋 Overview

Script `install-production.sh` adalah automated installer yang:
- ✅ Install semua dependencies (Node.js, PM2, tools)
- ✅ Download release dari GitHub Releases
- ✅ Extract dan deploy aplikasi
- ✅ Install production dependencies
- ✅ Setup PM2 untuk auto-start
- ✅ Preserve existing configuration dan database (untuk update)

---

## 🔧 Requirements

### System Requirements

- **OS:** Linux (Ubuntu 18.04+, Debian 10+, atau compatible)
- **RAM:** Minimal 512MB (1GB+ recommended)
- **Storage:** 500MB+ free space
- **Network:** Internet connection untuk download

### Permissions

- User dengan sudo privileges (recommended)
- Atau root access (not recommended for security)
- Write access ke installation directory

### Pre-installed (Optional)

Script akan menginstall otomatis jika belum ada:
- Node.js v20+
- npm
- PM2
- curl/wget
- tar/unzip

---

## 🚀 Installation Methods

### Method 1: One-Line Install (Recommended)

Install versi latest:

```bash
curl -s https://raw.githubusercontent.com/alrescha79-cmd/bot-vpn/main/scripts/install-production.sh | bash
```

Install versi spesifik:

```bash
curl -s https://raw.githubusercontent.com/alrescha79-cmd/bot-vpn/main/scripts/install-production.sh | bash -s -- --version v1.0.0
```

Custom installation path:

```bash
curl -s https://raw.githubusercontent.com/alrescha79-cmd/bot-vpn/main/scripts/install-production.sh | bash -s -- --path /opt/bot-vpn
```

### Method 2: Download and Run

```bash
# Download script
wget https://raw.githubusercontent.com/alrescha79-cmd/bot-vpn/main/scripts/install-production.sh

# Make executable
chmod +x install-production.sh

# Run with default settings (latest version)
./install-production.sh

# Or specify version
./install-production.sh --version v1.0.0

# Or custom path
./install-production.sh --path /opt/bot-vpn
```

### Method 3: From Release Package

Jika sudah download release manually:

```bash
# Extract release archive
tar -xzf bot-vpn-production-v1.0.0.tar.gz -C /var/www/bot-vpn

# Go to directory
cd /var/www/bot-vpn

# Install dependencies
npm install --omit=dev

# Setup with PM2
pm2 start index.js --name bot-vpn
pm2 save
```

---

## 🎯 Script Options

### Available Options

```bash
./install-production.sh [OPTIONS]
```

| Option | Description | Default |
|--------|-------------|---------|
| `--version VERSION` | Specify release version to install | `latest` |
| `--path PATH` | Installation directory path | `/var/www/bot-vpn` |
| `--help` | Show help message | - |

### Examples

**Install latest version:**
```bash
./install-production.sh
```

**Install specific version:**
```bash
./install-production.sh --version v1.0.0
```

**Custom installation path:**
```bash
./install-production.sh --path /home/user/apps/bot-vpn
```

**Combine options:**
```bash
./install-production.sh --version v1.2.3 --path /opt/bot-vpn
```

---

## 📦 What the Script Does

### Step-by-Step Process

#### 1. **Pre-flight Checks**
   - Verify OS compatibility (Linux only)
   - Check current user permissions
   - Display warnings if running as root

#### 2. **Install Dependencies**
   - Update system package list
   - Install Node.js v20 (if not installed)
   - Install npm
   - Install required tools: curl, wget, unzip, tar
   - Install PM2 globally

#### 3. **Download Release**
   - Fetch release information from GitHub
   - Download specified version (or latest)
   - Verify download integrity

#### 4. **Prepare Installation Directory**
   - Create installation directory if not exists
   - If existing installation detected:
     - Create backup with timestamp
     - Preserve `.vars.json` (configuration)
     - Preserve `data/` directory (database)

#### 5. **Extract Files**
   - Extract release archive to installation path
   - Verify extraction success

#### 6. **Restore Previous Data** (if update)
   - Restore preserved `.vars.json`
   - Restore preserved `data/` directory with database

#### 7. **Install Application Dependencies**
   - Run `npm install --omit=dev`
   - Install only production dependencies
   - Optimize for production environment

#### 8. **Setup Directory Structure**
   - Create `data/` directory if not exists
   - Set correct permissions:
     - `data/` → 755
     - `data/botvpn.db` → 644 (if exists)
     - `.vars.json` → 600 (if exists)

#### 9. **Configure PM2**
   - Stop existing `bot-vpn` process (if running)
   - Start new process with PM2
   - Save PM2 process list
   - Display auto-start setup command

#### 10. **Post-Installation**
   - Display installation summary
   - Show configuration instructions (if fresh install)
   - Display useful commands
   - Show application status

---

## 📂 Installation Structure

After installation, directory structure will be:

```
/var/www/bot-vpn/               (or your custom path)
├── dist/                       # Compiled application code
│   ├── app/
│   ├── config/
│   ├── database/
│   ├── handlers/
│   ├── modules/
│   └── ...
├── data/                       # Database directory
│   └── botvpn.db              # SQLite database (auto-created)
├── docs/                       # Documentation
│   ├── DEPLOYMENT.md
│   ├── QUICKSTART.md
│   ├── TROUBLESHOOTING.md
│   └── ...
├── deployment/                 # Deployment configs
│   └── bot-vpn.service        # systemd service example
├── node_modules/               # Dependencies
├── index.js                    # Application entry point
├── package.json                # Dependencies info
├── package-lock.json           # Lock file
├── .vars.json.example          # Config template
└── .vars.json                  # Your configuration (created on first run)
```

---

## ⚙️ Initial Configuration

### For Fresh Installation

After installation, the application runs in **setup mode**:

1. **Access Web Interface:**
   ```
   http://YOUR_SERVER_IP:50123/setup
   ```

2. **Fill Configuration Form:**
   - **Bot Token:** Get from [@BotFather](https://t.me/BotFather)
   - **User ID Admin:** Your Telegram user ID
   - **Group ID:** Your Telegram group ID (optional)
   - **Store Name:** Your VPN store name
   - **QRIS Data:** Payment gateway details
   - **Port:** Web interface port (default: 50123)

3. **Save Configuration**

4. **Restart Application:**
   ```bash
   pm2 restart bot-vpn
   ```

### For Updates

Configuration dan database akan **otomatis dipreserve**:
- `.vars.json` → Preserved
- `data/botvpn.db` → Preserved
- No reconfiguration needed!

---

## 🔄 Update Existing Installation

Script dapat digunakan untuk update:

```bash
# Update to latest version
./install-production.sh

# Update to specific version
./install-production.sh --version v2.0.0
```

**Apa yang terjadi saat update:**
1. ✅ Existing installation detected
2. ✅ Backup created automatically (`/var/www/bot-vpn.backup.TIMESTAMP/`)
3. ✅ Configuration preserved (`/tmp/.vars.json.preserve`)
4. ✅ Database preserved (`/tmp/data.preserve`)
5. ✅ New version extracted
6. ✅ Configuration and database restored
7. ✅ Dependencies updated
8. ✅ Application restarted

**Your data is safe!** Configuration dan database tidak akan hilang.

---

## 🔧 PM2 Management

### Useful Commands

```bash
# Check status
pm2 status bot-vpn

# View logs (real-time)
pm2 logs bot-vpn

# View last 100 lines
pm2 logs bot-vpn --lines 100

# Restart application
pm2 restart bot-vpn

# Stop application
pm2 stop bot-vpn

# Start application
pm2 start bot-vpn

# Remove from PM2
pm2 delete bot-vpn

# Monitor resources
pm2 monit

# Save current process list
pm2 save

# Resurrect saved processes
pm2 resurrect
```

### Auto-Start on Reboot

Setup PM2 to auto-start on server reboot:

```bash
# Generate startup script
pm2 startup

# Copy and run the command shown (example):
sudo env PATH=$PATH:/usr/bin pm2 startup systemd -u your-user --hp /home/your-user

# Save current process list
pm2 save
```

Now your bot will auto-start after server reboot! 🎉

---

## 🐛 Troubleshooting

### Issue: Script fails with "Permission Denied"

**Error:**
```
mkdir: cannot create directory '/var/www/bot-vpn': Permission denied
```

**Solution:**
```bash
# Run with sudo
sudo ./install-production.sh

# Or use a path you own
./install-production.sh --path $HOME/bot-vpn
```

---

### Issue: Node.js installation fails

**Error:**
```
Failed to install Node.js
```

**Solution:**
Install Node.js manually:

```bash
# Install Node.js v20 via NodeSource
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt-get install -y nodejs

# Verify installation
node --version
npm --version

# Run installer again
./install-production.sh
```

---

### Issue: "Failed to download release"

**Possible Causes:**
1. Invalid version number
2. Network connectivity issues
3. GitHub rate limit

**Solution:**

**Check version exists:**
```bash
# List available releases
curl -s https://api.github.com/repos/alrescha79-cmd/bot-vpn/releases | grep tag_name
```

**Test network:**
```bash
# Test GitHub connectivity
curl -I https://github.com

# Test API access
curl -s https://api.github.com/repos/alrescha79-cmd/bot-vpn/releases/latest
```

**Manual download:**
```bash
# Download manually from browser:
https://github.com/alrescha79-cmd/bot-vpn/releases

# Then use Method 3 (manual installation)
```

---

### Issue: npm install fails

**Error:**
```
npm ERR! Cannot read property 'match' of undefined
```

**Solution:**
```bash
# Clear npm cache
npm cache clean --force

# Remove node_modules
rm -rf node_modules

# Install again
npm install --omit=dev
```

---

### Issue: PM2 not found after installation

**Solution:**
```bash
# Install PM2 globally with sudo
sudo npm install -g pm2

# Or without sudo (add to PATH)
npm install -g pm2
export PATH=$PATH:$(npm config get prefix)/bin

# Add to .bashrc or .zshrc for persistence
echo 'export PATH=$PATH:$(npm config get prefix)/bin' >> ~/.bashrc
source ~/.bashrc
```

---

### Issue: Application not starting

**Check logs:**
```bash
pm2 logs bot-vpn --lines 50
```

**Common problems:**

1. **Missing configuration:**
   - Access `http://YOUR_IP:50123/setup`
   - Complete configuration
   - Restart: `pm2 restart bot-vpn`

2. **Port already in use:**
   ```bash
   # Check what's using port 50123
   sudo lsof -i :50123
   
   # Kill process or change port in .vars.json
   ```

3. **Database permission error:**
   ```bash
   # Fix permissions
   chmod 755 data/
   chmod 644 data/botvpn.db
   ```

---

### Issue: Configuration web interface not accessible

**Check firewall:**
```bash
# Allow port 50123
sudo ufw allow 50123/tcp

# Or disable firewall temporarily for testing
sudo ufw disable
```

**Check if port is listening:**
```bash
sudo netstat -tulpn | grep :50123
# atau
sudo ss -tulpn | grep :50123
```

**Check application logs:**
```bash
pm2 logs bot-vpn
```

---

## 🔐 Security Recommendations

### 1. **Firewall Configuration**

```bash
# Allow SSH
sudo ufw allow 22/tcp

# Allow bot web interface (if needed publicly)
sudo ufw allow 50123/tcp

# Enable firewall
sudo ufw enable

# Check status
sudo ufw status
```

### 2. **Secure Configuration File**

```bash
# Restrict .vars.json permissions
chmod 600 /var/www/bot-vpn/.vars.json

# Only owner can read/write
```

### 3. **Use Non-Root User**

```bash
# Create dedicated user
sudo adduser botvpn

# Run installer as this user
su - botvpn
./install-production.sh --path /home/botvpn/bot-vpn
```

### 4. **Regular Backups**

```bash
# Backup database daily
crontab -e

# Add line:
0 2 * * * cp /var/www/bot-vpn/data/botvpn.db /var/www/bot-vpn/data/backups/botvpn.db.$(date +\%Y\%m\%d)
```

### 5. **Nginx Reverse Proxy** (Optional)

Hide direct port access:

```nginx
server {
    listen 80;
    server_name bot.yourdomain.com;
    
    location / {
        proxy_pass http://localhost:50123;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }
}
```

---

## 📊 Verification Checklist

After installation, verify:

- [ ] ✅ Node.js installed: `node --version`
- [ ] ✅ npm installed: `npm --version`
- [ ] ✅ PM2 installed: `pm2 --version`
- [ ] ✅ Application files in place: `ls -la /var/www/bot-vpn`
- [ ] ✅ Dependencies installed: `ls -la /var/www/bot-vpn/node_modules`
- [ ] ✅ PM2 process running: `pm2 status bot-vpn`
- [ ] ✅ Port listening: `sudo ss -tulpn | grep :50123`
- [ ] ✅ Configuration exists: `test -f /var/www/bot-vpn/.vars.json && echo "OK"`
- [ ] ✅ Database created: `test -f /var/www/bot-vpn/data/botvpn.db && echo "OK"`
- [ ] ✅ PM2 auto-start: `pm2 startup`
- [ ] ✅ Reboot test: `sudo reboot` → Check if bot auto-starts

---

## 📞 Support & Resources

### Documentation

- **Deployment Guide:** `/var/www/bot-vpn/docs/DEPLOYMENT.md`
- **Quick Start:** `/var/www/bot-vpn/docs/QUICKSTART.md`
- **Troubleshooting:** `/var/www/bot-vpn/docs/TROUBLESHOOTING.md`

### Check Logs

```bash
# PM2 logs
pm2 logs bot-vpn

# System logs (if using systemd)
journalctl -u bot-vpn -f
```

### Get Help

If you encounter issues not covered here:

1. Check PM2 logs: `pm2 logs bot-vpn --lines 100`
2. Verify configuration: `cat /var/www/bot-vpn/.vars.json`
3. Check database: `ls -lah /var/www/bot-vpn/data/`
4. Test port: `sudo ss -tulpn | grep :50123`
5. Review application logs

---

## 🎉 Success!

If you see:

```
✅ Installation completed successfully!

📦 Bot VPN v1.0.0 has been installed

📁 Installation path: /var/www/bot-vpn

pm2 status bot-vpn
┌─────┬───────────┬─────────────┬─────────┬─────────┬──────────┐
│ id  │ name      │ mode        │ status  │ restart │ uptime   │
├─────┼───────────┼─────────────┼─────────┼─────────┼──────────┤
│ 0   │ bot-vpn   │ fork        │ online  │ 0       │ 0s       │
└─────┴───────────┴─────────────┴─────────┴─────────┴──────────┘
```

**Congratulations! Your Bot VPN is running! 🚀**

---

**Happy Deploying! 🎊**
