# 📚 Documentation Index

Complete documentation for the VPN Telegram Bot v3.1.22 - Pakasir Payment Gateway Integration

---

## 🚀 Quick Start

### For New Users
1. **[README.md](./README.md)** - Main project documentation
   - Latest features (v3.1.22 with Pakasir Payment Gateway)
   - Installation guide
   - Configuration
   - Usage

2. **[QUICKSTART.md](./QUICKSTART.md)** - Quick setup guide
   - Development setup
   - Build process
   - VPS deployment

---

## 💰 Payment Integration

### Payment Gateways
- **[docs/MIDTRANS_SETUP.md](docs/MIDTRANS_SETUP.md)** - Midtrans setup guide
  - Sandbox & Production setup
  - Webhook configuration
  - Auto-verification

- **[docs/PAKASIR_SETUP.md](docs/PAKASIR_SETUP.md)** - Pakasir setup guide
  - Project registration
  - API Key configuration
  - QRIS & Virtual Account
  - Webhook setup

- **[docs/QRIS_SETUP.md](docs/QRIS_SETUP.md)** - Static QRIS setup
  - Dana Bisnis, ShopeePay, GoPay
  - Manual verification flow
  - No API required

### Payment Priority
| Priority | Method | Auto-Verify | 
|----------|--------|-------------|
| 1 | Midtrans | ✅ Yes |
| 2 | Static QRIS | ❌ Manual |
| 3 | Pakasir | ✅ Yes |

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
  - v3.1.22: Pakasir Payment Gateway
  - v3.1.21: Static QRIS Payment
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

## 🔗 Webhook Endpoints

| Gateway | Endpoint | Method |
|---------|----------|--------|
| Midtrans | `/api/midtrans/notification` | POST |
| Pakasir | `/api/pakasir/notification` | POST |

---

**Last Updated:** November 2025 - v3.1.22
