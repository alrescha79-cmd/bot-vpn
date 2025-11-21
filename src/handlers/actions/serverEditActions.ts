
import type { BotContext, DatabaseUser, DatabaseServer } from "../../types";
/**
 * @fileoverview Server Edit Actions Handler
 * Handles all server editing actions (price, limits, quota, etc.)
 * 
 * Architecture:
 * - State-based flow using userState global object
 * - Numeric keyboard for input
 * - Database updates with validation
 */

const { dbRunAsync, dbGetAsync } = require('../../database/connection');
const logger = require('../../utils/logger');
const { keyboard_nomor } = require('../../utils/keyboard');

/**
 * Register edit server price action
 */
function registerEditHargaAction(bot) {
  bot.action(/edit_harga_(\d+)/, async (ctx) => {
    const serverId = ctx.match[1];
    const userId = ctx.from.id;

    logger.info(`User ${userId} memilih untuk mengedit harga server dengan ID: ${serverId}`);

    // Set user state
    if (!global.userState) global.userState = {};
    global.userState[ctx.chat.id] = { step: 'edit_harga', serverId: serverId };

    await ctx.reply('💰 *Silakan masukkan harga server baru:*', {
      reply_markup: { inline_keyboard: keyboard_nomor() },
      parse_mode: 'Markdown'
    });
  });
}

/**
 * Register edit account creation limit action
 */
function registerEditBatasCreateAkunAction(bot) {
  bot.action(/edit_batas_create_akun_(\d+)/, async (ctx) => {
    const serverId = ctx.match[1];
    const userId = ctx.from.id;

    logger.info(`User ${userId} memilih untuk mengedit batas create akun server dengan ID: ${serverId}`);

    // Set user state
    if (!global.userState) global.userState = {};
    global.userState[ctx.chat.id] = { step: 'edit_batas_create_akun', serverId: serverId };

    await ctx.reply('📊 *Silakan masukkan batas create akun server baru:*', {
      reply_markup: { inline_keyboard: keyboard_nomor() },
      parse_mode: 'Markdown'
    });
  });
}

/**
 * Register edit total account creation action
 */
function registerEditTotalCreateAkunAction(bot) {
  bot.action(/edit_total_create_akun_(\d+)/, async (ctx) => {
    const serverId = ctx.match[1];
    const userId = ctx.from.id;

    logger.info(`User ${userId} memilih untuk mengedit total create akun server dengan ID: ${serverId}`);

    // Set user state
    if (!global.userState) global.userState = {};
    global.userState[ctx.chat.id] = { step: 'edit_total_create_akun', serverId: serverId };

    await ctx.reply('📊 *Silakan masukkan total create akun server baru:*', {
      reply_markup: { inline_keyboard: keyboard_nomor() },
      parse_mode: 'Markdown'
    });
  });
}

/**
 * Register edit IP limit action
 */
function registerEditLimitIPAction(bot) {
  bot.action(/edit_limit_ip_(\d+)/, async (ctx) => {
    const serverId = ctx.match[1];
    const userId = ctx.from.id;

    logger.info(`User ${userId} memilih untuk mengedit limit IP server dengan ID: ${serverId}`);

    // Set user state
    if (!global.userState) global.userState = {};
    global.userState[ctx.chat.id] = { step: 'edit_limit_ip', serverId: serverId };

    await ctx.reply('📊 *Silakan masukkan limit IP server baru:*', {
      reply_markup: { inline_keyboard: keyboard_nomor() },
      parse_mode: 'Markdown'
    });
  });
}

/**
 * Register edit quota action
 */
function registerEditQuotaAction(bot) {
  bot.action(/edit_quota_(\d+)/, async (ctx) => {
    const serverId = ctx.match[1];
    const userId = ctx.from.id;

    logger.info(`User ${userId} memilih untuk mengedit quota server dengan ID: ${serverId}`);

    // Set user state
    if (!global.userState) global.userState = {};
    global.userState[ctx.chat.id] = { step: 'edit_quota', serverId: serverId };

    await ctx.reply('📊 *Silakan masukkan quota server baru (GB):*', {
      reply_markup: { inline_keyboard: keyboard_nomor() },
      parse_mode: 'Markdown'
    });
  });
}

/**
 * Register server delete confirmation action
 */
function registerConfirmDeleteServerAction(bot) {
  bot.action(/^confirm_delete_server_(\d+)$/, async (ctx) => {
    const serverId = ctx.match[1];

    try {
      await ctx.answerCbQuery();

      // Delete server from database
      const result = await new Promise<any>((resolve, reject) => {
        global.db.run('DELETE FROM Server WHERE id = ?', [serverId], function (err) {
          if (err) {
            logger.error('Error deleting server:', err.message);
            return reject(err);
          }
          resolve({ changes: this.changes });
        });
      });

      if (result.changes === 0) {
        logger.info('Server tidak ditemukan');
        return ctx.reply('⚠️ *PERHATIAN! Server tidak ditemukan.*', { parse_mode: 'Markdown' });
      }

      logger.info(`Server dengan ID ${serverId} berhasil dihapus`);
      await ctx.reply('✅ *Server berhasil dihapus.*', { parse_mode: 'Markdown' });

    } catch (error) {
      logger.error('Kesalahan saat menghapus server:', error);
      await ctx.reply('❌ *GAGAL! Terjadi kesalahan saat memproses permintaan Anda. Silakan coba lagi nanti.*', { parse_mode: 'Markdown' });
    }
  });
}

/**
 * Register server detail view action
 */
function registerServerDetailAction(bot) {
  bot.action(/^server_detail_(\d+)$/, async (ctx) => {
    const serverId = ctx.match[1];

    try {
      await ctx.answerCbQuery();

      // Get server details
      const server = await dbGetAsync('SELECT * FROM Server WHERE id = ?', [serverId]);

      if (!server) {
        logger.info('⚠️ Server tidak ditemukan');
        return ctx.reply('⚠️ *PERHATIAN! Server tidak ditemukan.*', { parse_mode: 'Markdown' });
      }

      const serverDetails = `📋 *Detail Server* 📋\n\n` +
        `🌐 *Domain:* \`${server.domain}\`\n` +
        `🔑 *Auth:* \`${server.auth}\`\n` +
        `🏷️ *Nama Server:* \`${server.nama_server}\`\n` +
        `📊 *Quota:* \`${server.quota} GB\`\n` +
        `📶 *Limit IP:* \`${server.iplimit}\`\n` +
        `🔢 *Batas Create Akun:* \`${server.batas_create_akun}\`\n` +
        `📋 *Total Create Akun:* \`${server.total_create_akun}\`\n` +
        `💵 *Harga:* \`Rp ${server.harga}\`\n\n`;

      await ctx.reply(serverDetails, { parse_mode: 'Markdown' });

    } catch (error) {
      logger.error('⚠️ Kesalahan saat mengambil detail server:', error);
      await ctx.reply('⚠️ *Terjadi kesalahan saat mengambil detail server.*', { parse_mode: 'Markdown' });
    }
  });
}

/**
 * Register add balance to user action
 */
function registerAddSaldoUserAction(bot) {
  bot.action(/add_saldo_(\d+)/, async (ctx) => {
    const userId = ctx.match[1];

    logger.info(`Admin ${ctx.from.id} memilih untuk menambahkan saldo user dengan ID: ${userId}`);

    // Set user state
    if (!global.userState) global.userState = {};
    global.userState[ctx.chat.id] = { step: 'add_saldo', userId: userId };

    await ctx.reply('📊 *Silakan masukkan jumlah saldo yang ingin ditambahkan:*', {
      reply_markup: { inline_keyboard: keyboard_nomor() },
      parse_mode: 'Markdown'
    });
  });
}

/**
 * Register all server edit actions
 */
function registerAllServerEditActions(bot) {
  registerEditHargaAction(bot);
  registerEditBatasCreateAkunAction(bot);
  registerEditTotalCreateAkunAction(bot);
  registerEditLimitIPAction(bot);
  registerEditQuotaAction(bot);
  registerConfirmDeleteServerAction(bot);
  registerServerDetailAction(bot);
  registerAddSaldoUserAction(bot);

  logger.info('✅ Server edit actions registered (8 actions)');
}

module.exports = {
  registerAllServerEditActions,
  registerEditHargaAction,
  registerEditBatasCreateAkunAction,
  registerEditTotalCreateAkunAction,
  registerEditLimitIPAction,
  registerEditQuotaAction,
  registerConfirmDeleteServerAction,
  registerServerDetailAction,
  registerAddSaldoUserAction
};
