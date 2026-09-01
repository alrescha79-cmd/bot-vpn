
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
const { Markup } = require('telegraf');

/**
 * Register edit server price action
 */
function registerEditHargaAction(bot) {
  bot.action(/edit_harga_(\d+)/, async (ctx) => {
    const serverId = ctx.match[1];
    const userId = ctx.from.id;

    logger.info(`User ${userId} memilih untuk mengedit harga server dengan ID: ${serverId}`);

    // Get current server data
    const server = await dbGetAsync('SELECT * FROM Server WHERE id = ?', [serverId]);

    if (!server) {
      return ctx.reply('⚠️ *Server tidak ditemukan.*', { parse_mode: 'Markdown' });
    }

    // Set user state
    if (!global.userState) global.userState = {};
    global.userState[ctx.chat.id] = { step: 'edit_harga', serverId: serverId };

    await ctx.reply(
      `🌐 *Server dipilih:* ${server.nama_server}\n` +
      `Harga saat ini: *Rp ${server.harga.toLocaleString('id-ID')}/hari*\n\n` +
      `💰 *Silakan ketik harga server baru (Rp/hari):*\n` +
      `_Contoh: 1000 atau 15000_`,
      {
        reply_markup: {
          inline_keyboard: [[{ text: '❌ Batal', callback_data: 'cancel_edit_server' }]]
        },
        parse_mode: 'Markdown'
      }
    );
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

    // Get current server data
    const server = await dbGetAsync('SELECT * FROM Server WHERE id = ?', [serverId]);

    if (!server) {
      return ctx.reply('⚠️ *Server tidak ditemukan.*', { parse_mode: 'Markdown' });
    }

    // Set user state
    if (!global.userState) global.userState = {};
    global.userState[ctx.chat.id] = { step: 'edit_batas_create_akun', serverId: serverId };

    await ctx.reply(
      `🌐 *Server dipilih:* ${server.nama_server}\n` +
      `Batas Create Akun saat ini: *${server.batas_create_akun}*\n\n` +
      `🔢 *Silakan ketik batas create akun baru:*\n` +
      `_Contoh: 100 atau 500_`,
      {
        reply_markup: {
          inline_keyboard: [[{ text: '❌ Batal', callback_data: 'cancel_edit_server' }]]
        },
        parse_mode: 'Markdown'
      }
    );
  });
}

/**
 * Register view total account creation action (display only)
 */
function registerEditTotalCreateAkunAction(bot) {
  bot.action(/edit_total_create_akun_(\d+)/, async (ctx) => {
    const serverId = ctx.match[1];
    const userId = ctx.from.id;

    logger.info(`User ${userId} melihat total create akun server dengan ID: ${serverId}`);

    // Get current server data
    const server = await dbGetAsync('SELECT * FROM Server WHERE id = ?', [serverId]);

    if (!server) {
      return ctx.reply('⚠️ *Server tidak ditemukan.*', { parse_mode: 'Markdown' });
    }

    // Display total create - read only
    await ctx.reply(
      `📊 *Total Create Akun Server*\n\n` +
      `🌐 *Server:* ${server.nama_server}\n` +
      `📈 *Total Akun Dibuat:* ${server.total_create_akun}\n` +
      `🔢 *Batas Maksimal:* ${server.batas_create_akun}\n\n` +
      `ℹ️ _Total create akun dihitung otomatis setiap kali akun baru dibuat. Tidak dapat diedit manual._`,
      { parse_mode: 'Markdown' }
    );
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

    // Get current server data
    const server = await dbGetAsync('SELECT * FROM Server WHERE id = ?', [serverId]);

    if (!server) {
      return ctx.reply('⚠️ *Server tidak ditemukan.*', { parse_mode: 'Markdown' });
    }

    // Set user state
    if (!global.userState) global.userState = {};
    global.userState[ctx.chat.id] = { step: 'edit_limit_ip', serverId: serverId };

    await ctx.reply(
      `🌐 *Server dipilih:* ${server.nama_server}\n` +
      `Limit IP saat ini: *${server.iplimit}*\n\n` +
      `📶 *Silakan ketik Limit IP (Device) server baru:*\n` +
      `_Contoh: 1, 2, atau 0 untuk unlimited_`,
      {
        reply_markup: {
          inline_keyboard: [[{ text: '❌ Batal', callback_data: 'cancel_edit_server' }]]
        },
        parse_mode: 'Markdown'
      }
    );
  });
}

/**
 * Register edit quota action
 */
function registerEditQuotaAction(bot) {
  bot.action(/edit_quota_(\d+)/, async (ctx) => {
    const serverId = ctx.match[1];
    const userId = ctx.from.id;

    logger.info(`User ${userId} memilih untuk mengedit kuota server dengan ID: ${serverId}`);

    // Get current server data
    const server = await dbGetAsync('SELECT * FROM Server WHERE id = ?', [serverId]);

    if (!server) {
      return ctx.reply('⚠️ *Server tidak ditemukan.*', { parse_mode: 'Markdown' });
    }

    // Set user state
    if (!global.userState) global.userState = {};
    global.userState[ctx.chat.id] = { step: 'edit_quota', serverId: serverId };

    await ctx.reply(
      `🌐 *Server dipilih:* ${server.nama_server}\n` +
      `Kuota saat ini: *${server.quota} GB*\n\n` +
      `📊 *Silakan ketik kuota server baru (GB):*\n` +
      `_Contoh: 100, 500, atau 0 untuk unlimited_`,
      {
        reply_markup: {
          inline_keyboard: [[{ text: '❌ Batal', callback_data: 'cancel_edit_server' }]]
        },
        parse_mode: 'Markdown'
      }
    );
  });
}

/**
 * Register server delete confirmation action
 */
function registerConfirmDeleteServerAction(bot) {
  // Step 1: Confirmation prompt
  bot.action(/^ask_delete_server_(\d+)$/, async (ctx) => {
    const serverId = ctx.match[1];

    try {
      await ctx.answerCbQuery();
      const server = await dbGetAsync('SELECT * FROM Server WHERE id = ?', [serverId]);

      if (!server) {
        return ctx.reply('⚠️ *Server tidak ditemukan.*', { parse_mode: 'Markdown' });
      }

      const confirmMessage = 
        `⚠️ *KONFIRMASI HAPUS SERVER*\n\n` +
        `🖥️ *Nama Server:* \`${server.nama_server}\`\n` +
        `🌐 *Host/Domain:* \`${server.domain}\`\n` +
        `👤 *User SSH:* \`${server.user_ssh || 'root'}\`\n` +
        `🔌 *Port:* \`${server.port || 22}\`\n\n` +
        `🚨 *PERINGATAN: Apakah Anda yakin ingin menghapus server ini dari bot?*\n` +
        `_Data server ini tidak dapat dikembalikan setelah dihapus._`;

      await ctx.reply(confirmMessage, {
        parse_mode: 'Markdown',
        reply_markup: {
          inline_keyboard: [
            [{ text: '🗑️ Ya, Hapus Server', callback_data: `confirm_delete_server_${serverId}` }],
            [{ text: '❌ Batal', callback_data: 'deleteserver' }]
          ]
        }
      });
    } catch (error) {
      logger.error('Kesalahan saat konfirmasi hapus server:', error);
      await ctx.reply('❌ *Terjadi kesalahan saat memproses permintaan.*', { parse_mode: 'Markdown' });
    }
  });

  // Step 2: Execute server deletion
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
        `👤 *User SSH:* \`${server.user_ssh || 'root'}\`\n` +
        `🔌 *Port SSH:* \`${server.port || 22}\`\n` +
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

    await ctx.reply(
      `📊 *Tambah Saldo Pengguna*\n\n` +
      `User ID: \`${userId}\`\n\n` +
      `💵 *Silakan ketik jumlah saldo yang ingin ditambahkan (Rp):*\n` +
      `_Contoh: 10000 atau 50000_`,
      {
        reply_markup: {
          inline_keyboard: [[{ text: '❌ Batal', callback_data: 'cancel_add_saldo' }]]
        },
        parse_mode: 'Markdown'
      }
    );
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
