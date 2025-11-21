
import type { BotContext, DatabaseUser, DatabaseServer } from "../../types";
/**
 * Admin Actions Handler
 * Handles admin panel actions and server management
 * @module handlers/actions/adminActions
 */

const { Markup } = require('telegraf');
const { dbGetAsync, dbAllAsync, dbRunAsync } = require('../../database/connection');
const { escapeMarkdownV2 } = require('../../utils/markdown');
const logger = require('../../utils/logger');
const config = require('../../config');

/**
 * Handle admin main menu action
 */
function registerAdminMenuAction(bot) {
  bot.action(['admin', 'menu_adminreseller'], async (ctx) => {
    const userId = String(ctx.from.id);

    try {
      const user = await dbGetAsync('SELECT role FROM users WHERE user_id = ?', [userId]);

      if ((!user || user.role !== 'admin') && !config.adminIds.includes(userId)) {
        return ctx.reply('🚫 Kamu tidak memiliki izin.');
      }

      const keyboard = {
        inline_keyboard: [
          [{ text: '🖥️ Menu Server', callback_data: 'admin_server_menu' }],
          [{ text: '⚙️ Menu Sistem', callback_data: 'admin_system_menu' }],
          [{ text: '⬅️ Kembali', callback_data: 'send_main_menu' }]
        ]
      };

      const content = `
👑 *Menu Admin Panel*

🗓️ *${new Date().toLocaleDateString('id-ID', {
        weekday: 'long', year: 'numeric', month: 'long', day: 'numeric'
      })}*
🕒 *${new Date().toLocaleTimeString('id-ID')}*

📌 Silakan pilih Layanan di bawah ini:
      `.trim();

      await ctx.editMessageText(content, {
        parse_mode: 'Markdown',
        reply_markup: keyboard
      });
    } catch (err) {
      logger.error('❌ Failed to show admin menu:', err.message);
      await ctx.reply('❌ Gagal menampilkan menu admin.');
    }
  });
}

/**
 * Handle server menu action
 */
function registerServerMenuAction(bot) {
  bot.action('admin_server_menu', async (ctx) => {
    const keyboardServer = {
      inline_keyboard: [
        [
          { text: '➕ Tambah Server', callback_data: 'addserver' },
          { text: '❌ Hapus Server', callback_data: 'deleteserver' }
        ],
        [
          { text: '💲 Edit Harga', callback_data: 'editserver_harga' },
          { text: '📝 Edit Nama', callback_data: 'nama_server_edit' }
        ],
        [
          { text: '🌐 Edit Domain', callback_data: 'editserver_domain' },
          { text: '🔑 Edit Auth', callback_data: 'editserver_auth' }
        ],
        [
          { text: '📊 Edit Quota', callback_data: 'editserver_quota' },
          { text: '📶 Edit Limit Ip', callback_data: 'editserver_limit_ip' }
        ],
        [
          { text: '💵 Tambah Saldo', callback_data: 'addsaldo_user' },
          { text: 'ℹ️ Detail Server', callback_data: 'detailserver' }
        ],
        [
          { text: '🔢 Batas Create', callback_data: 'editserver_batas_create_akun' },
          { text: '🔢 Total Create', callback_data: 'editserver_total_create_akun' }
        ],
        [
          { text: '📋 List Server', callback_data: 'listserver' },
          { text: '♻️ Reset Server', callback_data: 'resetdb' }
        ],
        [{ text: '⬅️ Kembali', callback_data: 'menu_adminreseller' }]
      ]
    };

    const message = `
🛠️ *Menu Admin - Server*

Silakan pilih manajemen server!!!
    `.trim();

    try {
      await ctx.editMessageText(message, {
        parse_mode: 'Markdown',
        reply_markup: keyboardServer
      });
    } catch {
      await ctx.reply(message, {
        parse_mode: 'Markdown',
        reply_markup: keyboardServer
      });
    }
  });
}

/**
 * Handle system menu action
 */
function registerSystemMenuAction(bot) {
  bot.action('admin_system_menu', async (ctx) => {
    const keyboardSystem = {
      inline_keyboard: [
        [
          { text: '📊 Statistik Global', callback_data: 'admin_stats' },
          { text: '👥 List Pengguna', callback_data: 'admin_listuser' }
        ],
        [
          { text: '📢 Broadcast', callback_data: 'admin_broadcast' },
          { text: '💾 Backup DB', callback_data: 'admin_backup_db' }
        ],
        [
          { text: '♻️ Restore DB', callback_data: 'admin_restore2_db' },
          { text: '🗃️ All Backup', callback_data: 'admin_restore_all' }
        ],
        [
          { text: '⬆️ Up Reseller', callback_data: 'admin_promote_reseller' },
          { text: '⬇️ Down Reseller', callback_data: 'admin_downgrade_reseller' }
        ],
        [
          { text: '🎚️ Ubah Level', callback_data: 'admin_ubah_level' },
          { text: '👑 List Reseller', callback_data: 'admin_listreseller' }
        ],
        [
          { text: '♻️ Reset Komisi', callback_data: 'admin_resetkomisi' },
          { text: '♻️ Reset Trial', callback_data: 'admin_reset_trial' }
        ],
        [
          { text: '💰 Lihat Top Up', callback_data: 'admin_view_topup' }
        ],
        [{ text: '⬅️ Kembali', callback_data: 'menu_adminreseller' }]
      ]
    };

    const message = `
⚙️ *Menu Admin - Sistem*

Manajemen sistem dan pengguna:
    `.trim();

    try {
      await ctx.editMessageText(message, {
        parse_mode: 'Markdown',
        reply_markup: keyboardSystem
      });
    } catch {
      await ctx.reply(message, {
        parse_mode: 'Markdown',
        reply_markup: keyboardSystem
      });
    }
  });
}

/**
 * Handle list users action
 */
function registerListUsersAction(bot) {
  bot.action('admin_listuser', async (ctx) => {
    const userId = String(ctx.from.id);
    
    if (!config.adminIds.includes(userId)) {
      return ctx.reply('🚫 Kamu tidak memiliki izin.');
    }

    try {
      const rows = await dbAllAsync('SELECT user_id, username, role, saldo FROM users LIMIT 20');

      if (!rows || rows.length === 0) {
        return ctx.reply('📭 Tidak ada pengguna terdaftar.');
      }

      const list = rows.map((row, i) => {
        const mention = row.username
          ? `@${escapeMarkdownV2(row.username)}`
          : `ID: \`${escapeMarkdownV2(String(row.user_id))}\``;

        return `🔹 ${mention}\n*Role*: ${escapeMarkdownV2(row.role)}\n*Saldo*: Rp${escapeMarkdownV2(row.saldo.toLocaleString('id-ID'))}`;
      }).join('\n\n');

      const text = `👥 *List Pengguna _max 20_:*\n\n${list}`;

      await ctx.reply(text, {
        parse_mode: 'MarkdownV2'
      });

    } catch (err) {
      logger.error('❌ Failed to fetch user list:', err.message);
      ctx.reply('❌ Gagal mengambil daftar pengguna.');
    }
  });
}

/**
 * Handle list servers action
 */
function registerListServersAction(bot) {
  bot.action('listserver', async (ctx) => {
    try {
      const rows = await dbAllAsync('SELECT * FROM Server ORDER BY id');

      if (!rows || rows.length === 0) {
        return ctx.reply('📭 Tidak ada server terdaftar.');
      }

      const list = rows.map((row, i) => {
        return `${i + 1}. *${row.nama_server}*\n` +
          `   🌐 Domain  : ${row.domain}\n` +
          `   🔑 Auth    : ${row.auth}\n` +
          `   🌍 IP Limit: ${row.iplimit}\n` +
          `   📦 Harga   : Rp${row.harga.toLocaleString('id-ID')}\n` +
          `   🧮 Total   : ${row.total_create_akun}`;
      }).join('\n──────────────\n');

      const msg = `📄 *List Server Tersimpan:*\n\n${list}`;
      
      await ctx.reply(msg, { parse_mode: 'Markdown' });
    } catch (err) {
      logger.error('❌ Failed to fetch server list:', err.message);
      ctx.reply('❌ Gagal mengambil daftar server.');
    }
  });
}

/**
 * Handle admin stats action
 */
function registerAdminStatsAction(bot) {
  bot.action('admin_stats', async (ctx) => {
    const userId = String(ctx.from.id);
    
    if (!config.adminIds.includes(userId)) {
      return ctx.reply('🚫 Kamu tidak memiliki izin.');
    }

    try {
      const [jumlahUser, jumlahReseller, jumlahServer, totalSaldo] = await Promise.all([
        dbGetAsync('SELECT COUNT(*) AS count FROM users'),
        dbGetAsync("SELECT COUNT(*) AS count FROM users WHERE role = 'reseller'"),
        dbGetAsync('SELECT COUNT(*) AS count FROM Server'),
        dbGetAsync('SELECT SUM(saldo) AS total FROM users')
      ]);

      const replyText = `
📊 *Statistik Sistem:*

👥 Total Pengguna : *${jumlahUser.count}*
👑 Total Reseller : *${jumlahReseller.count}*
🖥️ Total Server   : *${jumlahServer.count}*
💰 Total Saldo     : *Rp${(totalSaldo.total || 0).toLocaleString('id-ID')}*
      `.trim();

      await ctx.reply(replyText, { parse_mode: 'Markdown' });
    } catch (err) {
      logger.error('❌ Failed to fetch admin stats:', err.message);
      await ctx.reply('❌ Gagal mengambil statistik.');
    }
  });
}

/**
 * Register all admin actions
 * @param {Object} bot - Telegraf bot instance
 */
function registerAdminActions(bot) {
  registerAdminMenuAction(bot);
  registerServerMenuAction(bot);
  registerSystemMenuAction(bot);
  registerListUsersAction(bot);
  registerListServersAction(bot);
  registerAdminStatsAction(bot);

  logger.info('✅ Admin actions registered');
}

module.exports = {
  registerAdminActions,
  registerAdminMenuAction,
  registerServerMenuAction,
  registerSystemMenuAction,
  registerListUsersAction,
  registerListServersAction,
  registerAdminStatsAction
};
