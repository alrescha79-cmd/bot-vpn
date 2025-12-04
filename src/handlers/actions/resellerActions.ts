
import type { BotContext, DatabaseUser, DatabaseServer } from "../../types";
/**
 * Reseller Actions Handler
 * Handles reseller panel actions
 * @module handlers/actions/resellerActions
 */

const { Markup } = require('telegraf');
const { dbGetAsync, dbAllAsync, dbRunAsync } = require('../../database/connection');
const logger = require('../../utils/logger');

// State management for transfer process
const transferStates = new Map();

/**
 * Handle reseller menu action
 */
function registerResellerMenuAction(bot) {
  bot.action('menu_reseller', async (ctx) => {
    const userId = ctx.from.id;

    try {
      const row = await dbGetAsync('SELECT role, saldo FROM users WHERE user_id = ?', [userId]);

      if (!row || (row.role !== 'reseller' && row.role !== 'admin' && row.role !== 'owner')) {
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

      if (!user || (user.role !== 'reseller' && user.role !== 'admin' && user.role !== 'owner')) {
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

      if (!user || (user.role !== 'reseller' && user.role !== 'admin' && user.role !== 'owner')) {
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
 * Handle confirm upgrade to reseller
 */
function registerConfirmUpgradeResellerAction(bot) {
  bot.action('confirm_upgrade_reseller', async (ctx) => {
    const userId = ctx.from.id;
    const { dbRunAsync } = require('../../database/connection');

    try {
      const user = await dbGetAsync('SELECT role, saldo, username FROM users WHERE user_id = ?', [userId]);

      if (!user) {
        return ctx.reply('❌ Akun tidak ditemukan.');
      }

      if (user.role === 'reseller' || user.role === 'admin' || user.role === 'owner') {
        return ctx.editMessageText('✅ Anda sudah menjadi reseller.', {
          parse_mode: 'Markdown',
          ...Markup.inlineKeyboard([
            [Markup.button.callback('🔙 Menu Utama', 'send_main_menu')]
          ])
        });
      }

      const upgradePrice = 50000;

      if (user.saldo < upgradePrice) {
        return ctx.editMessageText(
          `❌ *Saldo Tidak Mencukupi*\n\n` +
          `Saldo Anda: Rp${user.saldo.toLocaleString('id-ID')}\n` +
          `Biaya Upgrade: Rp${upgradePrice.toLocaleString('id-ID')}\n\n` +
          `Silakan top up terlebih dahulu.`,
          {
            parse_mode: 'Markdown',
            ...Markup.inlineKeyboard([
              [Markup.button.callback('💳 Top Up', 'topup_saldo')],
              [Markup.button.callback('🔙 Menu Utama', 'send_main_menu')]
            ])
          }
        );
      }

      // Deduct balance and upgrade role
      await dbRunAsync('UPDATE users SET saldo = saldo - ?, role = ?, reseller_level = ? WHERE user_id = ?', 
        [upgradePrice, 'reseller', 'silver', userId]);

      // Log upgrade
      await dbRunAsync(`
        INSERT INTO reseller_upgrade_log (user_id, username, amount, level, created_at)
        VALUES (?, ?, ?, 'silver', datetime('now'))
      `, [userId, user.username || ctx.from.first_name, upgradePrice]);

      // Log transaction
      await dbRunAsync(`
        INSERT INTO transactions (user_id, type, amount, description, created_at)
        VALUES (?, 'upgrade', ?, 'Upgrade ke Reseller', datetime('now'))
      `, [userId, -upgradePrice]);

      await ctx.editMessageText(
        `✅ *Selamat! Akun Anda berhasil di-upgrade menjadi Reseller.*\n\n` +
        `🎉 Anda sekarang dapat:\n` +
        `• Dapatkan komisi dari setiap penjualan\n` +
        `• Trial limit lebih banyak (10x/hari)\n` +
        `• Transfer saldo ke user lain\n` +
        `• Export laporan komisi\n\n` +
        `Silakan mulai membuat akun premium!`,
        {
          parse_mode: 'Markdown',
          ...Markup.inlineKeyboard([
            [Markup.button.callback('💼 Menu Reseller', 'menu_reseller')],
            [Markup.button.callback('🔙 Menu Utama', 'send_main_menu')]
          ])
        }
      );

      logger.info(`✅ User ${userId} upgraded to reseller`);
    } catch (err) {
      logger.error('❌ Error confirming upgrade:', err.message);
      ctx.reply('❌ Gagal melakukan upgrade. Silakan coba lagi.');
    }
  });
}

/**
 * Handle reseller transfer action
 */
function registerResellerTransferAction(bot) {
  bot.action('reseller_transfer', async (ctx) => {
    const userId = ctx.from.id;

    try {
      const user = await dbGetAsync('SELECT role, saldo FROM users WHERE user_id = ?', [userId]);

      if (!user || (user.role !== 'reseller' && user.role !== 'admin' && user.role !== 'owner')) {
        return ctx.reply('❌ Fitur transfer hanya untuk reseller.');
      }

      // Set state to wait for user ID
      transferStates.set(userId, { step: 'waiting_user_id', saldo: user.saldo });

      const text = `
💸 *Transfer Saldo*

💰 Saldo Anda: Rp${user.saldo.toLocaleString('id-ID')}

📝 Langkah 1: Masukkan User ID tujuan
Ketik User ID penerima transfer

Contoh: \`123456789\`

⚠️ Pastikan User ID benar sebelum melanjutkan!
      `.trim();

      await ctx.reply(text, {
        parse_mode: 'Markdown',
        ...Markup.inlineKeyboard([
          [Markup.button.callback('❌ Batal', 'reseller_cancel_transfer')],
          [Markup.button.callback('🔙 Menu Reseller', 'menu_reseller')]
        ])
      });
    } catch (err) {
      logger.error('❌ Error showing transfer menu:', err);
      ctx.reply('❌ Gagal menampilkan menu transfer.');
    }
  });
}

/**
 * Handle cancel transfer
 */
function registerResellerCancelTransferAction(bot) {
  bot.action('reseller_cancel_transfer', async (ctx) => {
    const userId = ctx.from.id;
    
    // Clear state
    transferStates.delete(userId);
    
    await ctx.reply('❌ Transfer dibatalkan.', {
      ...Markup.inlineKeyboard([
        [Markup.button.callback('🔙 Menu Reseller', 'menu_reseller')]
      ])
    });
  });
}

/**
 * Ensure saldo_transfers table exists
 */
async function ensureSaldoTransfersTable() {
  const { dbRunAsync } = require('../../database/connection');
  
  try {
    await dbRunAsync(`
      CREATE TABLE IF NOT EXISTS saldo_transfers (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        from_id INTEGER,
        to_id INTEGER,
        amount INTEGER,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP
      )
    `);
  } catch (err) {
    logger.error('❌ Error creating saldo_transfers table:', err);
    throw err;
  }
}

/**
 * Handle confirm transfer
 */
function registerResellerConfirmTransferAction(bot) {
  bot.action(/^confirm_transfer_(.+)$/, async (ctx) => {
    const userId = ctx.from.id;
    const { dbRunAsync } = require('../../database/connection');
    
    try {
      // Ensure table exists
      await ensureSaldoTransfersTable();
      
      const state = transferStates.get(userId);
      if (!state || !state.targetUserId || !state.amount) {
        transferStates.delete(userId);
        return ctx.editMessageText('❌ Sesi transfer telah kedaluwarsa. Silakan mulai lagi.', {
          ...Markup.inlineKeyboard([
            [Markup.button.callback('💸 Transfer Lagi', 'reseller_transfer')],
            [Markup.button.callback('🔙 Menu Reseller', 'menu_reseller')]
          ])
        });
      }

      const targetUserId = state.targetUserId;
      const amount = state.amount;

      // Get current user data
      const fromUser = await dbGetAsync('SELECT saldo, username FROM users WHERE user_id = ?', [userId]);
      
      if (!fromUser) {
        transferStates.delete(userId);
        return ctx.editMessageText('❌ Akun tidak ditemukan.');
      }

      if (fromUser.saldo < amount) {
        transferStates.delete(userId);
        return ctx.editMessageText(
          `❌ Saldo tidak cukup!\n\n💰 Saldo Anda: Rp${fromUser.saldo.toLocaleString('id-ID')}\n💸 Transfer: Rp${amount.toLocaleString('id-ID')}`,
          {
            ...Markup.inlineKeyboard([
              [Markup.button.callback('💸 Transfer Lagi', 'reseller_transfer')],
              [Markup.button.callback('🔙 Menu Reseller', 'menu_reseller')]
            ])
          }
        );
      }

      // Deduct from sender
      await dbRunAsync(
        'UPDATE users SET saldo = saldo - ? WHERE user_id = ?',
        [amount, userId]
      );

      // Add to receiver
      await dbRunAsync(
        'UPDATE users SET saldo = saldo + ? WHERE user_id = ?',
        [amount, targetUserId]
      );

      // Log transfer
      await dbRunAsync(
        'INSERT INTO saldo_transfers (from_id, to_id, amount, created_at) VALUES (?, ?, ?, datetime("now"))',
        [userId, targetUserId, amount]
      );

      // Clear state
      transferStates.delete(userId);

      const toUser = await dbGetAsync('SELECT username, first_name FROM users WHERE user_id = ?', [targetUserId]);
      const receiverName = toUser?.username || toUser?.first_name || `User ${targetUserId}`;

      // Notify receiver first
      try {
        const senderName = fromUser.username || ctx.from.first_name || `User ${userId}`;
        await ctx.telegram.sendMessage(
          targetUserId,
          `💰 *TRANSFER MASUK*\n\n` +
          `✅ Anda menerima transfer saldo:\n` +
          `💸 Jumlah: Rp${amount.toLocaleString('id-ID')}\n` +
          `👤 Dari: ${senderName} (\`${userId}\`)\n` +
          `🕒 Waktu: ${new Date().toLocaleString('id-ID')}\n\n` +
          `_Saldo Anda telah bertambah!_`,
          { parse_mode: 'Markdown' }
        );
        logger.info(`✅ Transfer notification sent to user ${targetUserId}`);
      } catch (notifyErr: any) {
        logger.warn(`⚠️ Could not notify receiver ${targetUserId}:`, notifyErr.message);
      }

      // Send confirmation to sender
      await ctx.editMessageText(
        `✅ *Transfer Berhasil!*\n\n` +
        `💸 Jumlah: Rp${amount.toLocaleString('id-ID')}\n` +
        `👤 Penerima: ${receiverName} (\`${targetUserId}\`)\n` +
        `💰 Sisa Saldo: Rp${(fromUser.saldo - amount).toLocaleString('id-ID')}\n` +
        `🕒 Waktu: ${new Date().toLocaleString('id-ID')}\n\n` +
        `_Penerima telah diberi notifikasi_`,
        {
          parse_mode: 'Markdown',
          ...Markup.inlineKeyboard([
            [Markup.button.callback('💸 Transfer Lagi', 'reseller_transfer')],
            [Markup.button.callback('📜 Log Transfer', 'reseller_logtransfer')],
            [Markup.button.callback('🔙 Menu Reseller', 'menu_reseller')]
          ])
        }
      );

    } catch (err) {
      logger.error('❌ Error confirming transfer:', err);
      transferStates.delete(userId);
      ctx.reply('❌ Gagal melakukan transfer. Silakan coba lagi.');
    }
  });
}

/**
 * Handle reseller log transfer action
 */
function registerResellerLogTransferAction(bot) {
  bot.action('reseller_logtransfer', async (ctx) => {
    const userId = ctx.from.id;

    try {
      // Ensure table exists
      await ensureSaldoTransfersTable();
      
      const user = await dbGetAsync('SELECT role FROM users WHERE user_id = ?', [userId]);

      if (!user || (user.role !== 'reseller' && user.role !== 'admin' && user.role !== 'owner')) {
        return ctx.reply('❌ Kamu bukan reseller.');
      }

      const rows = await dbAllAsync(
        `SELECT * FROM saldo_transfers WHERE from_id = ? ORDER BY created_at DESC LIMIT 10`,
        [userId]
      );

      if (!rows || rows.length === 0) {
        return ctx.reply('📭 Belum ada log transfer.', {
          ...Markup.inlineKeyboard([
            [Markup.button.callback('💸 Transfer Saldo', 'reseller_transfer')],
            [Markup.button.callback('🔙 Menu Reseller', 'menu_reseller')]
          ])
        });
      }

      const list = rows.map((r, i) =>
        `${i + 1}. 💸 Rp${Number(r.amount || 0).toLocaleString('id-ID')} → User ID: \`${r.to_id}\`\n   🕒 ${r.created_at || 'N/A'}`
      ).join('\n\n');

      const text = `📜 *Riwayat Transfer Saldo* (10 Terakhir)\n\n${list}`;

      await ctx.reply(text, {
        parse_mode: 'Markdown',
        ...Markup.inlineKeyboard([
          [Markup.button.callback('💸 Transfer Lagi', 'reseller_transfer')],
          [Markup.button.callback('🔙 Menu Reseller', 'menu_reseller')]
        ])
      });
    } catch (err) {
      logger.error('❌ Failed to fetch transfer log:', err);
      ctx.reply('❌ Gagal ambil log transfer. Error: ' + (err.message || 'Unknown error'));
    }
  });
}

/**
 * Handle reseller export data action
 */
function registerResellerExportAction(bot) {
  bot.action('reseller_export', async (ctx) => {
    const userId = ctx.from.id;

    try {
      const user = await dbGetAsync('SELECT role, username FROM users WHERE user_id = ?', [userId]);

      if (!user || (user.role !== 'reseller' && user.role !== 'admin' && user.role !== 'owner')) {
        return ctx.reply('❌ Kamu bukan reseller.');
      }

      const rows = await dbAllAsync(
        'SELECT akun_type, username, komisi, created_at FROM reseller_sales WHERE reseller_id = ? ORDER BY created_at DESC LIMIT 50',
        [userId]
      );

      if (!rows || rows.length === 0) {
        return ctx.reply('❌ Tidak ada data komisi untuk diekspor.');
      }

      const now = new Date().toLocaleString('id-ID');
      let content = `===== LAPORAN KOMISI RESELLER =====\n\n`;
      content += `Reseller: ${user.username || ctx.from.first_name}\n`;
      content += `Tanggal: ${now}\n`;
      content += `Total Transaksi: ${rows.length}\n\n`;
      content += `=================================\n\n`;

      rows.forEach((r, i) => {
        content += `${i + 1}. ${r.akun_type.toUpperCase()} - ${r.username}\n`;
        content += `   Komisi: Rp${r.komisi}\n`;
        content += `   Waktu: ${r.created_at}\n\n`;
      });

      const totalKomisi = rows.reduce((sum, r) => sum + r.komisi, 0);
      content += `=================================\n`;
      content += `TOTAL KOMISI: Rp${totalKomisi.toLocaleString('id-ID')}\n`;

      const filename = `komisi_${userId}_${Date.now()}.txt`;
      const fs = require('fs');
      const path = require('path');
      const filepath = path.join(__dirname, '../../../data', filename);

      fs.writeFileSync(filepath, content, 'utf8');

      await ctx.replyWithDocument({ source: filepath, filename });

      // Cleanup file after sending
      setTimeout(() => {
        if (fs.existsSync(filepath)) {
          fs.unlinkSync(filepath);
        }
      }, 5000);

    } catch (err) {
      logger.error('❌ Error exporting komisi data:', err.message);
      ctx.reply('❌ Gagal mengekspor data komisi.');
    }
  });
}

/**
 * Register text handler for transfer process
 */
function registerResellerTransferTextHandler(bot) {
  bot.on('text', async (ctx) => {
    const userId = ctx.from.id;
    const state = transferStates.get(userId);
    
    if (!state) return; // Not in transfer process
    
    const text = ctx.message.text.trim();
    
    try {
      if (state.step === 'waiting_user_id') {
        // Validate user ID
        const targetUserId = parseInt(text);
        
        if (isNaN(targetUserId) || targetUserId <= 0) {
          return ctx.reply('❌ User ID tidak valid. Harap masukkan angka yang benar.\n\nContoh: `123456789`', {
            parse_mode: 'Markdown',
            ...Markup.inlineKeyboard([
              [Markup.button.callback('❌ Batal', 'reseller_cancel_transfer')]
            ])
          });
        }
        
        // Check if target user exists
        const targetUser = await dbGetAsync('SELECT user_id, username, first_name FROM users WHERE user_id = ?', [targetUserId]);
        
        if (!targetUser) {
          return ctx.reply('❌ User tidak ditemukan dalam database.\n\nPastikan User ID sudah terdaftar di bot.', {
            ...Markup.inlineKeyboard([
              [Markup.button.callback('🔄 Coba Lagi', 'reseller_transfer')],
              [Markup.button.callback('❌ Batal', 'reseller_cancel_transfer')]
            ])
          });
        }
        
        // Can't transfer to self
        if (targetUserId === userId) {
          return ctx.reply('❌ Tidak dapat transfer ke diri sendiri!', {
            ...Markup.inlineKeyboard([
              [Markup.button.callback('🔄 Coba Lagi', 'reseller_transfer')],
              [Markup.button.callback('❌ Batal', 'reseller_cancel_transfer')]
            ])
          });
        }
        
        // Update state
        transferStates.set(userId, {
          ...state,
          step: 'waiting_amount',
          targetUserId: targetUserId,
          targetUserName: targetUser.username || targetUser.first_name || `User ${targetUserId}`
        });
        
        await ctx.reply(
          `✅ User ditemukan: ${targetUser.username || targetUser.first_name || 'Unknown'}\n\n` +
          `📝 Langkah 2: Masukkan jumlah transfer\n` +
          `💰 Saldo Anda: Rp${state.saldo.toLocaleString('id-ID')}\n\n` +
          `Ketik jumlah yang ingin ditransfer (tanpa titik/koma)\n` +
          `Contoh: \`50000\``,
          {
            parse_mode: 'Markdown',
            ...Markup.inlineKeyboard([
              [Markup.button.callback('❌ Batal', 'reseller_cancel_transfer')]
            ])
          }
        );
        
      } else if (state.step === 'waiting_amount') {
        // Validate amount
        const amount = parseInt(text.replace(/[.,]/g, ''));
        
        if (isNaN(amount) || amount <= 0) {
          return ctx.reply('❌ Jumlah tidak valid. Harap masukkan angka yang benar.\n\nContoh: `50000`', {
            parse_mode: 'Markdown',
            ...Markup.inlineKeyboard([
              [Markup.button.callback('❌ Batal', 'reseller_cancel_transfer')]
            ])
          });
        }
        
        if (amount < 10000) {
          return ctx.reply('❌ Minimal transfer adalah Rp10.000', {
            ...Markup.inlineKeyboard([
              [Markup.button.callback('❌ Batal', 'reseller_cancel_transfer')]
            ])
          });
        }
        
        if (amount > state.saldo) {
          return ctx.reply(
            `❌ Saldo tidak cukup!\n\n` +
            `💰 Saldo Anda: Rp${state.saldo.toLocaleString('id-ID')}\n` +
            `💸 Transfer: Rp${amount.toLocaleString('id-ID')}`,
            {
              ...Markup.inlineKeyboard([
                [Markup.button.callback('🔄 Coba Lagi', 'reseller_transfer')],
                [Markup.button.callback('❌ Batal', 'reseller_cancel_transfer')]
              ])
            }
          );
        }
        
        // Update state with amount
        transferStates.set(userId, {
          ...state,
          amount: amount
        });
        
        // Show confirmation
        await ctx.reply(
          `📋 *Konfirmasi Transfer*\n\n` +
          `👤 Penerima: ${state.targetUserName}\n` +
          `🆔 User ID: \`${state.targetUserId}\`\n` +
          `💸 Jumlah: Rp${amount.toLocaleString('id-ID')}\n` +
          `💰 Sisa Saldo: Rp${(state.saldo - amount).toLocaleString('id-ID')}\n\n` +
          `⚠️ Pastikan data sudah benar sebelum melanjutkan!`,
          {
            parse_mode: 'Markdown',
            ...Markup.inlineKeyboard([
              [Markup.button.callback('✅ Konfirmasi Transfer', `confirm_transfer_${state.targetUserId}`)],
              [Markup.button.callback('❌ Batal', 'reseller_cancel_transfer')]
            ])
          }
        );
      }
      
    } catch (err) {
      logger.error('❌ Error in transfer text handler:', err);
      transferStates.delete(userId);
      ctx.reply('❌ Terjadi kesalahan. Silakan mulai lagi.');
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
  registerResellerTransferAction(bot);
  registerResellerCancelTransferAction(bot);
  registerResellerConfirmTransferAction(bot);
  // registerResellerTransferTextHandler(bot); // MOVED to textHandler.ts to avoid duplicate text handlers
  registerResellerLogTransferAction(bot);
  registerResellerExportAction(bot);
  registerUpgradeToResellerAction(bot);
  registerConfirmUpgradeResellerAction(bot);

  logger.info('✅ Reseller actions registered');
}

module.exports = {
  registerResellerActions,
  registerResellerMenuAction,
  registerResellerKomisiAction,
  registerResellerRiwayatAction,
  registerResellerTopAllAction,
  registerResellerTopWeeklyAction,
  registerResellerTransferAction,
  registerResellerCancelTransferAction,
  registerResellerConfirmTransferAction,
  // registerResellerTransferTextHandler, // REMOVED - moved to textHandler.ts
  registerResellerLogTransferAction,
  registerResellerExportAction,
  transferStates,
  registerUpgradeToResellerAction,
  registerConfirmUpgradeResellerAction
};
