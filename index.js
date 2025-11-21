/**
 * Bot Application Entry Point (Refactored Version)
 * 
 * This is the new enterprise-grade entry point that uses the modular architecture.
 * It can run alongside app.js during migration or replace it completely.
 * 
 * @module index
 */

const config = require('./src/config/index.js');
const logger = require('./src/utils/logger.js');
const { initializeDatabase, initializeTables, closeDatabase } = require('./src/infrastructure/database.js');
const cache = require('./src/infrastructure/cache.js');

/**
 * Main application startup
 */
async function startApplication() {
  try {
    logger.info('🚀 Starting Bot Application...');
    
    // 1. Initialize database
    logger.info('📊 Initializing database...');
    await initializeDatabase();
    await initializeTables();
    logger.info('✅ Database ready');
    
    // 2. Validate configuration
    logger.info('⚙️  Validating configuration...');
    if (!config.BOT_TOKEN) {
      throw new Error('BOT_TOKEN is required in .vars.json');
    }
    logger.info('✅ Configuration valid');
    
    // 3. Start legacy app.js for now (during migration)
    logger.info('🔄 Starting bot from app.js...');
    require('./app.js');
    
    // 4. Setup cache cleanup interval
    setInterval(() => {
      cache.clearExpiredSessions();
    }, 5 * 60 * 1000); // Every 5 minutes
    
    logger.info('✅ Bot started successfully');
    logger.info(`📱 Bot Token: ${config.BOT_TOKEN.substring(0, 20)}...`);
    logger.info(`👑 Admin IDs: ${config.adminIds.join(', ')}`);
    
  } catch (error) {
    logger.error('❌ Failed to start application:', error);
    process.exit(1);
  }
}

/**
 * Graceful shutdown handler
 */
async function shutdown() {
  logger.info('🛑 Shutting down gracefully...');
  
  try {
    await closeDatabase();
    logger.info('✅ Database closed');
    
    process.exit(0);
  } catch (error) {
    logger.error('❌ Error during shutdown:', error);
    process.exit(1);
  }
}

// Handle shutdown signals
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);

// Handle uncaught errors
process.on('uncaughtException', (error) => {
  logger.error('❌ Uncaught Exception:', error);
  shutdown();
});

process.on('unhandledRejection', (reason, promise) => {
  logger.error('❌ Unhandled Rejection at:', promise, 'reason:', reason);
  shutdown();
});

// Start the application
startApplication();
