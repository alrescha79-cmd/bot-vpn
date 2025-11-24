
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
 * Handle akunku action (replaces cek_saldo)
 */
function registerAkunkuAction(bot) {
  bot.action(['akunku', 'cek_saldo'], async (ctx) => {
    const userId = ctx.from.id;

    try {
      const user = await dbGetAsync('SELECT saldo, role FROM users WHERE user_id = ?', [userId]);

      if (!user) {
        return ctx.reply('❌ Anda belum terdaftar. Ketik /start untuk memulai.');
      }

      // Get user's accounts
      const { getAccountsByOwner, getAllAccounts } = require('../../repositories/accountRepository');
      let accounts = [];
      
      try {
        if (user.role === 'admin' || user.role === 'owner') {
          accounts = await getAllAccounts('active');
        } else {
          accounts = await getAccountsByOwner(userId, 'active');
        }
      } catch (accountErr) {
        // Tabel accounts mungkin belum ada - tampilkan pesan fallback
        logger.warn('⚠️ Could not fetch accounts (table may not exist yet):', accountErr);
        accounts = [];
      }

      const saldoFormatted = `Rp${user.saldo.toLocaleString('id-ID')}`;
      const roleEmoji = user.role === 'admin' ? '👑' : user.role === 'reseller' ? '💼' : '👤';

      let accountList = '';
      if (accounts.length > 0) {
        accountList = '\n\n📋 *Akun Aktif:*\n';
        accounts.slice(0, 10).forEach((acc, idx) => {
          const expDate = acc.expired_at ? new Date(acc.expired_at).toLocaleDateString('id-ID') : 'N/A';
          accountList += `${idx + 1}. \`${acc.username}\` - ${acc.protocol} - Exp: ${expDate}\n`;
        });
        
        if (accounts.length > 10) {
          accountList += `\n_...dan ${accounts.length - 10} akun lainnya_`;
        }
      } else {
        accountList = '\n\n📭 Belum ada akun aktif.';
      }

      await ctx.editMessageText(
        `👤 *Akun Saya*\n\n` +
        `💰 Sisa saldo: *${saldoFormatted}*` +
        accountList,
        {
          parse_mode: 'Markdown',
          ...Markup.inlineKeyboard([
            [Markup.button.callback('📋 Detail Akun', 'akunku_detail')],
            [Markup.button.callback('🗑 Hapus Akun', 'akunku_delete')],
            [Markup.button.callback('💳 Top Up', 'topup_saldo')],
            [Markup.button.callback('🔙 Menu Utama', 'send_main_menu')]
          ])
        }
      );
    } catch (err) {
      logger.error('❌ Error fetching akunku data:', err);
      await ctx.reply('❌ Gagal mengambil data akun. ' + (err?.message || 'Unknown error'));
    }
  });
}

/**
 * Handle detail account action
 */
function registerAkunkuDetailAction(bot) {
  bot.action('akunku_detail', async (ctx) => {
    const userId = ctx.from.id;

    try {
      const user = await dbGetAsync('SELECT role FROM users WHERE user_id = ?', [userId]);
      if (!user) {
        return ctx.reply('❌ Anda belum terdaftar.');
      }

      // Get user's accounts
      const { getAccountsByOwner, getAllAccounts } = require('../../repositories/accountRepository');
      let accounts = [];
      
      try {
        if (user.role === 'admin' || user.role === 'owner') {
          accounts = await getAllAccounts('active');
        } else {
          accounts = await getAccountsByOwner(userId, 'active');
        }
      } catch (accountErr) {
        logger.warn('⚠️ Failed to fetch accounts (table might not exist yet):', accountErr);
        accounts = [];
      }

      if (accounts.length === 0) {
        return ctx.editMessageText(
          '📭 Tidak ada akun untuk ditampilkan.',
          {
            parse_mode: 'Markdown',
            ...Markup.inlineKeyboard([
              [Markup.button.callback('🔙 Kembali', 'akunku')]
            ])
          }
        );
      }

      // Create buttons for each account
      const buttons = accounts.slice(0, 20).map(acc => {
        return [Markup.button.callback(`${acc.username} (${acc.protocol})`, `akunku_view_${acc.id}`)];
      });
      
      buttons.push([Markup.button.callback('🔙 Kembali', 'akunku')]);

      await ctx.editMessageText(
        '📋 *Pilih akun untuk melihat detail:*',
        {
          parse_mode: 'Markdown',
          ...Markup.inlineKeyboard(buttons)
        }
      );
    } catch (err) {
      logger.error('❌ Error in akunku detail:', err);
      await ctx.reply('❌ Gagal menampilkan detail akun. ' + (err?.message || 'Unknown error'));
    }
  });
}

/**
 * Handle view specific account
 */
function registerAkunkuViewAccountAction(bot) {
  bot.action(/^akunku_view_(.+)$/, async (ctx) => {
    const accountId = ctx.match[1];
    const userId = ctx.from.id;

    try {
      const { getAccountById } = require('../../repositories/accountRepository');
      const user = await dbGetAsync('SELECT role FROM users WHERE user_id = ?', [userId]);
      const account = await getAccountById(accountId);

      if (!account) {
        return ctx.reply('❌ Akun tidak ditemukan.');
      }

      // Check permission
      if (user.role !== 'admin' && user.role !== 'owner' && account.owner_user_id !== userId) {
        return ctx.reply('⛔ Anda tidak memiliki akses ke akun ini.');
      }

      const expDate = account.expired_at ? new Date(account.expired_at).toLocaleString('id-ID') : 'N/A';
      const createdDate = account.created_at ? new Date(account.created_at).toLocaleString('id-ID') : 'N/A';
      
      const detailText = `
✅ *Detail Akun*

📌 *Username:* \`${account.username}\`
🔐 *Protokol:* ${account.protocol}
🌐 *Server:* ${account.server}
⏳ *Dibuat:* ${createdDate}
📅 *Expired:* ${expDate}
📊 *Status:* ${account.status === 'active' ? '✅ Aktif' : '❌ Expired'}

━━━━━━━━━━━━━━━━━
*Raw Response:*
\`\`\`
${account.raw_response ? account.raw_response.substring(0, 2000) : 'N/A'}
\`\`\`
      `.trim();

      await ctx.editMessageText(detailText, {
        parse_mode: 'Markdown',
        ...Markup.inlineKeyboard([
          [Markup.button.callback('🔙 Kembali', 'akunku_detail')]
        ])
      });
    } catch (err) {
      logger.error('❌ Error viewing account:', err);
      await ctx.reply('❌ Gagal menampilkan detail akun. ' + (err?.message || 'Unknown error'));
    }
  });
}

/**
 * Handle delete account action
 */
function registerAkunkuDeleteAction(bot) {
  bot.action('akunku_delete', async (ctx) => {
    const userId = ctx.from.id;

    try {
      const user = await dbGetAsync('SELECT role FROM users WHERE user_id = ?', [userId]);
      if (!user) {
        return ctx.reply('❌ Anda belum terdaftar.');
      }

      // Get user's accounts
      const { getAccountsByOwner, getAllAccounts } = require('../../repositories/accountRepository');
      let accounts = [];
      
      try {
        if (user.role === 'admin' || user.role === 'owner') {
          accounts = await getAllAccounts();
        } else {
          accounts = await getAccountsByOwner(userId);
        }
      } catch (accountErr) {
        logger.warn('⚠️ Failed to fetch accounts (table might not exist yet):', accountErr);
        accounts = [];
      }

      if (accounts.length === 0) {
        return ctx.editMessageText(
          '📭 Tidak ada akun untuk dihapus.',
          {
            parse_mode: 'Markdown',
            ...Markup.inlineKeyboard([
              [Markup.button.callback('🔙 Kembali', 'akunku')]
            ])
          }
        );
      }

      // Create buttons for each account
      const buttons = accounts.slice(0, 20).map(acc => {
        return [Markup.button.callback(`❌ ${acc.username} (${acc.protocol})`, `akunku_confirm_delete_${acc.id}`)];
      });
      
      buttons.push([Markup.button.callback('🔙 Kembali', 'akunku')]);

      await ctx.editMessageText(
        '🗑 *Pilih akun yang ingin dihapus:*\n\n⚠️ _Hanya akan menghapus dari database, tidak dari server._',
        {
          parse_mode: 'Markdown',
          ...Markup.inlineKeyboard(buttons)
        }
      );
    } catch (err) {
      logger.error('❌ Error in akunku delete:', err);
      await ctx.reply('❌ Gagal menampilkan daftar akun. ' + (err?.message || 'Unknown error'));
    }
  });
}

/**
 * Handle confirm delete account
 */
function registerAkunkuConfirmDeleteAction(bot) {
  bot.action(/^akunku_confirm_delete_(.+)$/, async (ctx) => {
    const accountId = ctx.match[1];
    const userId = ctx.from.id;

    try {
      const { getAccountById, deleteAccountById } = require('../../repositories/accountRepository');
      const user = await dbGetAsync('SELECT role FROM users WHERE user_id = ?', [userId]);
      const account = await getAccountById(accountId);

      if (!account) {
        return ctx.reply('❌ Akun tidak ditemukan.');
      }

      // Delete account
      await deleteAccountById(accountId, userId, user.role);

      await ctx.editMessageText(
        `✅ *Akun berhasil dihapus dari database*\n\n` +
        `Username: \`${account.username}\`\n` +
        `Protokol: ${account.protocol}`,
        {
          parse_mode: 'Markdown',
          ...Markup.inlineKeyboard([
            [Markup.button.callback('🔙 Menu Akunku', 'akunku')]
          ])
        }
      );
    } catch (err) {
      logger.error('❌ Error deleting account:', err);
      await ctx.reply('❌ Gagal menghapus akun: ' + (err?.message || 'Unknown error'));
    }
  });
}

/**
 * Handle cek_saldo action (legacy - redirects to akunku)
 */
function registerCekSaldoAction(bot) {
  // Legacy handler - maintained for backward compatibility
  // Now handled by registerAkunkuAction above
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
 * NOTE: This is a fallback handler - specific confirm actions should be handled in their respective modules
 * and registered BEFORE this generic handler to avoid conflicts.
 */
function registerConfirmActions(bot) {
  // Generic handler - will only catch confirm_* that aren't already handled
  // Specific handlers like confirm_delete_server_* should be registered in serverEditActions
  bot.action(/confirm_(?!delete_server_|resetdb)(.+)/, async (ctx) => {
    const operation = ctx.match[0].replace('confirm_', '');
    
    await ctx.answerCbQuery('⏳ Memproses...');
    logger.info(`Generic confirm action triggered: ${operation} by user ${ctx.from.id}`);
    
    // This is a fallback - specific confirmations should be handled in their respective action files
    await ctx.reply('⚠️ Konfirmasi tidak dikenali. Silakan coba lagi.');
  });
}

/**
 * Register all navigation actions
 * @param {Object} bot - Telegraf bot instance
 */
function registerNavigationActions(bot) {
  registerSendMainMenuAction(bot);
  registerAkunkuAction(bot);
  registerAkunkuDetailAction(bot);
  registerAkunkuViewAccountAction(bot);
  registerAkunkuDeleteAction(bot);
  registerAkunkuConfirmDeleteAction(bot);
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
  registerAkunkuAction,
  registerAkunkuDetailAction,
  registerAkunkuViewAccountAction,
  registerAkunkuDeleteAction,
  registerAkunkuConfirmDeleteAction,
  registerCekSaldoAction,
  registerTopupSaldoAction,
  registerPaginationActions,
  registerBackActions,
  registerCancelActions,
  registerConfirmActions
};
