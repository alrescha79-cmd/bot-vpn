
import type { BotContext, DatabaseUser, DatabaseServer } from "../../types";
/**
 * Commands Index
 * Central export for all command handlers
 * @module handlers/commands
 */

const { registerUserCommands } = require('./userCommands');
const { registerAdminCommands } = require('./adminCommands');
const { registerResellerCommands } = require('./resellerCommands');

/**
 * Register all commands to the bot
 * @param {Object} bot - Telegraf bot instance
 * @param {Object} options - Configuration options
 * @param {Array<string>} options.adminIds - List of admin user IDs
 * @param {string} options.ownerId - Owner user ID
 */
function registerAllCommands(bot, options: { adminIds?: number[]; ownerId?: string | null } = {}) {
  const { adminIds = [], ownerId = null } = options;

  registerUserCommands(bot, adminIds);
  registerAdminCommands(bot, adminIds, ownerId);
  registerResellerCommands(bot);
}

module.exports = {
  registerAllCommands,
  registerUserCommands,
  registerAdminCommands,
  registerResellerCommands
};
