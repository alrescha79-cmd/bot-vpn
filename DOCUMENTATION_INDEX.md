# 📚 Documentation Index

Complete documentation for the VPN Telegram Bot v3.1 - Account Persistence Update

---

## 🚀 Quick Start

### For New Users
1. **[README.md](./README.md)** - Main project documentation
   - Latest features (v3.1 with Account Persistence)
   - Installation guide
   - Configuration
   - Usage

2. **[QUICKSTART.md](./QUICKSTART.md)** - Quick setup guide
   - Development setup
   - Build process
   - VPS deployment

---

## 📖 Detailed Guides

### Deployment & Operations
- **[docs/DEPLOYMENT.md](docs/DEPLOYMENT.md)** - Production deployment
  - VPS setup with PM2/systemd
  - Database management
  - Security best practices

### Migration & Updates
- **[docs/MIGRATION_GUIDE.md](docs/MIGRATION_GUIDE.md)** - Upgrade guide
  - v2.x to v3.x migration
  - Database migration

### Testing & Troubleshooting
- **[docs/TESTING.md](docs/TESTING.md)** - Testing guide
  - Account persistence testing
  - Database verification

- **[docs/TROUBLESHOOTING.md](docs/TROUBLESHOOTING.md)** - Common issues

---

## 📋 Changelog

- **[docs/CHANGELOG_V3.md](docs/CHANGELOG_V3.md)** - Version history
  - v3.1: Account persistence & Akunku menu
  - v3.0: Modular architecture

---

## 🔧 Helper Scripts

Located in `scripts/`:

- `check-accounts.sh` - Check saved accounts
- `test-account-persist.sh` - Monitor persistence
- `set-admin.sh <user_id>` - Set admin role
- `test-extraction.js` - Test extraction patterns

---

## 🆘 Quick Commands

```bash
# Development
npm run dev
npm run build

# Production  
pm2 start ecosystem.config.js
pm2 restart bot-vpn

# Database
./scripts/check-accounts.sh
sqlite3 data/botvpn.db ".tables"

# Logs
pm2 logs bot-vpn
```

---

**Last Updated:** November 2025 - v3.1
