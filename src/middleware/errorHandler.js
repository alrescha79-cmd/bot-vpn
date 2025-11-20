/**
 * Error Handler Middleware
 * Global error handling for bot
 */

const logger = require('../utils/logger');

/**
 * Global error handler middleware
 * @param {Error} error - Error object
 * @param {Object} ctx - Telegraf context
 */
async function errorHandler(error, ctx) {
  logger.error('Bot error:', error);
  
  try {
    // Send user-friendly error message
    const errorMessage = getErrorMessage(error);
    
    if (ctx && ctx.reply) {
      await ctx.reply(errorMessage);
    }
  } catch (replyError) {
    logger.error('Failed to send error message:', replyError);
  }
}

/**
 * Get user-friendly error message
 * @param {Error} error - Error object
 * @returns {string}
 */
function getErrorMessage(error) {
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
 * @param {Function} handler - Async handler function
 * @returns {Function}
 */
function asyncHandler(handler) {
  return async (ctx, next) => {
    try {
      await handler(ctx, next);
    } catch (error) {
      await errorHandler(error, ctx);
    }
  };
}

/**
 * Wrap all handlers with error handling
 * @param {Object} handlers - Object containing handler functions
 * @returns {Object}
 */
function wrapHandlers(handlers) {
  const wrapped = {};
  
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
