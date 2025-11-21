/**
 * Handler Loader
 * Automatically loads and registers all bot handlers
 * @module app/loader
 */

const logger = require('../utils/logger');
const config = require('../config');

// Import command handlers
const { registerAllCommands } = require('../handlers/commands');

// Import action handlers
const { registerAllActions } = require('../handlers/actions');

// Import event handlers
const { registerAllEvents } = require('../handlers/events');

export interface LoaderOptions {
  adminIds?: string[];
  ownerId?: number | number[];
}

export interface BotInstance {
  [key: string]: any;
}

/**
 * Load all handlers into the bot
 * @param {BotInstance} bot - Telegraf bot instance
 * @param {LoaderOptions} options - Configuration options
 */
export function loadAllHandlers(bot: BotInstance, options: LoaderOptions = {}): void {
  const {
    adminIds = config.adminIds,
    ownerId = config.USER_ID
  } = options;

  logger.info('📦 Loading bot handlers...');

  // Register commands
  registerAllCommands(bot, { adminIds, ownerId });
  logger.info('✅ Commands loaded');

  // Register actions
  registerAllActions(bot, { adminIds });
  logger.info('✅ Actions loaded');

  // Register event handlers
  registerAllEvents(bot);
  logger.info('✅ Event handlers loaded');

  logger.info('✅ All handlers loaded successfully');
}

/**
 * Register legacy handlers from old app.js
 * This is temporary during migration
 * @param {BotInstance} bot - Telegraf bot instance
 */
export function loadLegacyHandlers(bot: BotInstance): void {
  logger.warn('⚠️ Loading legacy handlers from app.js...');
  
  // Import and register legacy handlers here if needed during migration
  // This allows gradual migration without breaking existing functionality
  
  logger.warn('⚠️ Legacy handlers loaded (temporary)');
}

module.exports = {
  loadAllHandlers,
  loadLegacyHandlers
};
