
import type { BotContext, DatabaseUser, DatabaseServer } from "../../types";
/**
 * Events Index
 * Central export for all event handlers
 * @module handlers/events
 */

const { registerTextHandler, registerPhotoHandler } = require('./textHandler');
const { registerCallbackRouter } = require('./callbackRouter');

/**
 * Register all event handlers to the bot
 * @param {Object} bot - Telegraf bot instance
 */
function registerAllEvents(bot) {
  registerTextHandler(bot);
  registerPhotoHandler(bot);
  registerCallbackRouter(bot);
}

module.exports = {
  registerAllEvents,
  registerTextHandler,
  registerPhotoHandler,
  registerCallbackRouter
};
