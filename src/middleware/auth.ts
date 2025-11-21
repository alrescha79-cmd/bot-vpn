/**
 * Authentication Middleware
 * Role-based access control for bot commands and actions
 */

const UserService = require('../services/user.service');
const config = require('../config');
const logger = require('../utils/logger');

export interface TelegrafContext {
  from: {
    id: number;
    username?: string;
    first_name?: string;
  };
  state: {
    user?: any;
  };
  reply: (text: string) => Promise<any>;
}

export type NextFunction = () => Promise<void>;

/**
 * Check if user is admin
 * @param {TelegrafContext} ctx - Telegraf context
 * @param {NextFunction} next - Next middleware
 */
export async function isAdmin(ctx: TelegrafContext, next: NextFunction): Promise<void> {
  const userId = String(ctx.from.id);
  
  if (!config.adminIds.includes(userId)) {
    await ctx.reply('⛔ Perintah ini hanya untuk admin.');
    return;
  }
  
  return next();
}

/**
 * Check if user is reseller
 * @param {TelegrafContext} ctx - Telegraf context
 * @param {NextFunction} next - Next middleware
 */
export async function isReseller(ctx: TelegrafContext, next: NextFunction): Promise<void> {
  try {
    const user = await UserService.getUserById(ctx.from.id);
    
    if (!user || user.role !== 'reseller') {
      await ctx.reply('⛔ Fitur ini hanya untuk reseller.');
      return;
    }
    
    // Pass user to next handler
    ctx.state.user = user;
    return next();
  } catch (error: any) {
    logger.error('Error in isReseller middleware:', error);
    await ctx.reply('❌ Terjadi kesalahan. Silakan coba lagi.');
  }
}

/**
 * Check if user is reseller or admin
 * @param {TelegrafContext} ctx - Telegraf context
 * @param {NextFunction} next - Next middleware
 */
export async function isResellerOrAdmin(ctx: TelegrafContext, next: NextFunction): Promise<void> {
  try {
    const userId = String(ctx.from.id);
    
    // Check if admin
    if (config.adminIds.includes(userId)) {
      return next();
    }
    
    // Check if reseller
    const user = await UserService.getUserById(ctx.from.id);
    if (user && user.role === 'reseller') {
      ctx.state.user = user;
      return next();
    }
    
    await ctx.reply('⛔ Fitur ini hanya untuk reseller dan admin.');
  } catch (error: any) {
    logger.error('Error in isResellerOrAdmin middleware:', error);
    await ctx.reply('❌ Terjadi kesalahan. Silakan coba lagi.');
  }
}

/**
 * Ensure user is registered
 * @param {TelegrafContext} ctx - Telegraf context
 * @param {NextFunction} next - Next middleware
 */
export async function ensureRegistered(ctx: TelegrafContext, next: NextFunction): Promise<void> {
  try {
    const { id: userId, username, first_name: firstName } = ctx.from;
    
    // Register or update user
    await UserService.registerOrUpdate(userId, username, firstName);
    
    return next();
  } catch (error: any) {
    logger.error('Error in ensureRegistered middleware:', error);
    await ctx.reply('❌ Gagal memproses permintaan. Silakan coba lagi.');
  }
}

/**
 * Rate limiting middleware (simple implementation)
 * @param {number} maxRequests - Max requests per time window
 * @param {number} windowMs - Time window in milliseconds
 */
export function rateLimit(maxRequests: number = 10, windowMs: number = 60000): (ctx: TelegrafContext, next: NextFunction) => Promise<void> {
  const userRequests = new Map<number, number[]>();

  return async (ctx: TelegrafContext, next: NextFunction): Promise<void> => {
    const userId = ctx.from.id;
    const now = Date.now();
    
    if (!userRequests.has(userId)) {
      userRequests.set(userId, []);
    }
    
    const requests = userRequests.get(userId)!;
    
    // Remove old requests outside the window
    const validRequests = requests.filter(time => now - time < windowMs);
    
    if (validRequests.length >= maxRequests) {
      await ctx.reply('⚠️ Terlalu banyak permintaan. Silakan tunggu sebentar.');
      return;
    }
    
    validRequests.push(now);
    userRequests.set(userId, validRequests);
    
    return next();
  };
}

module.exports = {
  isAdmin,
  isReseller,
  isResellerOrAdmin,
  ensureRegistered,
  rateLimit
};
