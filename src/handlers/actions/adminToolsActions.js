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
    const userId = String(ctx.from.id);
    if (!adminIds.includes(userId)) {
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
    const userId = String(ctx.from.id);
    if (!adminIds.includes(userId)) {
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
    const userId = String(ctx.from.id);
    if (!adminIds.includes(userId)) {
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
    const userId = String(ctx.from.id);
    if (!adminIds.includes(userId)) {
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
    const userId = String(ctx.from.id);
    if (!adminIds.includes(userId)) {
      return ctx.reply('🚫 Kamu tidak memiliki izin.');
    }

    try {
      const rows = await new Promise((resolve, reject) => {
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
    const userId = String(ctx.from.id);
    if (!adminIds.includes(userId)) {
      return ctx.reply('🚫 Kamu tidak memiliki izin.');
    }

    try {
      const rows = await new Promise((resolve, reject) => {
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
    const userId = String(ctx.from.id);
    if (!adminIds.includes(userId)) {
      return ctx.reply('🚫 Kamu tidak memiliki izin.');
    }

    global.db.all('SELECT * FROM Server ORDER BY id DESC', [], (err, rows) => {
      if (err) {
        logger.error('❌ Error ambil list server:', err.message);
        return ctx.reply('⚠️ Gagal mengambil data server.');
      }

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
      ctx.reply(msg);
    });
  });
}

/**
 * Register admin promote reseller action
 */
function registerAdminPromoteResellerAction(bot) {
  bot.action('admin_promote_reseller', async (ctx) => {
    const adminId = String(ctx.from.id);
    const rawAdmin = USER_ID;
    const adminIds = Array.isArray(rawAdmin)
      ? rawAdmin.map(String)
      : [String(rawAdmin)];

    if (!adminIds.includes(adminId)) {
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
    const adminId = String(ctx.from.id);
    const rawAdmin = USER_ID;
    const adminIds = Array.isArray(rawAdmin) ? rawAdmin.map(String) : [String(rawAdmin)];

    if (!adminIds.includes(adminId)) {
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
    const adminId = String(ctx.from.id);
    const rawAdmin = USER_ID;
    const adminIds = Array.isArray(rawAdmin) ? rawAdmin.map(String) : [String(rawAdmin)];

    if (!adminIds.includes(adminId)) {
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
    const rawAdmin = USER_ID;
    const adminIds = Array.isArray(rawAdmin) ? rawAdmin.map(String) : [String(rawAdmin)];

    if (!adminIds.includes(String(adminId))) {
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
    if (!adminIds.includes(String(userId))) return ctx.reply('🚫 Kamu tidak memiliki izin.');

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

  logger.info('✅ Admin tools actions registered (12 actions)');
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
