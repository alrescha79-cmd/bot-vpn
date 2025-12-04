/**
 * @fileoverview Main Application Entry Point (Modular Architecture)
 * Clean, enterprise-grade entry point for the VPN Telegram Bot
 * 
 * Architecture Layers:
 * - Config Layer: Environment & constants
 * - Infrastructure Layer: Database, cache, HTTP clients
 * - Repository Layer: Data access operations
 * - Service Layer: Business logic
 * - Handler Layer: Commands, actions, events
 * - Middleware Layer: Auth, validation, error handling
 * 
 * @module index-refactored
 * @version 3.0.0
 */

// Core modules
const fs = require('fs');
const path = require('path');
const { exec } = require('child_process');
const cron = require('node-cron');
const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const { Telegraf, session } = require('telegraf');
const os = require('os');

// Helper function to get local IP address
function getLocalIPAddress() {
  const networkInterfaces = os.networkInterfaces();
  let localIP = 'localhost';

  try {
    Object.keys(networkInterfaces).forEach(interfaceName => {
      const addresses = networkInterfaces[interfaceName];
      if (addresses) {
        addresses.forEach(address => {
          if (address.family === 'IPv4' && !address.internal) {
            localIP = address.address;
          }
        });
      }
    });
  } catch (error) {
    // Fallback to localhost if error
  }

  return localIP;
}

// Auto-detect development or production mode
const isDev = process.env.NODE_ENV === 'development';
const srcPath = isDev ? './src' : './dist';

// Register ts-node in development mode
if (isDev) {
  require('ts-node').register({
    transpileOnly: true,
    compilerOptions: {
      module: 'commonjs',
      target: 'ES2020',
      esModuleInterop: true
    }
  });
  console.log('🔥 Development mode: Loading from src/\n');
} else {
  console.log('🚀 Production mode: Loading from dist/\n');
}

// Refactored modules
const config = require(`${srcPath}/config`);
const constants = require(`${srcPath}/config/constants`);
const logger = require(`${srcPath}/utils/logger`);
const { dbRunAsync, dbGetAsync, dbAllAsync } = require(`${srcPath}/database/connection`);
const { initializeDatabase, syncAdmins } = require(`${srcPath}/infrastructure/database`);

// Load all handlers
const { loadAllHandlers } = require(`${srcPath}/app/loader`);

// Setup mode support
const { isSetupMode, setupModeMiddleware, configureSetupRoutes, logSetupStatus } = require(`${srcPath}/config/setup-mode`);
const configRoutes = require(`${srcPath}/api/config.routes`);

// Constants
const {
  TELEGRAM_UPLOAD_DIR,
  BACKUP_DIR,
  DB_PATH,
  UPLOAD_DIR
} = constants;

const {
  BOT_TOKEN,
  USER_ID,
  GROUP_ID,
  PORT,
  adminIds,
  isSetupMode: configIsSetupMode
} = config;

// Ensure required directories exist
[TELEGRAM_UPLOAD_DIR, BACKUP_DIR, UPLOAD_DIR].forEach(dir => {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
    logger.info(`✅ Created directory: ${dir}`);
  }
});

// Initialize Express server FIRST (for setup mode)
const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Configure setup routes
configureSetupRoutes(app);

// Mount config API routes
app.use('/api', configRoutes);

// Check and log setup status
logSetupStatus(PORT || 50123);

// If in setup mode, only start Express server
if (configIsSetupMode || isSetupMode()) {
  logger.warn('⚠️ Application in SETUP MODE - Bot will not start');
  logger.info(`🌐 Web server starting on port ${PORT || 50123}...`);

  app.listen(PORT || 50123, () => {
    const port = PORT || 50123;
    const localIP = getLocalIPAddress();

    logger.info('');
    logger.info('🌐 Web Server URLs:');
    logger.info(`   📝 Setup Page (Local):  http://localhost:${port}/setup`);
    logger.info(`   📝 Setup Page (Network): http://${localIP}:${port}/setup`);
    logger.info(`   ❤️  Health Check:        http://localhost:${port}/health`);
    logger.info('');
  });

  return; // Exit here, don't start bot
}

// Initialize Telegraf bot (only if NOT in setup mode)
const bot = new Telegraf(BOT_TOKEN);
bot.use(session());

// Initialize SQLite database
const db = new sqlite3.Database(DB_PATH, (err) => {
  if (err) {
    logger.error('❌ SQLite connection error:', err.message);
    process.exit(1);
  } else {
    logger.info('✅ Connected to SQLite database');
  }
});

// Make db globally accessible (for backward compatibility)
global.db = db;
global.userState = {};
global.depositState = {};

/**
 * Initialize database tables
 */
async function initializeTables() {
  try {
    // Import and run full schema initialization
    const { initializeSchema } = require(`${srcPath}/database/schema`);
    await initializeSchema();
    logger.info('✅ Database schema initialized successfully');
  } catch (error) {
    logger.error('❌ Error initializing database schema:', error.message);
    throw error;
  }
}

/**
 * Setup cron jobs
 */
function setupCronJobs() {
  // Import expiration service
  const expirationService = require(`${srcPath}/services/expirationService`);
  const config = require(`${srcPath}/config`);

  // Reset trial count daily at 00:00
  cron.schedule('0 0 * * *', async () => {
    try {
      await dbRunAsync(`UPDATE users SET trial_count_today = 0, last_trial_date = date('now')`);
      logger.info('✅ Daily trial count reset completed');
    } catch (err) {
      logger.error('❌ Failed to reset daily trial count:', err.message);
    }
  });

  // Daily expiration check at 09:00
  cron.schedule('0 9 * * *', async () => {
    try {
      logger.info('🔔 Running daily expiration check (3-day and 1-day warnings)...');

      // Check accounts expiring in 3 days
      const count3d = await expirationService.checkExpiringAccounts(bot, 3);

      // Check accounts expiring in 1 day
      const count1d = await expirationService.checkExpiringAccounts(bot, 1);

      logger.info(`✅ Expiration check completed: ${count3d} 3-day warnings, ${count1d} 1-day warnings sent`);
    } catch (err) {
      logger.error('❌ Failed to run expiration check:', err.message);
    }
  });

  // Daily expired account check at 10:00
  cron.schedule('0 10 * * *', async () => {
    try {
      logger.info('🔔 Running daily expired account check...');

      const count = await expirationService.checkExpiredAccounts(bot);

      logger.info(`✅ Expired account check completed: ${count} notifications sent`);
    } catch (err) {
      logger.error('❌ Failed to run expired account check:', err.message);
    }
  });

  // Daily auto-deletion at 02:00
  cron.schedule('0 2 * * *', async () => {
    try {
      logger.info('🗑️  Running daily auto-deletion of expired accounts...');

      const deletedCount = await expirationService.deleteExpiredAccounts(bot, config.adminIds);

      logger.info(`✅ Auto-deletion completed: ${deletedCount} accounts removed`);
    } catch (err) {
      logger.error('❌ Failed to run auto-deletion:', err.message);
    }
  });

  // Daily bot restart at 04:00
  cron.schedule('0 4 * * *', () => {
    logger.warn('🌀 Scheduled daily restart (04:00)...');
    exec('pm2 restart botvpn', async (err) => {
      if (err) {
        logger.error('❌ PM2 restart failed:', err.message);
      } else {
        logger.info('✅ Bot restarted by daily scheduler');
        const restartMsg = `♻️ Bot restarted automatically (daily schedule).\n🕓 Time: ${new Date().toLocaleString('id-ID')}`;
        try {
          await bot.telegram.sendMessage(GROUP_ID || adminIds[0], restartMsg);
          logger.info('📢 Restart notification sent');
        } catch (e) {
          logger.warn('⚠️ Failed to send restart notification:', e.message);
        }
      }
    });
  });

  // Monthly commission reset on 1st at 01:00
  cron.schedule('0 1 1 * *', async () => {
    try {
      await dbRunAsync(`DELETE FROM reseller_sales`);
      await dbRunAsync(`UPDATE users SET reseller_level = 'silver' WHERE role = 'reseller'`);
      logger.info('✅ Monthly commission reset completed');

      if (GROUP_ID) {
        await bot.telegram.sendMessage(
          GROUP_ID,
          `🧹 *Monthly Commission Reset:*\n\nAll reseller commissions have been reset and levels returned to *SILVER*.`,
          { parse_mode: 'Markdown' }
        );
      }
    } catch (err) {
      logger.error('❌ Failed monthly commission reset:', err.message);
    }
  });

  logger.info('✅ Cron jobs configured:');
  logger.info('   - 00:00: Trial count reset');
  logger.info('   - 02:00: Auto-delete expired accounts (3+ days)');
  logger.info('   - 04:00: Daily bot restart');
  logger.info('   - 09:00: Expiration warnings (3-day & 1-day)');
  logger.info('   - 10:00: Expired account notifications');
  logger.info('   - 01:00 (monthly): Commission reset');
}

/**
 * Setup Express routes
 */
function setupExpressRoutes() {
  // Make bot instance available to routes
  app.set('bot', bot);

  // Health check endpoint
  app.get('/health', (req, res) => {
    res.json({
      status: 'ok',
      uptime: process.uptime(),
      timestamp: new Date().toISOString()
    });
  });

  // Start Express server
  app.listen(PORT, () => {
    const localIP = getLocalIPAddress();

    logger.info(`🌐 Express server listening on port ${PORT}`);
    logger.info('');
    logger.info('🌐 Web Interface URLs:');
    logger.info(`   ⚙️  Edit Config (Local):   http://localhost:${PORT}/config/edit`);
    logger.info(`   ⚙️  Edit Config (Network): http://${localIP}:${PORT}/config/edit`);
    logger.info(`   ❤️  Health Check:          http://localhost:${PORT}/health`);
    logger.info(`   💳 Midtrans Webhook:       http://${localIP}:${PORT}/api/midtrans/notification`);
    logger.info(`   💳 Pakasir Webhook:        http://${localIP}:${PORT}/api/pakasir/notification`);
    logger.info('');
  });
}

/**
 * Setup error handlers
 */
function setupErrorHandlers() {
  process.on('unhandledRejection', (reason, promise) => {
    logger.error('❌ Unhandled Rejection at:', promise, 'reason:', reason);
  });

  process.on('uncaughtException', (error) => {
    logger.error('❌ Uncaught Exception:', error);
    // Graceful shutdown
    bot.stop('SIGTERM');
    db.close(() => {
      logger.info('📊 Database connection closed');
      process.exit(1);
    });
  });

  // Graceful shutdown on SIGINT (Ctrl+C)
  process.once('SIGINT', () => {
    logger.warn('⚠️ SIGINT received, shutting down gracefully...');
    bot.stop('SIGINT').catch(() => { });
    db.close(() => {
      logger.info('📊 Database connection closed');
      process.exit(0);
    });
  });

  // Graceful shutdown on SIGTERM (PM2)
  process.once('SIGTERM', () => {
    logger.warn('⚠️ SIGTERM received, shutting down gracefully...');
    bot.stop('SIGTERM').catch(() => { });
    db.close(() => {
      logger.info('📊 Database connection closed');
      process.exit(0);
    });
  });
}

/**
 * Main application startup
 */
async function main() {
  try {
    logger.info('🚀 Starting VPN Telegram Bot (MODULAR VERSION)...');
    logger.info(`📝 Environment: ${process.env.NODE_ENV || 'development'}`);
    logger.info(`📅 Date: ${new Date().toLocaleString('id-ID')}`);

    // 1. Initialize infrastructure database (for new modules)
    await initializeDatabase();
    logger.info('✅ Infrastructure database initialized');

    // 2. Initialize database tables
    await initializeTables();

    // 3. Sync admin users from config to database
    await syncAdmins();
    logger.info('✅ Admin users synced from config');

    // 4. Load all handlers (commands, actions, events)
    loadAllHandlers(bot, {
      adminIds: config.adminIds,
      ownerId: config.USER_ID
    });

    // 5. Setup cron jobs
    setupCronJobs();

    // 6. Setup Express server
    setupExpressRoutes();

    // 7. Setup error handlers
    setupErrorHandlers();

    // 8. Start the bot
    await bot.launch();

    const localIP = getLocalIPAddress();

    logger.info('✅ Bot started successfully!');
    logger.info(`👤 Admin IDs: ${config.adminIds.join(', ')}`);
    logger.info(`📱 Group ID: ${config.GROUP_ID || 'Not configured'}`);
    logger.info(`🌐 Port: ${PORT}`);
    logger.info('');
    logger.info('🎉 All systems operational!');
    logger.info('📌 Bot is running with full modular architecture');
    logger.info('');
    logger.info('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    logger.info('🌐 Management URLs:');
    logger.info(`   ⚙️  Edit Config (Local):   http://localhost:${PORT}/config/edit`);
    logger.info(`   ⚙️  Edit Config (Network): http://${localIP}:${PORT}/config/edit`);
    logger.info(`   ❤️  Health Check:          http://localhost:${PORT}/health`);
    logger.info('');
    logger.info('💳 Payment Gateway Webhooks:');
    logger.info(`   🔶 Midtrans:  http://${localIP}:${PORT}/api/midtrans/notification`);
    logger.info(`   🟢 Pakasir:   http://${localIP}:${PORT}/api/pakasir/notification`);
    logger.info('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

  } catch (err) {
    logger.error('❌ Fatal error starting bot:', err);
    process.exit(1);
  }
}

// Start the application
if (require.main === module) {
  main();
}

module.exports = { main, bot, app, db };
