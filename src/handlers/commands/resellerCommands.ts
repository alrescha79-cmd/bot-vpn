
import type { BotContext, DatabaseUser, DatabaseServer } from "../../types";
/**
 * Reseller Commands Handler
 * Handles reseller-specific commands
 * @module handlers/commands/resellerCommands
 */

const fs = require('fs');
const { dbGetAsync, dbAllAsync } = require('../../database/connection');
const { isReseller } = require('../../middleware/roleCheck');
const logger = require('../../utils/logger');

/**
 * Handle /komisi command
 * @param {Object} bot - Telegraf bot instance
 */
function registerKomisiCommand(bot) {
  bot.command('komisi', async (ctx) => {
    const userId = ctx.from.id;

    try {
      const user = await dbGetAsync('SELECT role, reseller_level FROM users WHERE user_id = ?', [userId]);
      
      if (!user || user.role !== 'reseller') {
        return ctx.reply('❌ Kamu bukan reseller.');
      }

      const summary = await dbGetAsync(
        'SELECT COUNT(*) AS total_akun, SUM(komisi) AS total_komisi FROM reseller_sales WHERE reseller_id = ?',
        [userId]
      );

      const rows = await dbAllAsync(
        'SELECT akun_type, username, komisi, created_at FROM reseller_sales WHERE reseller_id = ? ORDER BY created_at DESC LIMIT 5',
        [userId]
      );

      const level = user.reseller_level ? user.reseller_level.toUpperCase() : 'SILVER';

      const list = rows.map((r, i) =>
        `🔹 ${r.akun_type.toUpperCase()} - ${r.username} (+${r.komisi}) 🕒 ${r.created_at}`
      ).join('\n');

      const text = `💰 *Statistik Komisi Reseller*\n\n` +
        `🎖️ Level: ${level}\n` +
        `🧑‍💻 Total Akun Terjual: ${summary.total_akun || 0}\n` +
        `💸 Total Komisi: Rp${summary.total_komisi || 0}\n\n` +
        `📜 *Transaksi Terbaru:*\n${list || 'Belum ada transaksi'}`;

      ctx.reply(text, { parse_mode: 'Markdown' });
    } catch (err) {
      logger.error('❌ Failed to fetch commission data:', err.message);
      ctx.reply('❌ Gagal ambil data komisi.');
    }
  });
}

/**
 * Handle /logtransfer command
 * @param {Object} bot - Telegraf bot instance
 */
function registerLogTransferCommand(bot) {
  bot.command('logtransfer', async (ctx) => {
    const userId = ctx.from.id;

    try {
      const user = await dbGetAsync('SELECT role FROM users WHERE user_id = ?', [userId]);
      
      if (!user || user.role !== 'reseller') {
        return ctx.reply('❌ Kamu bukan reseller.');
      }

      const rows = await dbAllAsync(
        `SELECT * FROM saldo_transfers WHERE from_id = ? ORDER BY created_at DESC LIMIT 5`,
        [userId]
      );

      if (!rows || rows.length === 0) {
        return ctx.reply('📭 Belum ada log transfer.');
      }

      const list = rows.map(r =>
        `🔁 Rp${r.amount} ke \`${r.to_id}\` - 🕒 ${r.created_at}`
      ).join('\n');

      ctx.reply(`📜 *Riwayat Transfer Saldo:*\n\n${list}`, { parse_mode: 'Markdown' });
    } catch (err) {
      logger.error('❌ Failed to fetch transfer log:', err.message);
      ctx.reply('❌ Gagal ambil log transfer.');
    }
  });
}

/**
 * Handle /exportkomisi command
 * @param {Object} bot - Telegraf bot instance
 */
function registerExportKomisiCommand(bot) {
  bot.command('exportkomisi', async (ctx) => {
    const userId = ctx.from.id;

    try {
      const user = await dbGetAsync('SELECT role FROM users WHERE user_id = ?', [userId]);
      
      if (!user || user.role !== 'reseller') {
        return ctx.reply('❌ Kamu bukan reseller.');
      }

      const rows = await dbAllAsync(
        'SELECT akun_type, username, komisi, created_at FROM reseller_sales WHERE reseller_id = ? ORDER BY created_at DESC LIMIT 20',
        [userId]
      );

      if (!rows || rows.length === 0) {
        return ctx.reply('❌ Tidak ada data komisi untuk diekspor.');
      }

      const now = new Date().toLocaleString('id-ID');
      let content = `===== LAPORAN KOMISI RESELLER =====\n\n`;
      content += `🧑‍💻 Reseller ID : ${userId}\n📅 Tanggal Export: ${now}\n\n`;
      content += `#  | Akun Type | Username   | Komisi | Tanggal\n`;
      content += `--------------------------------------------------\n`;

      rows.forEach((r, i) => {
        content += `${i + 1}  | ${r.akun_type.toUpperCase()}     | ${r.username.padEnd(10)} | ${r.komisi}     | ${r.created_at}\n`;
      });

      const filename = `komisi_${userId}.txt`;
      fs.writeFileSync(filename, content);

      await ctx.replyWithDocument(
        { source: filename, filename },
        { caption: '📁 Laporan Komisi Terbaru' }
      );

      // Cleanup file after sending
      setTimeout(() => {
        if (fs.existsSync(filename)) {
          fs.unlinkSync(filename);
        }
      }, 5000);
    } catch (err) {
      logger.error('❌ Failed to export commission:', err.message);
      ctx.reply('❌ Gagal mengekspor data komisi.');
    }
  });
}

/**
 * Handle /riwayatreseller command
 * @param {Object} bot - Telegraf bot instance
 */
function registerRiwayatResellerCommand(bot) {
  bot.command('riwayatreseller', async (ctx) => {
    const userId = ctx.from.id;

    try {
      const user = await dbGetAsync('SELECT role FROM users WHERE user_id = ?', [userId]);
      
      if (!user || user.role !== 'reseller') {
        return ctx.reply('❌ Kamu bukan reseller.');
      }

      const rows = await dbAllAsync(
        `SELECT akun_type, username, komisi, created_at 
         FROM reseller_sales 
         WHERE reseller_id = ? 
         ORDER BY created_at DESC 
         LIMIT 10`,
        [userId]
      );

      if (!rows || rows.length === 0) {
        return ctx.reply('📭 Belum ada riwayat penjualan.');
      }

      const list = rows.map((r, i) =>
        `${i + 1}. ${r.akun_type.toUpperCase()} | ${r.username} | +Rp${r.komisi} | ${r.created_at}`
      ).join('\n');

      const text = `📊 *Riwayat Penjualan Reseller*\n\n${list}`;

      ctx.reply(text, { parse_mode: 'Markdown' });
    } catch (err) {
      logger.error('❌ Failed to fetch reseller history:', err.message);
      ctx.reply('❌ Gagal ambil riwayat reseller.');
    }
  });
}

/**
 * Handle /transfer command (initiate transfer process)
 * @param {Object} bot - Telegraf bot instance
 */
function registerTransferCommand(bot) {
  bot.command('transfer', async (ctx) => {
    const userId = ctx.from.id;

    try {
      const user = await dbGetAsync('SELECT role, saldo FROM users WHERE user_id = ?', [userId]);
      
      if (!user || user.role !== 'reseller') {
        return ctx.reply('❌ Fitur transfer hanya untuk reseller.');
      }

      const text = `
💸 *Transfer Saldo*

💰 Saldo Anda: Rp${user.saldo.toLocaleString('id-ID')}

Untuk melakukan transfer, klik tombol di bawah atau gunakan menu reseller.
      `.trim();

      const { Markup } = require('telegraf');
      await ctx.reply(text, {
        parse_mode: 'Markdown',
        ...Markup.inlineKeyboard([
          [Markup.button.callback('💸 Transfer Saldo', 'reseller_transfer')],
          [Markup.button.callback('🔙 Menu Reseller', 'menu_reseller')]
        ])
      });
    } catch (err) {
      logger.error('❌ Error showing transfer menu:', err.message);
      ctx.reply('❌ Gagal menampilkan menu transfer.');
    }
  });
}

/**
 * Register all reseller commands
 * @param {Object} bot - Telegraf bot instance
 */
function registerResellerCommands(bot) {
  registerKomisiCommand(bot);
  registerLogTransferCommand(bot);
  registerExportKomisiCommand(bot);
  registerRiwayatResellerCommand(bot);
  registerTransferCommand(bot);
  
  logger.info('✅ Reseller commands registered');
}

module.exports = {
  registerResellerCommands,
  registerKomisiCommand,
  registerLogTransferCommand,
  registerExportKomisiCommand,
  registerRiwayatResellerCommand,
  registerTransferCommand
};
