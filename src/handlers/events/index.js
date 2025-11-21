/**
 * Events Index
 * Central export for all event handlers
 * @module handlers/events
 */

const { registerTextHandler } = require('./textHandler');
const { registerCallbackRouter } = require('./callbackRouter');

/**
 * Register all event handlers to the bot
 * @param {Object} bot - Telegraf bot instance
 */
function registerAllEvents(bot) {
  registerTextHandler(bot);
  registerCallbackRouter(bot);
}

module.exports = {
  registerAllEvents,
  registerTextHandler,
  registerCallbackRouter
};
