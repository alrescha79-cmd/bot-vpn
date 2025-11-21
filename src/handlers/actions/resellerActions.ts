
import type { BotContext, DatabaseUser, DatabaseServer } from "../../types";
/**
 * Reseller Actions Handler
 * Handles reseller panel actions
 * @module handlers/actions/resellerActions
 */

const { Markup } = require('telegraf');
const { dbGetAsync, dbAllAsync } = require('../../database/connection');
const logger = require('../../utils/logger');

/**
 * Handle reseller menu action
 */
function registerResellerMenuAction(bot) {
  bot.action('menu_reseller', async (ctx) => {
    const userId = ctx.from.id;

    try {
      const row = await dbGetAsync('SELECT role, saldo FROM users WHERE user_id = ?', [userId]);

      if (!row || row.role !== 'reseller') {
        return ctx.reply('❌ Kamu bukan reseller.');
      }

      const keyboard = {
        inline_keyboard: [
          [
            { text: '📊 Statistik riwayat', callback_data: 'reseller_riwayat' },
            { text: '📖 Cek Komisi', callback_data: 'reseller_komisi' }
          ],
          [
            { text: '📓 Export Komisi', callback_data: 'reseller_export' },
            { text: '🎓 Top All Time', callback_data: 'reseller_top_all' }
          ],
          [
            { text: '🏆 Top Mingguan', callback_data: 'reseller_top_weekly' }
          ],
          [
            { text: '💸 Transfer Saldo', callback_data: 'reseller_transfer' },
            { text: '📜 Log Transfer', callback_data: 'reseller_logtransfer' }
          ],
          [
            { text: '⬅️ Kembali', callback_data: 'send_main_menu' }
          ]
        ]
      };

      const message = `
💼 *Menu Reseller*

💰 Saldo Anda: *Rp${row.saldo.toLocaleString('id-ID')}*

Silakan pilih menu reseller:
      `.trim();

      await ctx.editMessageText(message, {
        parse_mode: 'Markdown',
        reply_markup: keyboard
      });
    } catch (err) {
      logger.error('❌ Error showing reseller menu:', err.message);
      ctx.reply('❌ Gagal menampilkan menu reseller.');
    }
  });
}

/**
 * Handle reseller commission check
 */
function registerResellerKomisiAction(bot) {
  bot.action('reseller_komisi', async (ctx) => {
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

      await ctx.reply(text, { parse_mode: 'Markdown' });
    } catch (err) {
      logger.error('❌ Failed to fetch commission data:', err.message);
      ctx.reply('❌ Gagal ambil data komisi.');
    }
  });
}

/**
 * Handle reseller history
 */
function registerResellerRiwayatAction(bot) {
  bot.action('reseller_riwayat', async (ctx) => {
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

      await ctx.reply(text, { parse_mode: 'Markdown' });
    } catch (err) {
      logger.error('❌ Failed to fetch reseller history:', err.message);
      ctx.reply('❌ Gagal ambil riwayat reseller.');
    }
  });
}

/**
 * Handle top resellers all time
 */
function registerResellerTopAllAction(bot) {
  bot.action('reseller_top_all', async (ctx) => {
    try {
      const rows = await dbAllAsync(`
        SELECT 
          u.user_id,
          u.username,
          u.first_name,
          COUNT(*) AS total_akun,
          SUM(rs.komisi) AS total_komisi
        FROM reseller_sales rs
        JOIN users u ON rs.reseller_id = u.user_id
        GROUP BY rs.reseller_id
        ORDER BY total_komisi DESC
        LIMIT 10
      `);

      if (!rows || rows.length === 0) {
        return ctx.reply('📭 Belum ada data reseller.');
      }

      const list = rows.map((r, i) => {
        const medal = i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : `${i + 1}.`;
        const name = r.username ? `@${r.username}` : r.first_name || 'User';
        return `${medal} ${name}\n   💰 Rp${r.total_komisi.toLocaleString('id-ID')} | 📊 ${r.total_akun} akun`;
      }).join('\n\n');

      const text = `🏆 *Top Reseller All Time*\n\n${list}`;

      await ctx.reply(text, { parse_mode: 'Markdown' });
    } catch (err) {
      logger.error('❌ Failed to fetch top resellers:', err.message);
      ctx.reply('❌ Gagal ambil data top reseller.');
    }
  });
}

/**
 * Handle top resellers weekly
 */
function registerResellerTopWeeklyAction(bot) {
  bot.action('reseller_top_weekly', async (ctx) => {
    try {
      const rows = await dbAllAsync(`
        SELECT 
          u.user_id,
          u.username,
          u.first_name,
          COUNT(*) AS total_akun,
          SUM(rs.komisi) AS total_komisi
        FROM reseller_sales rs
        JOIN users u ON rs.reseller_id = u.user_id
        WHERE rs.created_at >= datetime('now', '-7 days')
        GROUP BY rs.reseller_id
        ORDER BY total_komisi DESC
        LIMIT 10
      `);

      if (!rows || rows.length === 0) {
        return ctx.reply('📭 Belum ada data reseller minggu ini.');
      }

      const list = rows.map((r, i) => {
        const medal = i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : `${i + 1}.`;
        const name = r.username ? `@${r.username}` : r.first_name || 'User';
        return `${medal} ${name}\n   💰 Rp${r.total_komisi.toLocaleString('id-ID')} | 📊 ${r.total_akun} akun`;
      }).join('\n\n');

      const text = `🏆 *Top Reseller Mingguan*\n\n${list}`;

      await ctx.reply(text, { parse_mode: 'Markdown' });
    } catch (err) {
      logger.error('❌ Failed to fetch weekly top resellers:', err.message);
      ctx.reply('❌ Gagal ambil data top reseller mingguan.');
    }
  });
}

/**
 * Handle upgrade to reseller action
 */
function registerUpgradeToResellerAction(bot) {
  bot.action('upgrade_to_reseller', async (ctx) => {
    const userId = ctx.from.id;

    try {
      const user = await dbGetAsync('SELECT role, saldo FROM users WHERE user_id = ?', [userId]);

      if (!user) {
        return ctx.reply('❌ Akun tidak ditemukan.');
      }

      if (user.role === 'reseller' || user.role === 'admin') {
        return ctx.reply('✅ Anda sudah menjadi reseller.');
      }

      const upgradePrice = 50000;

      const message = `
⬆️ *Upgrade ke Reseller*

💰 Biaya Upgrade: *Rp${upgradePrice.toLocaleString('id-ID')}*
💳 Saldo Anda: *Rp${user.saldo.toLocaleString('id-ID')}*

Keuntungan menjadi reseller:
✅ Dapatkan komisi dari setiap penjualan
✅ Trial limit lebih banyak (10x/hari)
✅ Transfer saldo ke user lain
✅ Export laporan komisi

Upgrade sekarang?
      `.trim();

      await ctx.editMessageText(message, {
        parse_mode: 'Markdown',
        ...Markup.inlineKeyboard([
          [Markup.button.callback('✅ Ya, Upgrade', 'confirm_upgrade_reseller')],
          [Markup.button.callback('❌ Batal', 'send_main_menu')]
        ])
      });
    } catch (err) {
      logger.error('❌ Error showing upgrade menu:', err.message);
      ctx.reply('❌ Gagal menampilkan menu upgrade.');
    }
  });
}

/**
 * Register all reseller actions
 * @param {Object} bot - Telegraf bot instance
 */
function registerResellerActions(bot) {
  registerResellerMenuAction(bot);
  registerResellerKomisiAction(bot);
  registerResellerRiwayatAction(bot);
  registerResellerTopAllAction(bot);
  registerResellerTopWeeklyAction(bot);
  registerUpgradeToResellerAction(bot);

  logger.info('✅ Reseller actions registered');
}

module.exports = {
  registerResellerActions,
  registerResellerMenuAction,
  registerResellerKomisiAction,
  registerResellerRiwayatAction,
  registerResellerTopAllAction,
  registerResellerTopWeeklyAction,
  registerUpgradeToResellerAction
};
