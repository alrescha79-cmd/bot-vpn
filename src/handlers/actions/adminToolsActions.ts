
import type { BotContext, DatabaseUser, DatabaseServer } from "../../types";
/**
 * @fileoverview Admin Tools Actions Handler
 * Handles administrative utility actions (stats, broadcast, user management, etc.)
 * 
 * Architecture:
 * - Admin-only actions with authorization checks
 * - System statistics and monitoring
 * - User management (promote, downgrade, level change)
 * - Broadcast messaging
 * - Trial reset and topup history
 */

const { dbGetAsync, dbRunAsync, dbAllAsync } = require('../../database/connection');
const { escapeMarkdown, escapeMarkdownV2 } = require('../../utils/markdown');
const logger = require('../../utils/logger');

const adminIds = (process.env.ADMIN_IDS || '').split(',').filter(Boolean);
const USER_ID = process.env.USER_ID;
const GROUP_ID = process.env.GROUP_ID;

/**
 * Register admin stats action
 */
function registerAdminStatsAction(bot) {
  bot.action('admin_stats', async (ctx) => {
    const userId = ctx.from.id;

    // Check if user is admin from database only
    const user = await dbGetAsync('SELECT role FROM users WHERE user_id = ?', [userId]);

    if (!user || (user.role !== 'admin' && user.role !== 'owner')) {
      return ctx.answerCbQuery('❌ Tidak diizinkan.');
    }

    try {
      const [jumlahUser, jumlahReseller, jumlahServer, totalSaldo] = await Promise.all([
        dbGetAsync('SELECT COUNT(*) AS count FROM users'),
        dbGetAsync("SELECT COUNT(*) AS count FROM users WHERE role = 'reseller'"),
        dbGetAsync('SELECT COUNT(*) AS count FROM Server'),
        dbGetAsync('SELECT SUM(saldo) AS total FROM users')
      ]);

      const sistemText = `
📊 *Statistik Sistem  _Realtime_*

👥 *User*     : ${escapeMarkdownV2(String(jumlahUser?.count || 0))}
👑 *Reseller* : ${escapeMarkdownV2(String(jumlahReseller?.count || 0))}
🖥️ *Server*   : ${escapeMarkdownV2(String(jumlahServer?.count || 0))}
💰 *Saldo*    : Rp${escapeMarkdownV2((totalSaldo?.total || 0).toLocaleString('id-ID'))}
`.trim();

      const [totalTransaksi, totalKomisi, topReseller] = await Promise.all([
        dbGetAsync('SELECT COUNT(*) AS count FROM invoice_log'),
        dbGetAsync('SELECT SUM(komisi) AS total FROM reseller_sales'),
        dbAllAsync(`
          SELECT u.username, r.reseller_id, SUM(r.komisi) AS total_komisi
          FROM reseller_sales r
          LEFT JOIN users u ON u.user_id = r.reseller_id
          GROUP BY r.reseller_id
          ORDER BY total_komisi DESC
          LIMIT 3
        `)
      ]);

      let globalText = `
📊 *Statistik Global*

🌐 Server Aktif : ${escapeMarkdownV2(String(jumlahServer?.count || 0))}
👥 Pengguna     : ${escapeMarkdownV2(String(jumlahUser?.count || 0))}
📦 Transaksi    : ${escapeMarkdownV2(String(totalTransaksi?.count || 0))}
💰 Komisi Total : Rp${escapeMarkdownV2((totalKomisi?.total || 0).toLocaleString('id-ID'))}
`;

      if (topReseller && topReseller.length > 0) {
        globalText += `\n🏆 *Top 3 Reseller:*\n`;
        const medals = ['🥇', '🥈', '🥉'];
        topReseller.forEach((r, i) => {
          const mention = r.username
            ? `@${escapeMarkdownV2(r.username)}`
            : `ID\\_${escapeMarkdownV2(String(r.reseller_id))}`;
          const komisi = escapeMarkdownV2((r.total_komisi || 0).toLocaleString('id-ID'));
          globalText += `${medals[i] || '⭐'} ${mention} \\- Rp${komisi}\n`;
        });
      }

      await ctx.editMessageText(`${sistemText}\n\n${globalText}`.trim(), {
        parse_mode: 'MarkdownV2',
        disable_web_page_preview: true
      });

    } catch (err) {
      logger.error('❌ Gagal ambil statistik admin:', err.message);
      await ctx.reply('❌ Gagal mengambil data statistik.');
    }
  });
}

/**
 * Register admin broadcast action
 */
function registerAdminBroadcastAction(bot) {
  bot.action('admin_broadcast', async (ctx) => {
    const userId = ctx.from.id;

    // Check if user is admin from database only
    const user = await dbGetAsync('SELECT role FROM users WHERE user_id = ?', [userId]);

    if (!user || (user.role !== 'admin' && user.role !== 'owner')) {
      return ctx.reply('🚫 Kamu tidak punya izin untuk broadcast.');
    }

    if (!global.userState) global.userState = {};
    global.userState[ctx.chat.id] = { step: 'await_broadcast_message' };
    return ctx.reply('📝 Silakan ketik pesan yang ingin dibroadcast ke semua pengguna.');
  });
}

/**
 * Register admin reset trial action
 */
function registerAdminResetTrialAction(bot) {
  bot.action('admin_reset_trial', async (ctx) => {
    const userId = ctx.from.id;

    // Check if user is admin from database only
    const user = await dbGetAsync('SELECT role FROM users WHERE user_id = ?', [userId]);

    if (!user || (user.role !== 'admin' && user.role !== 'owner')) {
      return ctx.answerCbQuery('❌ Akses ditolak bro.');
    }

    try {
      await dbRunAsync(`UPDATE users SET trial_count_today = 0, last_trial_date = date('now')`);
      await ctx.reply('✅ *Semua trial user telah direset ke 0.*', { parse_mode: 'Markdown' });
      logger.info(`🔄 Admin ${userId} melakukan reset trial harian.`);
    } catch (err) {
      logger.error('❌ Gagal reset trial harian:', err.message);
      await ctx.reply('❌ *Gagal melakukan reset trial.*', { parse_mode: 'Markdown' });
    }
  });
}

/**
 * Register admin view topup history action
 */
function registerAdminViewTopupAction(bot) {
  bot.action('admin_view_topup', async (ctx) => {
    const userId = ctx.from.id;

    // Check if user is admin from database only
    const user = await dbGetAsync('SELECT role FROM users WHERE user_id = ?', [userId]);

    if (!user || (user.role !== 'admin' && user.role !== 'owner')) {
      return ctx.answerCbQuery('❌ Tidak diizinkan.');
    }

    try {
      const rows = await dbAllAsync(`
        SELECT username, amount, reference, created_at
        FROM topup_log
        ORDER BY created_at DESC
        LIMIT 10
      `);

      if (rows.length === 0) {
        return ctx.editMessageText(escapeMarkdown('📭 Belum ada transaksi topup yang berhasil.'), {
          parse_mode: 'MarkdownV2'
        });
      }

      let teks = '*📋 Riwayat Topup Terakhir:*\n\n';

      rows.forEach((row, i) => {
        const mention = row.username
          ? `@${escapeMarkdown(row.username)}`
          : 'User\\_Tidak\\_Diketahui';

        const waktu = escapeMarkdown(
          new Date(row.created_at).toLocaleString('id-ID')
        );
        const ref = escapeMarkdown(row.reference || '-');
        const amount = escapeMarkdown(row.amount.toLocaleString('id-ID'));

        teks += `${i + 1}\\. 👤 ${mention}\n💰 Rp${amount}\n🔖 Ref: ${ref}\n🕒 ${waktu}\n\n`;
      });

      await ctx.editMessageText(teks, {
        parse_mode: 'MarkdownV2',
        reply_markup: {
          inline_keyboard: [
            [{ text: '🔙 Kembali', callback_data: 'menu_adminreseller' }]
          ]
        }
      });
    } catch (error) {
      logger.error('❌ Gagal tampilkan riwayat topup:', error.message);
      await ctx.reply(escapeMarkdown('❌ Terjadi kesalahan saat ambil riwayat topup.'), {
        parse_mode: 'MarkdownV2'
      });
    }
  });
}

/**
 * Register admin list resellers action
 */
function registerAdminListResellersAction(bot) {
  bot.action('admin_listreseller', async (ctx) => {
    const userId = ctx.from.id;

    // Check if user is admin from database only
    const user = await dbGetAsync('SELECT role FROM users WHERE user_id = ?', [userId]);

    if (!user || (user.role !== 'admin' && user.role !== 'owner')) {
      return ctx.reply('🚫 Kamu tidak memiliki izin.');
    }

    try {
      const rows = await new Promise<any[]>((resolve, reject) => {
        global.db.all(`
          SELECT user_id, username, reseller_level, saldo 
          FROM users 
          WHERE role = 'reseller' 
          LIMIT 20
        `, (err, rows) => {
          if (err) reject(err);
          else resolve(rows);
        });
      });

      if (!rows || rows.length === 0) {
        return ctx.reply('📭 Belum ada reseller terdaftar.');
      }

      const list = rows.map((row, i) => {
        const mention = row.username
          ? `@${escapeMarkdownV2(row.username)}`
          : `ID: \`${escapeMarkdownV2(String(row.user_id))}\``;

        const level = escapeMarkdownV2(row.reseller_level || 'silver');
        const saldo = escapeMarkdownV2(row.saldo.toLocaleString('id-ID'));

        return `🔹 ${mention}\n🏷 Level: *${level}*\n💰 Saldo: Rp${saldo}`;
      }).join('\n\n');

      const text = `🏆 *List Reseller _Max 20_:*\n\n${list}`;

      await ctx.reply(text, {
        parse_mode: 'MarkdownV2'
      });

    } catch (err) {
      logger.error('❌ Gagal ambil list reseller:', err.message);
      ctx.reply('❌ Gagal mengambil daftar reseller.');
    }
  });
}

/**
 * Register admin list users action
 */
function registerAdminListUsersAction(bot) {
  bot.action('admin_listuser', async (ctx) => {
    const userId = ctx.from.id;

    // Check if user is admin from database only
    const user = await dbGetAsync('SELECT role FROM users WHERE user_id = ?', [userId]);

    if (!user || (user.role !== 'admin' && user.role !== 'owner')) {
      return ctx.reply('🚫 Kamu tidak memiliki izin.');
    }

    try {
      const rows = await new Promise<any[]>((resolve, reject) => {
        global.db.all('SELECT user_id, username, role, saldo FROM users LIMIT 20', (err, rows) => {
          if (err) reject(err);
          else resolve(rows);
        });
      });

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
      logger.error('❌ Gagal ambil list user:', err.message);
      ctx.reply('❌ Gagal mengambil daftar pengguna.');
    }
  });
}

/**
 * Register admin list servers action
 */
function registerAdminListServersAction(bot) {
  bot.action('admin_listserver', async (ctx) => {
    const userId = ctx.from.id;

    // Check if user is admin from database only
    const user = await dbGetAsync('SELECT role FROM users WHERE user_id = ?', [userId]);

    if (!user || (user.role !== 'admin' && user.role !== 'owner')) {
      return ctx.reply('🚫 Kamu tidak memiliki izin.');
    }

    try {
      const rows = await dbAllAsync('SELECT * FROM Server ORDER BY id DESC');

      if (!rows || rows.length === 0) {
        return ctx.reply('📭 Belum ada server yang ditambahkan.');
      }

      const list = rows.map((row, i) => {
        return `${i + 1}. ${row.nama_server}\n` +
          `🌐 Domain   : ${row.domain}\n` +
          `🔐 Auth     : ${row.auth}\n` +
          `💾 Quota    : ${row.quota} GB\n` +
          `🌍 IP Limit : ${row.iplimit}\n` +
          `📦 Harga    : Rp${row.harga.toLocaleString('id-ID')}\n` +
          `🧮 Total Buat: ${row.total_create_akun}`;
      }).join('\n──────────────\n');

      const msg = `📄 List Server Tersimpan:\n\n${list}`;
      await ctx.reply(msg);
    } catch (err) {
      logger.error('❌ Error ambil list server:', err.message);
      return ctx.reply('⚠️ Gagal mengambil data server.');
    }
  });
}

/**
 * Register admin promote reseller action
 */
function registerAdminPromoteResellerAction(bot) {
  bot.action('admin_promote_reseller', async (ctx) => {
    const adminId = ctx.from.id;

    // Check if user is admin from database only
    const user = await dbGetAsync('SELECT role FROM users WHERE user_id = ?', [adminId]);

    if (!user || (user.role !== 'admin' && user.role !== 'owner')) {
      return ctx.reply('⛔ Hanya admin yang bisa akses fitur ini.');
    }

    // Prompt input user ID
    if (!global.userState) global.userState = {};
    global.userState[ctx.chat.id] = { step: 'await_reseller_id' };

    setTimeout(() => {
      if (global.userState[ctx.chat.id]?.step === 'await_reseller_id') {
        delete global.userState[ctx.chat.id];
        ctx.reply('⏳ Waktu habis. Silakan ulangi /promote_reseller jika masih ingin mempromosikan user.');
      }
    }, 30000); // 30 detik

    return ctx.reply('📥 Masukkan user ID yang ingin dipromosikan jadi reseller:');
  });
}

/**
 * Register admin downgrade reseller action
 */
function registerAdminDowngradeResellerAction(bot) {
  bot.action('admin_downgrade_reseller', async (ctx) => {
    const adminId = ctx.from.id;

    // Check if user is admin from database only
    const user = await dbGetAsync('SELECT role FROM users WHERE user_id = ?', [adminId]);

    if (!user || (user.role !== 'admin' && user.role !== 'owner')) {
      return ctx.reply('⛔ *Khusus admin.*', { parse_mode: 'Markdown' });
    }

    if (!global.userState) global.userState = {};
    global.userState[ctx.chat.id] = { step: 'await_downgrade_id' };
    return ctx.reply('📥 *Masukkan ID user yang ingin di-DOWNGRADE ke user biasa:*', {
      parse_mode: 'Markdown'
    });
  });
}

/**
 * Register admin change reseller level action
 */
function registerAdminChangeResellerLevelAction(bot) {
  bot.action('admin_ubah_level', async (ctx) => {
    const adminId = ctx.from.id;

    // Check if user is admin from database only
    const user = await dbGetAsync('SELECT role FROM users WHERE user_id = ?', [adminId]);

    if (!user || (user.role !== 'admin' && user.role !== 'owner')) {
      return ctx.reply('⛔ *Khusus admin.*', { parse_mode: 'Markdown' });
    }

    if (!global.userState) global.userState = {};
    global.userState[ctx.chat.id] = { step: 'await_level_change' };
    ctx.reply('🧬 *Masukkan ID user dan level baru:*\n\nFormat: `123456789 platinum`', {
      parse_mode: 'Markdown'
    });

    // ⏱️ Timeout auto reset 30 detik
    setTimeout(() => {
      if (global.userState[ctx.chat.id]?.step === 'await_level_change') {
        delete global.userState[ctx.chat.id];
        ctx.reply('⏳ Waktu habis. Silakan klik ulang tombol *Ubah Level Reseller*.', {
          parse_mode: 'Markdown'
        });
      }
    }, 30000);
  });
}

/**
 * Register admin reset komisi action
 */
function registerAdminResetKomisiAction(bot) {
  bot.action('admin_resetkomisi', async (ctx) => {
    const adminId = ctx.from.id;

    // Check if user is admin from database only
    const user = await dbGetAsync('SELECT role FROM users WHERE user_id = ?', [adminId]);

    if (!user || (user.role !== 'admin' && user.role !== 'owner')) {
      return ctx.reply(escapeMarkdown('⛔ Akses ditolak. Hanya admin.'), {
        parse_mode: 'MarkdownV2'
      });
    }

    if (!global.userState) global.userState = {};
    global.userState[ctx.chat.id] = {
      step: 'reset_komisi_input'
    };

    return ctx.reply(escapeMarkdown('📨 Masukkan user_id yang ingin direset komisinya:'), {
      parse_mode: 'MarkdownV2'
    });
  });
}

/**
 * Register admin restore DB action
 */
function registerAdminRestoreDBAction(bot) {
  bot.action('admin_restore2_db', async (ctx) => {
    const userId = ctx.from.id;

    // Check if user is admin from database only
    const user = await dbGetAsync('SELECT role FROM users WHERE user_id = ?', [userId]);

    if (!user || (user.role !== 'admin' && user.role !== 'owner')) {
      return ctx.reply('🚫 Kamu tidak memiliki izin.');
    }

    if (!global.userState) global.userState = {};
    global.userState[ctx.chat.id] = { step: 'await_restore_upload' };

    await ctx.reply(
      '📤 *Silakan kirim file backup database (.db) yang ingin direstore.*\n' +
      '_Contoh: botvpn_2025-06-01_10-00.db_',
      { parse_mode: 'Markdown' }
    );
  });
}

/**
 * Register admin pending deposits action
 */
function registerAdminPendingDepositsAction(bot) {
  bot.action('admin_pending_deposits', async (ctx) => {
    const userId = ctx.from.id;

    // Check if user is admin
    const user = await dbGetAsync('SELECT role FROM users WHERE user_id = ?', [userId]);

    if (!user || (user.role !== 'admin' && user.role !== 'owner')) {
      return ctx.answerCbQuery('❌ Tidak diizinkan.');
    }

    try {
      const { getAwaitingVerificationDeposits } = require('../../repositories/depositRepository');
      const deposits = await getAwaitingVerificationDeposits();

      if (deposits.length === 0) {
        const emptyMessage = '📭 *Tidak ada deposit yang menunggu verifikasi*';
        const emptyButtons = [[{ text: '🔙 Kembali', callback_data: 'admin_system_menu' }]];

        // Check if callback came from photo message
        const isPhotoMessage = ctx.callbackQuery?.message?.photo;

        if (isPhotoMessage) {
          await ctx.reply(emptyMessage, {
            parse_mode: 'Markdown',
            reply_markup: { inline_keyboard: emptyButtons }
          });
        } else {
          await ctx.editMessageText(emptyMessage, {
            parse_mode: 'Markdown',
            reply_markup: { inline_keyboard: emptyButtons }
          });
        }
        return;
      }

      let text = `💰 *Deposit Menunggu Verifikasi*\n\n`;
      text += `Total: ${deposits.length} deposit\n\n`;

      const buttons = deposits.slice(0, 10).map(dep => {
        const userInfo = `User ${dep.user_id}`;
        const amount = `Rp ${dep.amount.toLocaleString('id-ID')}`;
        const time = new Date(dep.timestamp).toLocaleString('id-ID', {
          month: 'short',
          day: 'numeric',
          hour: '2-digit',
          minute: '2-digit'
        });

        return [{
          text: `${userInfo} - ${amount} - ${time}`,
          callback_data: `view_deposit_${dep.unique_code}`
        }];
      });

      buttons.push([{ text: '🔙 Kembali', callback_data: 'admin_system_menu' }]);

      // Check if callback came from photo message
      const isPhotoMessage = ctx.callbackQuery?.message?.photo;

      if (isPhotoMessage) {
        await ctx.reply(text, {
          parse_mode: 'Markdown',
          reply_markup: { inline_keyboard: buttons }
        });
      } else {
        await ctx.editMessageText(text, {
          parse_mode: 'Markdown',
          reply_markup: { inline_keyboard: buttons }
        });
      }
    } catch (error) {
      logger.error('❌ Error fetching pending deposits:', error);
      try {
        // Try to send new message if edit fails
        await ctx.reply('❌ *Gagal mengambil data deposit*', { parse_mode: 'Markdown' });
      } catch (replyError) {
        await ctx.answerCbQuery('❌ Gagal mengambil data deposit', { show_alert: true });
      }
    }
  });
}

/**
 * Register view deposit detail action
 */
function registerViewDepositDetailAction(bot) {
  bot.action(/^view_deposit_(.+)$/, async (ctx) => {
    const invoiceId = ctx.match[1];
    const userId = ctx.from.id;

    // Check if user is admin
    const user = await dbGetAsync('SELECT role FROM users WHERE user_id = ?', [userId]);

    if (!user || (user.role !== 'admin' && user.role !== 'owner')) {
      return ctx.answerCbQuery('❌ Tidak diizinkan.');
    }

    try {
      const { getPendingDeposit } = require('../../repositories/depositRepository');
      const deposit = await getPendingDeposit(invoiceId);

      if (!deposit) {
        return ctx.answerCbQuery('❌ Deposit tidak ditemukan', { show_alert: true });
      }

      // Get user info
      const depositUser = await dbGetAsync('SELECT username, first_name FROM users WHERE user_id = ?', [deposit.user_id]);
      const username = depositUser?.username || 'Unknown';

      // Escape underscores in status for Markdown
      const statusDisplay = deposit.status.replace(/_/g, '\\_');

      const text = `
📋 *Detail Deposit*

👤 *User:* @${username} (ID: \`${deposit.user_id}\`)
💰 *Jumlah:* Rp ${deposit.amount.toLocaleString('id-ID')}
🆔 *Invoice:* \`${invoiceId}\`
📅 *Waktu:* ${new Date(deposit.timestamp).toLocaleString('id-ID')}
💳 *Metode:* ${deposit.payment_method === 'static_qris' ? 'QRIS Statis' : 'Midtrans'}
📊 *Status:* ${statusDisplay}
      `.trim();

      const buttons = [
        [
          { text: '✅ Setujui', callback_data: `approve_deposit_${invoiceId}` },
          { text: '❌ Tolak', callback_data: `reject_deposit_${invoiceId}` }
        ],
        [{ text: '🔙 Kembali', callback_data: 'admin_pending_deposits' }]
      ];

      // Check if callback came from photo message or text message
      const isPhotoMessage = ctx.callbackQuery?.message?.photo;

      // Send proof image first if available
      if (deposit.proof_image_id) {
        await ctx.telegram.sendPhoto(ctx.chat.id, deposit.proof_image_id, {
          caption: `📸 *Bukti Pembayaran*\n\nInvoice: \`${invoiceId}\`\nJumlah: Rp ${deposit.amount.toLocaleString('id-ID')}`,
          parse_mode: 'Markdown'
        });
      }

      // Then send detail with buttons below the proof
      if (isPhotoMessage) {
        // Send new message instead of editing photo message
        await ctx.reply(text, {
          parse_mode: 'Markdown',
          reply_markup: { inline_keyboard: buttons }
        });
      } else {
        // Edit existing text message
        await ctx.editMessageText(text, {
          parse_mode: 'Markdown',
          reply_markup: { inline_keyboard: buttons }
        });
      }
    } catch (error) {
      logger.error('❌ Error viewing deposit detail:', error);
      await ctx.answerCbQuery('❌ Gagal menampilkan detail', { show_alert: true });
    }
  });
}

/**
 * Register approve deposit action
 */
function registerApproveDepositAction(bot) {
  bot.action(/^approve_deposit_(.+)$/, async (ctx) => {
    const invoiceId = ctx.match[1];
    const userId = ctx.from.id;

    // Check if user is admin
    const user = await dbGetAsync('SELECT role FROM users WHERE user_id = ?', [userId]);

    if (!user || (user.role !== 'admin' && user.role !== 'owner')) {
      return ctx.answerCbQuery('❌ Tidak diizinkan.');
    }

    try {
      const { getPendingDeposit, approveDeposit } = require('../../repositories/depositRepository');
      const { getUserById, updateUserSaldo } = require('../../repositories/userRepository');

      const deposit = await getPendingDeposit(invoiceId);

      if (!deposit) {
        return ctx.answerCbQuery('❌ Deposit tidak ditemukan', { show_alert: true });
      }

      if (deposit.status !== 'awaiting_verification') {
        return ctx.answerCbQuery(`ℹ️ Deposit sudah ${deposit.status}`, { show_alert: true });
      }

      // Get user
      const depositUser = await getUserById(deposit.user_id);
      if (!depositUser) {
        return ctx.answerCbQuery('❌ User tidak ditemukan', { show_alert: true });
      }

      // Approve deposit
      await approveDeposit(invoiceId, userId, 'Approved by admin');

      // Update user balance
      const newBalance = depositUser.saldo + deposit.amount;
      await updateUserSaldo(deposit.user_id, newBalance);

      // Log to topup_log
      await dbRunAsync(
        `INSERT INTO topup_log (user_id, username, amount, reference, created_at)
         VALUES (?, ?, ?, ?, datetime('now'))`,
        [deposit.user_id, depositUser.username || depositUser.first_name, deposit.amount, invoiceId]
      );

      // Notify user
      const mention = depositUser.username ? `@${depositUser.username}` : depositUser.first_name;
      await ctx.telegram.sendMessage(
        deposit.user_id,
        `✅ *Deposit Disetujui!*\n\n` +
        `💰 Jumlah: Rp ${deposit.amount.toLocaleString('id-ID')}\n` +
        `💳 Saldo baru: Rp ${newBalance.toLocaleString('id-ID')}\n` +
        `🆔 Invoice: \`${invoiceId}\`\n\n` +
        `Terima kasih! Saldo Anda telah ditambahkan.`,
        { parse_mode: 'Markdown' }
      );

      // Log approval (notification to other admins not needed for single admin setup)
      logger.info(`Deposit ${invoiceId} approved by admin ${userId} for user ${mention}`);

      await ctx.editMessageText(
        `✅ *Deposit Berhasil Disetujui*\n\n` +
        `User ${mention} telah menerima Rp ${deposit.amount.toLocaleString('id-ID')}`,
        {
          parse_mode: 'Markdown',
          reply_markup: {
            inline_keyboard: [
              [{ text: '🔙 Kembali', callback_data: 'admin_pending_deposits' }]
            ]
          }
        }
      );

      logger.info(`Deposit ${invoiceId} approved by admin ${userId}`);
    } catch (error) {
      logger.error('❌ Error approving deposit:', error);
      await ctx.answerCbQuery('❌ Gagal menyetujui deposit', { show_alert: true });
    }
  });
}

/**
 * Register reject deposit action
 */
function registerRejectDepositAction(bot) {
  bot.action(/^reject_deposit_(.+)$/, async (ctx) => {
    const invoiceId = ctx.match[1];
    const userId = ctx.from.id;

    // Check if user is admin
    const user = await dbGetAsync('SELECT role FROM users WHERE user_id = ?', [userId]);

    if (!user || (user.role !== 'admin' && user.role !== 'owner')) {
      return ctx.answerCbQuery('❌ Tidak diizinkan.');
    }

    try {
      const { getPendingDeposit, rejectDeposit } = require('../../repositories/depositRepository');

      const deposit = await getPendingDeposit(invoiceId);

      if (!deposit) {
        return ctx.answerCbQuery('❌ Deposit tidak ditemukan', { show_alert: true });
      }

      if (deposit.status !== 'awaiting_verification') {
        return ctx.answerCbQuery(`ℹ️ Deposit sudah ${deposit.status}`, { show_alert: true });
      }

      // Reject deposit
      const rejectionReason = 'Bukti pembayaran tidak valid atau tidak sesuai';
      await rejectDeposit(invoiceId, userId, rejectionReason);

      // Notify user
      const depositUser = await dbGetAsync('SELECT username, first_name FROM users WHERE user_id = ?', [deposit.user_id]);
      const mention = depositUser?.username ? `@${depositUser.username}` : depositUser?.first_name || 'User';

      await ctx.telegram.sendMessage(
        deposit.user_id,
        `❌ *Deposit Ditolak*\n\n` +
        `💰 Jumlah: Rp ${deposit.amount.toLocaleString('id-ID')}\n` +
        `🆔 Invoice: \`${invoiceId}\`\n\n` +
        `📝 Alasan: ${rejectionReason}\n\n` +
        `Silakan upload ulang dengan bukti pembayaran yang sesuai.`,
        { parse_mode: 'Markdown' }
      );

      await ctx.editMessageText(
        `❌ *Deposit Ditolak*\n\n` +
        `User ${mention} telah diberi tahu tentang penolakan.`,
        {
          parse_mode: 'Markdown',
          reply_markup: {
            inline_keyboard: [
              [{ text: '🔙 Kembali', callback_data: 'admin_pending_deposits' }]
            ]
          }
        }
      );

      logger.info(`Deposit ${invoiceId} rejected by admin ${userId}`);
    } catch (error) {
      logger.error('❌ Error rejecting deposit:', error);
      await ctx.answerCbQuery('❌ Gagal menolak deposit', { show_alert: true });
    }
  });
}

/**
 * Register all admin tools actions
 */
function registerAllAdminToolsActions(bot) {
  registerAdminStatsAction(bot);
  registerAdminBroadcastAction(bot);
  registerAdminResetTrialAction(bot);
  registerAdminViewTopupAction(bot);
  registerAdminListResellersAction(bot);
  registerAdminListUsersAction(bot);
  registerAdminListServersAction(bot);
  registerAdminPromoteResellerAction(bot);
  registerAdminDowngradeResellerAction(bot);
  registerAdminChangeResellerLevelAction(bot);
  registerAdminResetKomisiAction(bot);
  registerAdminRestoreDBAction(bot);
  registerAdminPendingDepositsAction(bot);
  registerViewDepositDetailAction(bot);
  registerApproveDepositAction(bot);
  registerRejectDepositAction(bot);

  logger.info('✅ Admin tools actions registered (16 actions)');
}

module.exports = {
  registerAllAdminToolsActions,
  registerAdminStatsAction,
  registerAdminBroadcastAction,
  registerAdminResetTrialAction,
  registerAdminViewTopupAction,
  registerAdminListResellersAction,
  registerAdminListUsersAction,
  registerAdminListServersAction,
  registerAdminPromoteResellerAction,
  registerAdminDowngradeResellerAction,
  registerAdminChangeResellerLevelAction,
  registerAdminResetKomisiAction,
  registerAdminRestoreDBAction
};
