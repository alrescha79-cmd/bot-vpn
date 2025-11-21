/**
 * Error Handler Middleware
 * Global error handling for bot
 */

const logger = require('../utils/logger');

export interface TelegrafContext {
  reply?: (text: string) => Promise<any>;
}

export type Handler = (ctx: TelegrafContext, next?: () => Promise<void>) => Promise<void>;
export type NextFunction = () => Promise<void>;

/**
 * Global error handler middleware
 * @param {Error} error - Error object
 * @param {TelegrafContext} ctx - Telegraf context
 */
export async function errorHandler(error: Error, ctx: TelegrafContext): Promise<void> {
  logger.error('Bot error:', error);
  
  try {
    // Send user-friendly error message
    const errorMessage = getErrorMessage(error);
    
    if (ctx && ctx.reply) {
      await ctx.reply(errorMessage);
    }
  } catch (replyError: any) {
    logger.error('Failed to send error message:', replyError);
  }
}

/**
 * Get user-friendly error message
 * @param {Error} error - Error object
 * @returns {string}
 */
export function getErrorMessage(error: Error | null): string {
  if (!error) {
    return '❌ Terjadi kesalahan yang tidak diketahui.';
  }

  // Known error patterns
  if (error.message.includes('Insufficient balance')) {
    return '❌ Saldo tidak mencukupi.';
  }

  if (error.message.includes('timeout')) {
    return '❌ Koneksi ke server timeout. Silakan coba lagi.';
  }

  if (error.message.includes('ECONNREFUSED')) {
    return '❌ Tidak dapat terhubung ke server. Silakan coba lagi.';
  }

  if (error.message.includes('User not found')) {
    return '❌ User tidak ditemukan.';
  }

  if (error.message.includes('Server not found')) {
    return '❌ Server tidak ditemukan.';
  }

  if (error.message.includes('daily_limit_reached')) {
    return '❌ Batas trial harian sudah tercapai.';
  }

  // Generic error message
  return '❌ Terjadi kesalahan. Silakan coba lagi atau hubungi admin.';
}

/**
 * Try-catch wrapper for async handlers
 * @param {Handler} handler - Async handler function
 * @returns {Handler}
 */
export function asyncHandler(handler: Handler): Handler {
  return async (ctx: TelegrafContext, next?: NextFunction): Promise<void> => {
    try {
      await handler(ctx, next);
    } catch (error: any) {
      await errorHandler(error, ctx);
    }
  };
}

/**
 * Wrap all handlers with error handling
 * @param {Object} handlers - Object containing handler functions
 * @returns {Object}
 */
export function wrapHandlers(handlers: Record<string, any>): Record<string, any> {
  const wrapped: Record<string, any> = {};
  
  for (const [key, handler] of Object.entries(handlers)) {
    if (typeof handler === 'function') {
      wrapped[key] = asyncHandler(handler);
    } else {
      wrapped[key] = handler;
    }
  }
  
  return wrapped;
}

module.exports = {
  errorHandler,
  getErrorMessage,
  asyncHandler,
  wrapHandlers
};
