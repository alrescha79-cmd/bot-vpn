/**
 * @fileoverview Main Application Entry Point (Modular Architecture)
 * Clean, enterprise-grade entry point for the VPN Telegram Bot
 * 
 * This replaces the monolithic 6,057-line app.js with a modular architecture
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
 * @version 2.0.0
 */

// Core modules
const fs = require('fs');
const path = require('path');
const { exec } = require('child_process');
const cron = require('node-cron');
const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const { Telegraf, session } = require('telegraf');

// Refactored modules
const config = require('./src/config');
const constants = require('./src/config/constants');
const logger = require('./src/utils/logger');
const { dbRunAsync, dbGetAsync, dbAllAsync } = require('./src/database/connection');

// Load all handlers
const { loadAllHandlers } = require('./src/app/loader');

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
  adminIds
} = config;

// Ensure required directories exist
[TELEGRAM_UPLOAD_DIR, BACKUP_DIR, UPLOAD_DIR].forEach(dir => {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
    logger.info(`✅ Created directory: ${dir}`);
  }
});

// Initialize Telegraf bot
const bot = new Telegraf(BOT_TOKEN);
bot.use(session());

// Initialize Express server
const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

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
    // Create reseller_upgrade_log table
    await dbRunAsync(`
      CREATE TABLE IF NOT EXISTS reseller_upgrade_log (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER,
        username TEXT,
        amount INTEGER,
        level TEXT,
        created_at TEXT
      )
    `);
    logger.info('✅ Table reseller_upgrade_log ready');

    // Add username column if not exists
    await dbRunAsync(`ALTER TABLE users ADD COLUMN username TEXT`).catch(err => {
      if (!err.message.includes('duplicate column name')) {
        throw err;
      }
    });
    logger.info('✅ Database schema updated');
  } catch (error) {
    logger.error('❌ Error initializing tables:', error.message);
  }
}

/**
 * Setup cron jobs
 */
function setupCronJobs() {
  // Reset trial count daily at 00:00
  cron.schedule('0 0 * * *', async () => {
    try {
      await dbRunAsync(`UPDATE users SET trial_count_today = 0, last_trial_date = date('now')`);
      logger.info('✅ Daily trial count reset completed');
    } catch (err) {
      logger.error('❌ Failed to reset daily trial count:', err.message);
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

  logger.info('✅ Cron jobs configured (trial reset, daily restart, monthly commission)');
}

/**
 * Setup Express routes
 */
function setupExpressRoutes() {
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
    logger.info(`🌐 Express server listening on port ${PORT}`);
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
    bot.stop('SIGINT').catch(() => {});
    db.close(() => {
      logger.info('📊 Database connection closed');
      process.exit(0);
    });
  });

  // Graceful shutdown on SIGTERM (PM2)
  process.once('SIGTERM', () => {
    logger.warn('⚠️ SIGTERM received, shutting down gracefully...');
    bot.stop('SIGTERM').catch(() => {});
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

    // 1. Initialize database tables
    await initializeTables();

    // 2. Load all handlers (commands, actions, events)
    loadAllHandlers(bot, {
      adminIds: config.adminIds,
      ownerId: config.USER_ID
    });

    // 3. Setup cron jobs
    setupCronJobs();

    // 4. Setup Express server
    setupExpressRoutes();

    // 5. Setup error handlers
    setupErrorHandlers();

    // 6. Start the bot
    await bot.launch();

    logger.info('✅ Bot started successfully!');
    logger.info(`👤 Admin IDs: ${config.adminIds.join(', ')}`);
    logger.info(`📱 Group ID: ${config.GROUP_ID || 'Not configured'}`);
    logger.info(`🌐 Port: ${PORT}`);
    logger.info('');
    logger.info('🎉 All systems operational!');
    logger.info('📌 Bot is running with full modular architecture');

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
