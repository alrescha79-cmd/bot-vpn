/**
 * Actions Index
 * Central export for all action handlers
 * @module handlers/actions
 */

const { registerServiceActions } = require('./serviceActions');
const { registerAdminActions } = require('./adminActions');
const { registerResellerActions } = require('./resellerActions');
const { registerNavigationActions } = require('./navigationActions');
const { registerAllTrialActions } = require('./trialActions');
const { registerAllServerEditActions } = require('./serverEditActions');
const { registerAllAdminToolsActions } = require('./adminToolsActions');
const { registerAllServerManagementActions } = require('./serverManagementActions');
const { registerAllBackupRestoreActions } = require('./backupRestoreActions');

/**
 * Register all actions to the bot
 * @param {Object} bot - Telegraf bot instance
 * @param {Object} options - Configuration options
 */
function registerAllActions(bot, options = {}) {
  const { adminIds = [] } = options;

  // Register different action groups
  registerServiceActions(bot);
  registerAdminActions(bot);
  registerResellerActions(bot);
  registerNavigationActions(bot);
  registerAllTrialActions(bot);
  registerAllServerEditActions(bot);
  registerAllAdminToolsActions(bot);
  registerAllServerManagementActions(bot);
  registerAllBackupRestoreActions(bot);
}

module.exports = {
  registerAllActions,
  registerServiceActions,
  registerAdminActions,
  registerResellerActions,
  registerNavigationActions,
  registerAllTrialActions,
  registerAllServerEditActions,
  registerAllAdminToolsActions,
  registerAllServerManagementActions,
  registerAllBackupRestoreActions
};

