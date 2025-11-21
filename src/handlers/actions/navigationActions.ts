
import type { BotContext, DatabaseUser, DatabaseServer } from "../../types";
/**
 * Navigation Actions Handler
 * Handles navigation, menu callbacks, and utility actions
 * @module handlers/actions/navigationActions
 */

const { Markup } = require('telegraf');
const { dbGetAsync } = require('../../database/connection');
const { sendMainMenu } = require('../helpers/menuHelper');
const logger = require('../../utils/logger');

/**
 * Handle send_main_menu action
 */
function registerSendMainMenuAction(bot) {
  bot.action('send_main_menu', async (ctx) => {
    try {
      await sendMainMenu(ctx);
    } catch (err) {
      logger.error('❌ Error sending main menu:', err.message);
      await ctx.reply('❌ Gagal menampilkan menu utama.');
    }
  });
}

/**
 * Handle cek_saldo action
 */
function registerCekSaldoAction(bot) {
  bot.action('cek_saldo', async (ctx) => {
    const userId = ctx.from.id;

    try {
      const user = await dbGetAsync('SELECT saldo, role FROM users WHERE user_id = ?', [userId]);

      if (!user) {
        return ctx.reply('❌ Anda belum terdaftar. Ketik /start untuk memulai.');
      }

      const saldoFormatted = `Rp${user.saldo.toLocaleString('id-ID')}`;
      const roleEmoji = user.role === 'admin' ? '👑' : user.role === 'reseller' ? '💼' : '👤';

      await ctx.editMessageText(
        `${roleEmoji} *Informasi Saldo*\n\n` +
        `💰 Saldo Anda: *${saldoFormatted}*\n` +
        `📊 Role: *${user.role}*`,
        {
          parse_mode: 'Markdown',
          ...Markup.inlineKeyboard([
            [Markup.button.callback('💳 Top Up', 'topup_saldo')],
            [Markup.button.callback('🔙 Menu Utama', 'send_main_menu')]
          ])
        }
      );
    } catch (err) {
      logger.error('❌ Error fetching balance:', err.message);
      await ctx.reply('❌ Gagal mengambil data saldo.');
    }
  });
}

/**
 * Handle topup_saldo action
 */
function registerTopupSaldoAction(bot) {
  bot.action('topup_saldo', async (ctx) => {
    const message = `
💳 *Top Up Saldo*

Untuk melakukan top up, silakan transfer ke rekening berikut:

📱 *QRIS*
Scan QR code yang akan digenerate setelah Anda input jumlah.

💰 *Minimal Top Up:* Rp10.000

Masukkan jumlah top up yang diinginkan:
    `.trim();

    await ctx.editMessageText(message, {
      parse_mode: 'Markdown',
      ...Markup.inlineKeyboard([
        [
          Markup.button.callback('10K', 'topup_10000'),
          Markup.button.callback('20K', 'topup_20000')
        ],
        [
          Markup.button.callback('50K', 'topup_50000'),
          Markup.button.callback('100K', 'topup_100000')
        ],
        [
          Markup.button.callback('200K', 'topup_200000'),
          Markup.button.callback('500K', 'topup_500000')
        ],
        [Markup.button.callback('✏️ Input Manual', 'topup_manual')],
        [Markup.button.callback('🔙 Kembali', 'send_main_menu')]
      ])
    });
  });
}

/**
 * Handle pagination navigation
 * Format: navigate_{direction}_{context}_{offset}
 */
function registerPaginationActions(bot) {
  bot.action(/navigate_(next|prev)_(\w+)_(\d+)/, async (ctx) => {
    const [, direction, context, offset] = ctx.match;
    const newOffset = direction === 'next' 
      ? parseInt(offset) + 10 
      : Math.max(0, parseInt(offset) - 10);

    logger.info(`Pagination: ${context} ${direction} to offset ${newOffset}`);

    // TODO: Implement pagination logic based on context
    await ctx.answerCbQuery(`Navigating ${direction}...`);
  });
}

/**
 * Handle back button actions
 */
function registerBackActions(bot) {
  // Generic back actions
  const backMappings = {
    'back_to_admin': 'menu_adminreseller',
    'back_to_reseller': 'menu_reseller',
    'back_to_main': 'send_main_menu',
    'back_to_services': 'service_create'
  };

  Object.entries(backMappings).forEach(([action, target]) => {
    bot.action(action, async (ctx) => {
      await ctx.answerCbQuery();
      // Trigger the target action
      ctx.match = [target];
      await bot.handleUpdate({ ...ctx.update, callback_query: { ...ctx.callbackQuery, data: target } });
    });
  });
}

/**
 * Handle cancel actions
 */
function registerCancelActions(bot) {
  bot.action(/cancel_(.+)/, async (ctx) => {
    const [, operation] = ctx.match;
    
    await ctx.answerCbQuery('❌ Dibatalkan');
    await ctx.editMessageText(
      '❌ Operasi dibatalkan.',
      {
        parse_mode: 'Markdown',
        ...Markup.inlineKeyboard([
          [Markup.button.callback('🔙 Menu Utama', 'send_main_menu')]
        ])
      }
    );

    logger.info(`Operation cancelled: ${operation} by user ${ctx.from.id}`);
  });
}

/**
 * Handle confirm actions (generic)
 */
function registerConfirmActions(bot) {
  // These are placeholders - specific confirm actions should be in their respective modules
  bot.action(/confirm_(.+)/, async (ctx) => {
    const [, operation] = ctx.match;
    
    await ctx.answerCbQuery('⏳ Memproses...');
    logger.info(`Confirm action triggered: ${operation} by user ${ctx.from.id}`);
    
    // Specific confirmations should be handled in their respective action files
    await ctx.reply('⚠️ Konfirmasi tidak dikenali. Silakan coba lagi.');
  });
}

/**
 * Register all navigation actions
 * @param {Object} bot - Telegraf bot instance
 */
function registerNavigationActions(bot) {
  registerSendMainMenuAction(bot);
  registerCekSaldoAction(bot);
  registerTopupSaldoAction(bot);
  registerPaginationActions(bot);
  registerBackActions(bot);
  registerCancelActions(bot);
  registerConfirmActions(bot);

  logger.info('✅ Navigation actions registered');
}

module.exports = {
  registerNavigationActions,
  registerSendMainMenuAction,
  registerCekSaldoAction,
  registerTopupSaldoAction,
  registerPaginationActions,
  registerBackActions,
  registerCancelActions,
  registerConfirmActions
};
