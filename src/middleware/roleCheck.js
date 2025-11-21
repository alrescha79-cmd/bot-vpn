/**
 * Role Check Middleware
 * Authentication and authorization middleware for Telegram bot
 * @module middleware/roleCheck
 */

const { dbGet } = require('../infrastructure/database');
const logger = require('../utils/logger');
const config = require('../config');

/**
 * Check if user is admin (owner)
 * @param {number} userId - Telegram user ID
 * @returns {Promise<boolean>}
 */
async function isAdmin(userId) {
  // Check against config admin IDs
  const adminIds = config.ADMIN_IDS || [];
  if (adminIds.includes(userId)) {
    return true;
  }

  // Check database role
  try {
    const user = await dbGet('SELECT role FROM users WHERE user_id = ?', [userId]);
    return user && (user.role === 'admin' || user.role === 'owner');
  } catch (err) {
    logger.error('Error checking admin status:', err.message);
    return false;
  }
}

/**
 * Check if user is reseller or higher
 * @param {number} userId - Telegram user ID
 * @returns {Promise<boolean>}
 */
async function isReseller(userId) {
  // Admins are also resellers
  if (await isAdmin(userId)) {
    return true;
  }

  try {
    const user = await dbGet('SELECT role FROM users WHERE user_id = ?', [userId]);
    return user && (user.role === 'reseller' || user.role === 'admin' || user.role === 'owner');
  } catch (err) {
    logger.error('Error checking reseller status:', err.message);
    return false;
  }
}

/**
 * Check if user has specific role
 * @param {number} userId - Telegram user ID
 * @param {string} role - Role to check ('user', 'reseller', 'admin', 'owner')
 * @returns {Promise<boolean>}
 */
async function hasRole(userId, role) {
  try {
    const user = await dbGet('SELECT role FROM users WHERE user_id = ?', [userId]);
    return user && user.role === role;
  } catch (err) {
    logger.error('Error checking user role:', err.message);
    return false;
  }
}

/**
 * Get user role
 * @param {number} userId - Telegram user ID
 * @returns {Promise<string|null>} User role or null
 */
async function getUserRole(userId) {
  try {
    const user = await dbGet('SELECT role FROM users WHERE user_id = ?', [userId]);
    return user ? user.role : null;
  } catch (err) {
    logger.error('Error getting user role:', err.message);
    return null;
  }
}

/**
 * Middleware: Require admin role
 * Usage: bot.command('admin', requireAdmin, async (ctx) => {...})
 */
async function requireAdmin(ctx, next) {
  const userId = ctx.from.id;
  
  if (await isAdmin(userId)) {
    return next();
  }
  
  await ctx.reply('❌ Anda tidak memiliki akses ke perintah ini.');
  logger.warn(`Unauthorized admin access attempt by user ${userId}`);
}

/**
 * Middleware: Require reseller role or higher
 * Usage: bot.command('reseller', requireReseller, async (ctx) => {...})
 */
async function requireReseller(ctx, next) {
  const userId = ctx.from.id;
  
  if (await isReseller(userId)) {
    return next();
  }
  
  await ctx.reply('❌ Perintah ini hanya untuk reseller. Upgrade ke reseller untuk mengakses fitur ini.');
  logger.warn(`Unauthorized reseller access attempt by user ${userId}`);
}

/**
 * Middleware: Require specific role
 * @param {string} role - Required role
 * @returns {Function} Middleware function
 */
function requireRole(role) {
  return async (ctx, next) => {
    const userId = ctx.from.id;
    
    if (await hasRole(userId, role)) {
      return next();
    }
    
    await ctx.reply(`❌ Perintah ini memerlukan role: ${role}`);
    logger.warn(`Unauthorized ${role} access attempt by user ${userId}`);
  };
}

/**
 * Check if user exists in database
 * @param {number} userId - Telegram user ID
 * @returns {Promise<boolean>}
 */
async function userExists(userId) {
  try {
    const user = await dbGet('SELECT user_id FROM users WHERE user_id = ?', [userId]);
    return !!user;
  } catch (err) {
    logger.error('Error checking user existence:', err.message);
    return false;
  }
}

/**
 * Ensure user exists in database, create if not
 * @param {Object} ctx - Telegraf context
 * @returns {Promise<void>}
 */
async function ensureUser(ctx) {
  const userId = ctx.from.id;
  const username = ctx.from.username || null;
  const firstName = ctx.from.first_name || 'User';

  try {
    const { dbRun } = require('../infrastructure/database');
    await dbRun(`
      INSERT INTO users (user_id, username, first_name)
      VALUES (?, ?, ?)
      ON CONFLICT(user_id) DO UPDATE SET username = ?, first_name = ?
    `, [userId, username, firstName, username, firstName]);
  } catch (err) {
    logger.error('Error ensuring user exists:', err.message);
  }
}

/**
 * Middleware: Ensure user is registered
 * Usage: bot.use(ensureUserMiddleware)
 */
async function ensureUserMiddleware(ctx, next) {
  if (ctx.from && ctx.from.id) {
    await ensureUser(ctx);
  }
  return next();
}

module.exports = {
  isAdmin,
  isReseller,
  hasRole,
  getUserRole,
  requireAdmin,
  requireReseller,
  requireRole,
  userExists,
  ensureUser,
  ensureUserMiddleware
};
