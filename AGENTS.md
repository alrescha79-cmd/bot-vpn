# AGENTS.md

## Project Overview
VPN management Telegram bot with multi-protocol support (SSH, VMess, VLess, Trojan, Shadowsocks) and automated payment verification (Tripay, Duitku, Pakasir, Midtrans, Dynamic/Static QRIS). Architecture combines Telegraf for the Telegram bot, an Express web server for initial setup/config editing and payment webhooks, and SQLite3 for persistent storage.

## Commands

```bash
# Type check TypeScript codebase
npm run type-check

# Build for production (clears dist/, compiles TS, copies frontend assets)
npm run build

# Start development mode (uses nodemon + ts-node directly from src/)
npm run dev

# Start production mode (runs index.js with NODE_ENV=production loading compiled code from dist/)
npm run start:prod
# or: npm start

# Interactive secret setup wizard
node scripts/setup-config.js

# Docker deployment
docker compose up -d --build
```

## Architecture & Execution Flow

- **Entry Point (`index.js`)**:
  - Dynamically detects mode: `NODE_ENV === 'development'` loads TypeScript files directly via `ts-node` from `./src`, while production loads compiled JavaScript from `./dist`.
  - Starts Express server on `PORT` (default `50123`) hosting `/setup`, `/config/edit`, `/health`, and payment webhooks (`/api/tripay/notification`, `/api/duitku/notification`, `/api/midtrans/notification`, `/api/pakasir/notification`).
  - If configuration is missing or unconfigured (`isSetupMode`), the app remains in setup mode (Express server only) and does not launch the bot.
  - When configured, initializes SQLite database schema, syncs admins from config to SQLite, registers all bot handlers (`src/app/loader.ts`), schedules cron jobs, and launches the Telegraf bot instance.
- **Config & Secrets Layer (`src/config/index.ts`)**:
  - Automatically loads configuration from `.env` (via `dotenv`) and/or `.vars.json`.
  - Supports secrets masking and tabs in `src/frontend/config-setup.html`.
- **Payment Gateways (`src/services/` & `src/api/`)**:
  - `tripay.service.ts` & `tripay.webhook.ts`: Tripay QRIS / VA integration with HMAC-SHA256 signature verification.
  - `duitku.service.ts` & `duitku.webhook.ts`: Duitku QRIS / VA integration with MD5 signature verification.
  - `pakasir.service.ts` & `pakasir.webhook.ts`: Pakasir QRIS / VA integration.
  - `qris.service.ts`: Smart fallback & gateway routing (Tripay -> Duitku -> Pakasir -> Midtrans -> Static QRIS).
  - `depositService.ts`: Central deposit flow, QR code display, and status checking.
- **Docker & CI/CD Workflow**:
  - `Dockerfile`: Multi-stage build (`node:20-alpine`) with `tini` init and minimal footprint.
  - `docker-compose.yml`: Mounts `./data:/app/data` for database persistence and reads `.env`.
  - `.github/workflows/docker-publish.yml`: Otomatis build multi-arch (`linux/amd64`, `linux/arm64`) dan push image ke **GitHub Container Registry (GHCR)** (dan Docker Hub jika secrets tersedia) setiap push versi baru di `package.json` / tag release.

## Key Quirks & Gotchas

- **Config Precedence**: Environment variables in `.env` and properties in `.vars.json` are seamlessly merged.
- **Database (`./data/botvpn.db`)**: SQLite database directory `./data` must be preserved across container updates. Auto-migrates on startup via `src/database/schema.ts`.
- **Admin Roles**: Must exist in config/env (as `USER_ID`) and the SQLite `users` table (`role = 'admin'`). `syncAdmins()` handles synchronization automatically on start.
