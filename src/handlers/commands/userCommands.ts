
import type { BotContext, DatabaseUser, DatabaseServer } from "../../types";
/**
 * User Commands Handler
 * Handles basic user commands like /start, /menu, /saldo, /me
 * @module handlers/commands/userCommands
 */

const { dbGetAsync, dbRunAsync } = require('../../database/connection');
const { ensureUser } = require('../../middleware/roleCheck');
const { escapeMarkdownV2 } = require('../../utils/markdown');
const { sendMainMenu } = require('../helpers/menuHelper');
const logger = require('../../utils/logger');

/**
 * Handle /start and /menu commands
 * @param {Object} bot - Telegraf bot instance
 */
function registerStartCommand(bot) {
  bot.command(['start', 'menu'], async (ctx) => {
    const userId = ctx.from.id;
    const username = ctx.from.username || null;
    const firstName = ctx.from.first_name || 'User';

    try {
      // Check if user exists
      const existingUser = await dbGetAsync('SELECT id FROM users WHERE user_id = ?', [userId]);
      
      if (existingUser) {
        // Update existing user
        await dbRunAsync(
          'UPDATE users SET username = ?, first_name = ? WHERE user_id = ?',
          [username, firstName, userId]
        );
        logger.info(`✅ User ${userId} updated`);
      } else {
        // Insert new user
        await dbRunAsync(
          'INSERT INTO users (user_id, username, first_name, saldo, role, has_trial) VALUES (?, ?, ?, 0, \'user\', 0)',
          [userId, username, firstName]
        );
        logger.info(`✅ User ${userId} registered`);
      }
    } catch (err) {
      logger.error('❌ Error saving user:', err);
      return ctx.reply('❌ Gagal menyimpan data user. Silakan coba lagi.');
    }

    await sendMainMenu(ctx);
  });
}

/**
 * Handle /saldo command
 * @param {Object} bot - Telegraf bot instance
 */
function registerSaldoCommand(bot) {
  bot.command('saldo', async (ctx) => {
    const userId = ctx.from.id;

    try {
      const user = await dbGetAsync('SELECT saldo, role FROM users WHERE user_id = ?', [userId]);

      if (!user) {
        return ctx.reply('❌ Anda belum terdaftar. Ketik /start untuk memulai.');
      }

      const saldoFormatted = `Rp${user.saldo.toLocaleString('id-ID')}`;
      const roleEmoji = user.role === 'admin' ? '👑' : user.role === 'reseller' ? '💼' : '👤';

      await ctx.reply(
        `${roleEmoji} *Informasi Saldo*\n\n` +
        `💰 Saldo Anda: *${saldoFormatted}*\n` +
        `📊 Role: *${user.role}*`,
        { parse_mode: 'Markdown' }
      );
    } catch (err) {
      logger.error('❌ Error fetching balance:', err.message);
      await ctx.reply('❌ Gagal mengambil data saldo.');
    }
  });
}

/**
 * Handle /me command
 * @param {Object} bot - Telegraf bot instance
 */
function registerMeCommand(bot) {
  bot.command('me', async (ctx) => {
    const userId = ctx.from.id;

    try {
      const user = await dbGetAsync(`
        SELECT user_id, username, first_name, saldo, role, has_trial 
        FROM users 
        WHERE user_id = ?
      `, [userId]);

      if (!user) {
        return ctx.reply('❌ Anda belum terdaftar. Ketik /start untuk memulai.');
      }

      const roleEmoji = {
        admin: '👑',
        owner: '👑',
        reseller: '💼',
        user: '👤'
      }[user.role] || '👤';

      const trialStatus = user.has_trial ? '✅ Sudah menggunakan' : '⭕ Belum digunakan';
      
      const info = `
${roleEmoji} *Profil Akun Anda*

🆔 *User ID:* \`${user.user_id}\`
👤 *Username:* ${user.username ? `@${user.username}` : 'Tidak ada'}
📛 *Nama:* ${escapeMarkdownV2(user.first_name || 'User')}
💰 *Saldo:* *Rp${user.saldo.toLocaleString('id-ID')}*
📊 *Role:* *${user.role}*
🎫 *Trial:* ${trialStatus}
      `.trim();

      await ctx.reply(info, { parse_mode: 'MarkdownV2' });
    } catch (err) {
      logger.error('❌ Error fetching user info:', err.message);
      await ctx.reply('❌ Gagal mengambil informasi akun.');
    }
  });
}

/**
 * Handle /invoice_last command
 * @param {Object} bot - Telegraf bot instance
 * @param {Array<string>} adminIds - List of admin IDs
 */
function registerInvoiceLastCommand(bot, adminIds) {
  bot.command('invoice_last', async (ctx) => {
    const userId = String(ctx.from.id);
    const isAdmin = adminIds.includes(userId);
    const input = ctx.message.text.split(' ')[1];

    let targetUsername = input?.replace('@', '').trim();
    let query, params;

    if (isAdmin && targetUsername) {
      query = `
        SELECT * FROM invoice_log
        WHERE username = ?
        ORDER BY created_at DESC
        LIMIT 1
      `;
      params = [targetUsername];
    } else {
      query = `
        SELECT * FROM invoice_log
        WHERE user_id = ?
        ORDER BY created_at DESC
        LIMIT 1
      `;
      params = [userId];
    }

    try {
      const row = await dbGetAsync(query, params);

      if (!row) {
        return ctx.reply('📭 Tidak ditemukan invoice terakhir.');
      }

      const invoice = `
🧾 *INVOICE TERAKHIR*
━━━━━━━━━━━━━━━━━━━━━━
👤 *User:* ${row.username}
📦 *Layanan:* *${row.layanan.toUpperCase()}*
🔐 *Username:* \`${row.akun}\`
📅 *Durasi:* *${row.hari} hari*
💸 *Harga:* *Rp${row.harga.toLocaleString('id-ID')}*
${row.komisi ? `💰 *Komisi:* *Rp${row.komisi.toLocaleString('id-ID')}*` : ''}
🕒 *Waktu:* ${new Date(row.created_at).toLocaleString('id-ID')}
━━━━━━━━━━━━━━━━━━━━━━
      `.trim();

      ctx.reply(invoice, { parse_mode: 'Markdown' });
    } catch (err) {
      logger.error('❌ Failed to fetch last invoice:', err.message);
      ctx.reply('❌ Gagal mengambil data invoice.');
    }
  });
}

/**
 * Register all user commands
 * @param {Object} bot - Telegraf bot instance
 * @param {Array<string>} adminIds - List of admin IDs
 */
function registerUserCommands(bot, adminIds = []) {
  registerStartCommand(bot);
  registerSaldoCommand(bot);
  registerMeCommand(bot);
  registerInvoiceLastCommand(bot, adminIds);
  
  logger.info('✅ User commands registered');
}

module.exports = {
  registerUserCommands,
  registerStartCommand,
  registerSaldoCommand,
  registerMeCommand,
  registerInvoiceLastCommand
};
