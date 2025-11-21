/**
 * Role Check Middleware
 * Authentication and authorization middleware for Telegram bot
 * @module middleware/roleCheck
 */

const { dbGet, dbRun } = require('../infrastructure/database');
const logger = require('../utils/logger');
const config = require('../config');

export interface TelegrafContext {
  from: {
    id: number;
    username?: string;
    first_name?: string;
  };
  reply: (text: string) => Promise<any>;
}

export type NextFunction = () => Promise<void>;

/**
 * Check if user is admin (owner)
 * @param {number} userId - Telegram user ID
 * @returns {Promise<boolean>}
 */
export async function isAdmin(userId: number): Promise<boolean> {
  // Check against config admin IDs
  const adminIds = config.ADMIN_IDS || [];
  if (adminIds.includes(userId)) {
    return true;
  }

  // Check database role
  try {
    const user = await dbGet('SELECT role FROM users WHERE user_id = ?', [userId]);
    return user && (user.role === 'admin' || user.role === 'owner');
  } catch (err: any) {
    logger.error('Error checking admin status:', err.message);
    return false;
  }
}

/**
 * Check if user is reseller or higher
 * @param {number} userId - Telegram user ID
 * @returns {Promise<boolean>}
 */
export async function isReseller(userId: number): Promise<boolean> {
  // Admins are also resellers
  if (await isAdmin(userId)) {
    return true;
  }

  try {
    const user = await dbGet('SELECT role FROM users WHERE user_id = ?', [userId]);
    return user && (user.role === 'reseller' || user.role === 'admin' || user.role === 'owner');
  } catch (err: any) {
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
export async function hasRole(userId: number, role: string): Promise<boolean> {
  try {
    const user = await dbGet('SELECT role FROM users WHERE user_id = ?', [userId]);
    return user && user.role === role;
  } catch (err: any) {
    logger.error('Error checking user role:', err.message);
    return false;
  }
}

/**
 * Get user role
 * @param {number} userId - Telegram user ID
 * @returns {Promise<string|null>} User role or null
 */
export async function getUserRole(userId: number): Promise<string | null> {
  try {
    const user = await dbGet('SELECT role FROM users WHERE user_id = ?', [userId]);
    return user ? user.role : null;
  } catch (err: any) {
    logger.error('Error getting user role:', err.message);
    return null;
  }
}

/**
 * Middleware: Require admin role
 * Usage: bot.command('admin', requireAdmin, async (ctx) => {...})
 */
export async function requireAdmin(ctx: TelegrafContext, next: NextFunction): Promise<void> {
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
export async function requireReseller(ctx: TelegrafContext, next: NextFunction): Promise<void> {
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
export function requireRole(role: string): (ctx: TelegrafContext, next: NextFunction) => Promise<void> {
  return async (ctx: TelegrafContext, next: NextFunction): Promise<void> => {
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
export async function userExists(userId: number): Promise<boolean> {
  try {
    const user = await dbGet('SELECT user_id FROM users WHERE user_id = ?', [userId]);
    return !!user;
  } catch (err: any) {
    logger.error('Error checking user existence:', err.message);
    return false;
  }
}

/**
 * Ensure user exists in database, create if not
 * @param {TelegrafContext} ctx - Telegraf context
 * @returns {Promise<void>}
 */
export async function ensureUser(ctx: TelegrafContext): Promise<void> {
  const userId = ctx.from.id;
  const username = ctx.from.username || null;
  const firstName = ctx.from.first_name || 'User';

  try {
    await dbRun(`
      INSERT INTO users (user_id, username, first_name)
      VALUES (?, ?, ?)
      ON CONFLICT(user_id) DO UPDATE SET username = ?, first_name = ?
    `, [userId, username, firstName, username, firstName]);
  } catch (err: any) {
    logger.error('Error ensuring user exists:', err.message);
  }
}

/**
 * Middleware: Ensure user is registered
 * Usage: bot.use(ensureUserMiddleware)
 */
export async function ensureUserMiddleware(ctx: TelegrafContext, next: NextFunction): Promise<void> {
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
