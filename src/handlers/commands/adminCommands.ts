
import type { BotContext, DatabaseUser, DatabaseServer } from "../../types";
/**
 * Admin Commands Handler
 * Handles admin-only commands
 * @module handlers/commands/adminCommands
 */

const fs = require('fs');
const path = require('path');
const { dbGetAsync, dbAllAsync, dbRunAsync } = require('../../database/connection');
const { requireAdmin } = require('../../middleware/roleCheck');
const { sendAdminMenu } = require('../helpers/menuHelper');
const logger = require('../../utils/logger');

/**
 * Handle /admin command
 * @param {Object} bot - Telegraf bot instance
 * @param {Array<string>} adminIds - List of admin IDs
 */
function registerAdminCommand(bot, adminIds) {
  bot.command('admin', async (ctx) => {
    const userId = ctx.from.id;
    logger.info(`🔐 Admin access request from ${userId}`);

    if (!adminIds.includes(String(userId))) {
      return ctx.reply('🚫 Anda tidak memiliki izin untuk mengakses menu admin.');
    }

    await sendAdminMenu(ctx);
  });
}

/**
 * Handle /statadmin command
 * @param {Object} bot - Telegraf bot instance
 * @param {Array<string>} adminIds - List of admin IDs
 */
function registerStatAdminCommand(bot, adminIds) {
  bot.command('statadmin', async (ctx) => {
    const userId = String(ctx.from.id);

    if (!adminIds.includes(userId)) {
      return ctx.reply('⚠️ Anda tidak memiliki izin untuk menggunakan perintah ini.');
    }

    try {
      const [jumlahUser, jumlahAkun, jumlahReseller, jumlahServer, totalSaldo] = await Promise.all([
        dbGetAsync('SELECT COUNT(*) AS count FROM users'),
        dbGetAsync('SELECT COUNT(*) AS count FROM akun_aktif'),
        dbGetAsync("SELECT COUNT(*) AS count FROM users WHERE role = 'reseller'"),
        dbGetAsync('SELECT COUNT(*) AS count FROM Server'),
        dbGetAsync('SELECT SUM(saldo) AS total FROM users')
      ]);

      const replyText = `
📊 *Statistik Sistem*

👥 Total Pengguna     : *${jumlahUser.count}*
🆔 Total Akun Aktif     : *${jumlahAkun.count}*
👑 Total Reseller         : *${jumlahReseller.count}*
🖥 Total Server            : *${jumlahServer.count}*
💰 Total Saldo              : *Rp${(totalSaldo.total || 0).toLocaleString('id-ID')}*
      `.trim();

      await ctx.reply(replyText, { parse_mode: 'Markdown' });
    } catch (err) {
      logger.error('❌ Failed to fetch admin stats:', err.message);
      await ctx.reply('❌ Gagal mengambil statistik.');
    }
  });
}

/**
 * Handle /cleardummy command
 * @param {Object} bot - Telegraf bot instance
 * @param {Array<string>} adminIds - List of admin IDs
 */
function registerClearDummyCommand(bot, adminIds) {
  bot.command('cleardummy', async (ctx) => {
    if (!adminIds.includes(String(ctx.from.id))) return;

    try {
      const result = await dbRunAsync("DELETE FROM reseller_sales WHERE username = 'testakun'");
      ctx.reply(`🧹 Berhasil hapus ${result.changes} data dummy (username: testakun).`);
    } catch (err) {
      logger.error('❌ Failed to delete dummy data:', err.message);
      ctx.reply('❌ Gagal hapus data dummy.');
    }
  });
}

/**
 * Handle /send_backup command
 * @param {Object} bot - Telegraf bot instance
 */
function registerSendBackupCommand(bot) {
  bot.command('send_backup', async (ctx) => {
    const input = ctx.message.text.split(' ');
    const filename = input[1];

    if (!filename) {
      return ctx.reply('❗ Format salah.\nContoh: `/send_backup backup_2025-06-10T21-30-00.enc`', { parse_mode: 'Markdown' });
    }

    const filePath = path.join(process.cwd(), 'restore', filename);

    if (!fs.existsSync(filePath)) {
      return ctx.reply(`❌ File \`${filename}\` tidak ditemukan di folder restore.`, { parse_mode: 'Markdown' });
    }

    try {
      await ctx.replyWithDocument({ source: filePath, filename });
    } catch (err) {
      logger.error('❌ Failed to send backup file:', err.message);
      ctx.reply('❌ Gagal mengirim file.');
    }
  });
}

/**
 * Handle /list_backup command
 * @param {Object} bot - Telegraf bot instance
 */
function registerListBackupCommand(bot) {
  bot.command('list_backup', (ctx) => {
    const folderPath = path.join(process.cwd(), 'restore');

    if (!fs.existsSync(folderPath)) {
      return ctx.reply('📂 Folder `restore/` belum ada.');
    }

    const files = fs.readdirSync(folderPath)
      .filter(file => file.endsWith('.enc') || file.endsWith('.sql') || file.endsWith('.db'));

    if (files.length === 0) {
      return ctx.reply('📭 Tidak ada file backup ditemukan di folder `restore/`.');
    }

    const message = files
      .sort((a, b) => fs.statSync(path.join(folderPath, b)).mtime - fs.statSync(path.join(folderPath, a)).mtime)
      .map(file => {
        const stats = fs.statSync(path.join(folderPath, file));
        const sizeMB = (stats.size / 1024 / 1024).toFixed(2);
        return `📄 *${file}* — \`${sizeMB} MB\``;
      })
      .join('\n');

    ctx.reply(`📦 *Daftar File Backup:*\n\n${message}`, { parse_mode: 'Markdown' });
  });
}

/**
 * Handle /cancel_restore command
 * @param {Object} bot - Telegraf bot instance
 */
function registerCancelRestoreCommand(bot) {
  bot.command('cancel_restore', (ctx) => {
    if (ctx.session?.restoreMode) {
      ctx.session.restoreMode = null;
      return ctx.reply('❎ Mode restore telah *dibatalkan*.', { parse_mode: 'Markdown' });
    }

    ctx.reply('ℹ️ Tidak ada mode restore yang sedang aktif.');
  });
}

/**
 * Handle /export_log command
 * @param {Object} bot - Telegraf bot instance
 * @param {string} ownerId - Owner user ID
 */
function registerExportLogCommand(bot, ownerId) {
  bot.command('export_log', async (ctx) => {
    const userId = ctx.from.id;
    if (`${userId}` !== `${ownerId}`) {
      return ctx.reply('❌ Akses ditolak.');
    }

    const filename = `/tmp/transactions-${Date.now()}.csv`;

    try {
      const rows = await dbAllAsync('SELECT * FROM transactions ORDER BY created_at DESC');
      
      if (!rows || rows.length === 0) {
        return ctx.reply('❌ Tidak ada data transaksi.');
      }

      const headers = Object.keys(rows[0]).join(',') + '\n';
      const content = rows.map(r => Object.values(r).join(',')).join('\n');

      fs.writeFileSync(filename, headers + content);

      await ctx.replyWithDocument({ source: filename });

      // Cleanup file after sending
      setTimeout(() => {
        if (fs.existsSync(filename)) {
          fs.unlinkSync(filename);
        }
      }, 5000);
    } catch (err) {
      logger.error('❌ Failed to export log:', err.message);
      ctx.reply('❌ Gagal mengekspor data.');
    }
  });
}

/**
 * Handle /promotereseller command
 * @param {Object} bot - Telegraf bot instance
 * @param {Array<string>} adminIds - List of admin IDs
 */
function registerPromoteResellerCommand(bot, adminIds) {
  bot.command('promotereseller', async (ctx) => {
    if (!adminIds.includes(String(ctx.from.id))) {
      return ctx.reply('🚫 Anda tidak memiliki izin untuk mengakses menu admin.');
    }

    const args = ctx.message.text.split(' ');
    if (args.length !== 2) {
      return ctx.reply('❗ Format: /promotereseller <user_id>');
    }

    const targetUserId = parseInt(args[1]);
    if (isNaN(targetUserId)) {
      return ctx.reply('❌ user_id harus berupa angka.');
    }

    try {
      const user = await dbGetAsync('SELECT role FROM users WHERE user_id = ?', [targetUserId]);
      
      if (!user) {
        return ctx.reply(`❌ User dengan ID ${targetUserId} tidak ditemukan.`);
      }

      if (user.role === 'reseller' || user.role === 'admin') {
        return ctx.reply(`⚠️ User ${targetUserId} sudah merupakan ${user.role}.`);
      }

      await dbRunAsync(`UPDATE users SET role = 'reseller' WHERE user_id = ?`, [targetUserId]);

      logger.info(`✅ User ${targetUserId} promoted to reseller by admin ${ctx.from.id}`);
      ctx.reply(`✅ User ${targetUserId} telah dipromosikan menjadi reseller.`);
    } catch (err) {
      logger.error('❌ Failed to promote reseller:', err.message);
      ctx.reply('❌ Gagal mempromosikan user.');
    }
  });
}

/**
 * Register all admin commands
 * @param {Object} bot - Telegraf bot instance
 * @param {Array<string>} adminIds - List of admin IDs
 * @param {string} ownerId - Owner user ID
 */
function registerAdminCommands(bot, adminIds = [], ownerId = null) {
  registerAdminCommand(bot, adminIds);
  registerStatAdminCommand(bot, adminIds);
  registerClearDummyCommand(bot, adminIds);
  registerSendBackupCommand(bot);
  registerListBackupCommand(bot);
  registerCancelRestoreCommand(bot);
  registerExportLogCommand(bot, ownerId);
  registerPromoteResellerCommand(bot, adminIds);
  
  logger.info('✅ Admin commands registered');
}

module.exports = {
  registerAdminCommands,
  registerAdminCommand,
  registerStatAdminCommand,
  registerClearDummyCommand,
  registerSendBackupCommand,
  registerListBackupCommand,
  registerCancelRestoreCommand,
  registerExportLogCommand,
  registerPromoteResellerCommand
};
