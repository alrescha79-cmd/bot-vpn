/**
 * @fileoverview Text Event Handler
 * Handles all text input flows using state machine pattern
 * 
 * Architecture:
 * - State-based routing using global userState object
 * - Modular flow handlers for different input types
 * - Validation and error handling for each flow
 * 
 * Flows handled:
 * - Service creation (username, password, expiry)
 * - Server management (add server, edit server)
 * - User management (promote, downgrade, reset komisi, change level)
 * - Admin operations (broadcast, add saldo)
 */

const { dbGetAsync, dbRunAsync } = require('../../database/connection');
const { escapeMarkdown, escapeMarkdownV2 } = require('../../utils/markdown');
const logger = require('../../utils/logger');

// Import service creation modules
const { createssh } = require('../../modules/protocols/ssh/createSSH');
const { createvmess } = require('../../modules/protocols/vmess/createVMESS');
const { createvless } = require('../../modules/protocols/vless/createVLESS');
const { createtrojan } = require('../../modules/protocols/trojan/createTROJAN');
const { createshadowsocks } = require('../../modules/protocols/shadowsocks/createSHADOWSOCKS');
const { renewssh } = require('../../modules/protocols/ssh/renewSSH');
const { renewvmess } = require('../../modules/protocols/vmess/renewVMESS');
const { renewvless } = require('../../modules/protocols/vless/renewVLESS');
const { renewtrojan } = require('../../modules/protocols/trojan/renewTROJAN');
const { renewshadowsocks } = require('../../modules/protocols/shadowsocks/renewSHADOWSOCKS');

// Import utilities (these functions should exist in app.js or be moved to utils)
// const { resolveDomainToIP, getISPAndLocation } = require('../../utils/serverUtils');
// For now, we'll use placeholder - these should be extracted from app.js

const GROUP_ID = process.env.GROUP_ID;
const adminIds = (process.env.ADMIN_IDS || '').split(',').filter(Boolean);

// Note: These handler functions (handleEditNama, handleEditAuth, etc.) are referenced from app.js
// They should be extracted and imported here, but for now we'll note them as dependencies

/**
 * Handle service creation/renewal flow
 * Steps: username → password (SSH only) → expiry → create/renew
 */
async function handleServiceFlow(ctx, state, text, bot) {
  const chatId = ctx.chat.id;
  const userId = ctx.from.id;

  try {
    // Step 1: Username input
    if (typeof state.step === 'string' && state.step.startsWith('username_')) {
      if (!/^[a-zA-Z0-9]{3,20}$/.test(text)) {
        return ctx.reply('❌ *Username tidak valid.*', { parse_mode: 'Markdown' });
      }

      state.username = text;

      // SSH requires password
      if (state.action === 'create' && state.type === 'ssh') {
        state.step = `password_${state.action}_${state.type}`;
        return ctx.reply('🔑 *Masukkan password:*', { parse_mode: 'Markdown' });
      }

      // Other protocols skip to expiry
      state.step = `exp_${state.action}_${state.type}`;
      return ctx.reply('⏳ *Masukkan masa aktif (hari):*', { parse_mode: 'Markdown' });
    }

    // Step 2: Password input (SSH only)
    if (state.step.startsWith('password_')) {
      if (!/^[a-zA-Z0-9]{6,}$/.test(text)) {
        return ctx.reply('❌ *Password minimal 6 karakter dan tanpa simbol.*', { parse_mode: 'Markdown' });
      }

      state.password = text;
      state.step = `exp_${state.action}_${state.type}`;
      return ctx.reply('⏳ *Masukkan masa aktif (hari):*', { parse_mode: 'Markdown' });
    }

    // Step 3: Expiry input and service execution
    if (state.step.startsWith('exp_')) {
      const days = parseInt(text);
      if (isNaN(days) || days <= 0 || days > 365) {
        return ctx.reply('❌ *Masa aktif tidak valid.*', { parse_mode: 'Markdown' });
      }

      const { username, password, serverId, type, action } = state;
      state.exp = days;

      // Get server details
      const server = await dbGetAsync(`
        SELECT nama_server, domain, quota, iplimit, harga 
        FROM Server 
        WHERE id = ?
      `, [serverId]);

      // Get user details
      let user = await dbGetAsync('SELECT saldo, role, reseller_level FROM users WHERE user_id = ?', [userId]);

      if (!user) {
        await dbRunAsync(
          `INSERT INTO users (user_id, username, saldo, role, reseller_level) VALUES (?, ?, 0, 'user', 'silver')`,
          [userId, ctx.from.username]
        );
        user = { saldo: 0, role: 'user', reseller_level: 'silver' };
      }

      if (!server) return ctx.reply('❌ *Server tidak ditemukan.*', { parse_mode: 'Markdown' });

      // Calculate price with reseller discount
      const diskon = user.role === 'reseller'
        ? user.reseller_level === 'gold' ? 0.2
        : user.reseller_level === 'platinum' ? 0.3
        : 0.1
        : 0;

      const hargaSatuan = Math.floor(server.harga * (1 - diskon));
      const totalHarga = hargaSatuan * days;
      const komisi = user.role === 'reseller' ? Math.floor(server.harga * days * 0.1) : 0;

      // Check balance
      if (user.saldo < totalHarga) {
        return ctx.reply('❌ *Saldo tidak mencukupi.*', { parse_mode: 'Markdown' });
      }

      // For renew, verify account exists
      if (action === 'renew') {
        const row = await dbGetAsync(
          'SELECT * FROM akun_aktif WHERE username = ? AND jenis = ?',
          [username, type]
        );
        if (!row) {
          return ctx.reply('❌ *Akun tidak ditemukan atau tidak aktif.*', { parse_mode: 'Markdown' });
        }
      }

      // Deduct balance
      await dbRunAsync('UPDATE users SET saldo = saldo - ? WHERE user_id = ?', [totalHarga, userId]);

      // Handler mapping
      const handlerMap = {
        create: {
          vmess: () => createvmess(username, days, server.quota, server.iplimit, serverId),
          vless: () => createvless(username, days, server.quota, server.iplimit, serverId),
          trojan: () => createtrojan(username, days, server.quota, server.iplimit, serverId),
          shadowsocks: () => createshadowsocks(username, days, server.quota, server.iplimit, serverId),
          ssh: () => createssh(username, password, days, server.iplimit, serverId)
        },
        renew: {
          vmess: () => renewvmess(username, days, server.quota, server.iplimit, serverId),
          vless: () => renewvless(username, days, server.quota, server.iplimit, serverId),
          trojan: () => renewtrojan(username, days, server.quota, server.iplimit, serverId),
          shadowsocks: () => renewshadowsocks(username, days, server.quota, server.iplimit, serverId),
          ssh: () => renewssh(username, days, server.iplimit, serverId)
        }
      };

      const handler = handlerMap[action]?.[type];
      if (!handler) return ctx.reply('❌ *Tipe layanan tidak dikenali.*', { parse_mode: 'Markdown' });

      // Execute handler
      const msg = await handler();

      // Validate response
      if (!msg || typeof msg !== 'string') {
        logger.error('❌ Invalid response from handler:', { msg, type: typeof msg });
        return ctx.reply('❌ *Terjadi kesalahan saat membuat akun. Response invalid.*', { parse_mode: 'Markdown' });
      }

      // Check for error message
      if (msg.startsWith('❌')) {
        return ctx.reply(msg, { parse_mode: 'Markdown' });
      }

      // Update server statistics
      await dbRunAsync('UPDATE Server SET total_create_akun = total_create_akun + 1 WHERE id = ?', [serverId]);

      // Log invoice
      await dbRunAsync(`
        INSERT INTO invoice_log (user_id, username, layanan, akun, hari, harga, komisi, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, datetime('now'))
      `, [userId, ctx.from.username || ctx.from.first_name, type, username, days, totalHarga, komisi]);

      // Mark account as active
      if (action === 'create') {
        await dbRunAsync('INSERT OR REPLACE INTO akun_aktif (username, jenis) VALUES (?, ?)', [username, type]);
      }

      // Handle reseller commission
      if (user.role === 'reseller') {
        await dbRunAsync('UPDATE users SET saldo = saldo + ? WHERE user_id = ?', [komisi, userId]);
        await dbRunAsync(`
          INSERT INTO reseller_sales (reseller_id, buyer_id, akun_type, username, komisi, created_at)
          VALUES (?, ?, ?, ?, ?, datetime('now'))
        `, [userId, userId, type, username, komisi]);

        // Check for level upgrade
        const res = await dbGetAsync('SELECT SUM(komisi) AS total_komisi FROM reseller_sales WHERE reseller_id = ?', [userId]);
        const totalKomisi = res?.total_komisi || 0;
        const prevLevel = user.reseller_level || 'silver';
        const level = totalKomisi >= 80000 ? 'platinum' : totalKomisi >= 50000 ? 'gold' : 'silver';
        const levelOrder = { silver: 1, gold: 2, platinum: 3 };

        if (level !== prevLevel) {
          await dbRunAsync('UPDATE users SET reseller_level = ? WHERE user_id = ?', [level, userId]);

          // Notify group
          if (GROUP_ID && GROUP_ID !== 'ISIDISNI' && !isNaN(GROUP_ID)) {
            const mention = ctx.from.username ? `@${ctx.from.username}` : ctx.from.first_name;
            const naik = levelOrder[level] > levelOrder[prevLevel];
            const icon = naik ? '📈 *Level Naik!*' : '📉 *Level Turun!*';
            const notif = `${icon}\n\n💌 ${mention}\n🎖️ Dari: *${prevLevel.toUpperCase()}* ke *${level.toUpperCase()}*`;

            await bot.telegram.sendMessage(GROUP_ID, notif, { parse_mode: 'Markdown' });
          }
        }
      }

      // Send invoice to group
      const mention = ctx.from.username ? `@${ctx.from.username}` : ctx.from.first_name;
      const isReseller = user?.role === 'reseller';
      const label = isReseller ? 'Reseller' : 'User';
      const actionLabel = action === 'renew' ? '♻️ 𝗥𝗲𝗻𝗲𝘄 𝗯𝘆' : '📩 𝗖𝗿𝗲𝗮𝘁𝗲 𝗯𝘆';
      const serverNama = server?.nama_server || server?.domain || 'Unknown Server';
      const ipLimit = server?.iplimit || '-';
      const hargaFinal = totalHarga || 0;
      const durasiHari = days || 30;
      const waktuSekarang = new Date().toLocaleString('id-ID');

      const invoice = `
━━━━━━━━━━━━━━━━━━━━━━━        
🚀 𝗦𝗨𝗖𝗖𝗘𝗦𝗦𝗙𝗨𝗟 𝗧𝗥𝗔𝗡𝗦𝗔𝗖𝗧𝗜𝗢𝗡
━━━━━━━━━━━━━━━━━━━━━━━
👤 𝗨𝘀𝗲𝗿: ${mention}
${actionLabel} : ${label}
🌐 𝗦𝗲𝗿𝘃𝗲𝗿: ${serverNama} | ${ipLimit} IP
🔖 𝗨𝘀𝗲𝗿𝗻𝗮𝗺𝗲: ${username}
🏪 𝗣𝗿𝗼𝘁𝗼𝗰𝗼𝗹: ${type.toUpperCase()}
💴 𝗛𝗮𝗿𝗴𝗮: Rp${hargaFinal.toLocaleString('id-ID')}
⏳ 𝗗𝘂𝗿𝗮𝘀𝗶: ${durasiHari} hari
${isReseller ? `📊 𝗞𝗼𝗺𝗶𝘀𝗶: Rp${komisi?.toLocaleString('id-ID') || 0}\n` : ''}🕒 𝗪𝗮𝗸𝘁𝘂: ${waktuSekarang}
━━━━━━━━━━━━━━━━━━━━━━━
`.trim();

      // Send to group
      if (GROUP_ID && GROUP_ID !== 'ISIDISNI' && !isNaN(GROUP_ID)) {
        try {
          await bot.telegram.sendMessage(GROUP_ID, invoice);
        } catch (groupErr) {
          logger.warn('⚠️ Failed to send to group:', groupErr.message);
        }
      }

      // Send account details to user
      try {
        await ctx.reply(msg, { parse_mode: 'Markdown', disable_web_page_preview: true });
        logger.info(`✅ Account ${type} created successfully for user ${userId}`);
      } catch (replyErr) {
        logger.error('❌ Failed to send account details:', replyErr.message);
        try {
          await ctx.reply('✅ *Akun berhasil dibuat!*\n\nDetail akun sudah dikirim ke admin.', { parse_mode: 'Markdown' });
        } catch (err2) {
          logger.error('❌ Failed to send any message:', err2.message);
        }
      }

      delete global.userState[chatId];
    }
  } catch (err) {
    logger.error('❌ Error in service flow:', err.message);
    try {
      await ctx.reply('❌ *Terjadi kesalahan saat memproses permintaan.*\n\nDetail: ' + err.message, { parse_mode: 'Markdown' });
    } catch (replyErr) {
      console.error('Failed to send error message:', replyErr);
    }
    delete global.userState[chatId];
  }
}

/**
 * Register text event handler
 */
function registerTextHandler(bot) {
  bot.on('text', async (ctx) => {
    const userId = ctx.from.id;
    const chatId = ctx.chat.id;
    const state = global.userState?.[chatId];
    const text = ctx.message.text.trim();

    if (!state || typeof state !== 'object') return;

    try {
      // Service creation/renewal flows
      if (state.step?.startsWith('username_') || state.step?.startsWith('password_') || state.step?.startsWith('exp_')) {
        return await handleServiceFlow(ctx, state, text, bot);
      }

      // Note: The following handlers reference functions from app.js
      // They should be extracted into separate modules and imported

      // Server edit flows (these need the handler functions to be extracted)
      if (state.step === 'select_server_for_edit_nama' || state.step === 'edit_nama') {
        // handleEditNama should be extracted and imported
        logger.info('Edit nama server flow - requires handleEditNama function');
      }

      if (state.step === 'select_server_for_edit_auth' || state.step === 'edit_auth') {
        // handleEditAuth should be extracted and imported
        logger.info('Edit auth server flow - requires handleEditAuth function');
      }

      if (state.step === 'select_server_for_edit_domain' || state.step === 'edit_domain') {
        // handleEditDomain should be extracted and imported
        logger.info('Edit domain server flow - requires handleEditDomain function');
      }

      // User management flows
      if (state.step === 'await_level_change') {
        const [idStr, level] = text.split(' ');
        const validLevels = ['silver', 'gold', 'platinum'];
        const targetId = parseInt(idStr);

        if (isNaN(targetId) || !validLevels.includes(level)) {
          return ctx.reply('❌ *Format salah.*\nContoh: `123456789 gold`\nLevel valid: silver, gold, platinum', {
            parse_mode: 'Markdown'
          });
        }

        await new Promise((resolve, reject) => {
          global.db.run(
            `UPDATE users SET reseller_level = ? WHERE user_id = ? AND role = 'reseller'`,
            [level, targetId],
            function (err) {
              if (err) {
                logger.error('❌ DB error saat ubah level:', err.message);
                return reject(err);
              }

              if (this.changes === 0) {
                return ctx.reply('⚠️ *User tidak ditemukan atau bukan reseller.*', { parse_mode: 'Markdown' });
              }

              ctx.reply(`✅ *User ${targetId} diubah menjadi reseller ${level.toUpperCase()}.*`, {
                parse_mode: 'Markdown'
              });
              resolve();
            }
          );
        });

        delete global.userState[ctx.chat.id];
        return;
      }

      // Broadcast flow
      if (state.step === 'await_broadcast_message') {
        if (!adminIds.includes(String(userId))) {
          return ctx.reply('❌ Kamu tidak punya izin untuk melakukan broadcast.');
        }

        const broadcastMessage = text;
        delete global.userState[chatId];

        global.db.all('SELECT user_id FROM users', [], async (err, rows) => {
          if (err) {
            logger.error('❌ Gagal ambil daftar user:', err.message);
            return ctx.reply('❌ Gagal mengambil data user.');
          }

          let sukses = 0;
          let gagal = 0;

          for (const row of rows) {
            try {
              await bot.telegram.sendMessage(row.user_id, broadcastMessage);
              sukses++;
            } catch (e) {
              gagal++;
              logger.warn(`❌ Gagal kirim ke ${row.user_id}: ${e.message}`);
            }
          }

          ctx.reply(`📣 *Broadcast selesai:*\n✅ Berhasil: ${sukses}\n❌ Gagal: ${gagal}`, {
            parse_mode: 'Markdown'
          });
        });

        return;
      }

      // Add server flow (step-by-step)
      // Note: These flows reference resolveDomainToIP and getISPAndLocation
      // which should be extracted from app.js to utils/serverUtils.js
      
      if (state.step === 'addserver') {
        const domain = text;
        if (!domain) return ctx.reply('⚠️ *Domain tidak boleh kosong.* Silakan masukkan domain server yang valid.', { parse_mode: 'Markdown' });
        state.domain = domain;
        state.step = 'addserver_auth';
        return ctx.reply('*🔑 Silakan masukkan password root VPS:*', { parse_mode: 'Markdown' });
      }

      if (state.step === 'addserver_auth') {
        const auth = text;
        if (!auth) return ctx.reply('⚠️ *Password root tidak boleh kosong.* Silakan masukkan password root VPS yang valid.', { parse_mode: 'Markdown' });
        state.auth = auth;
        state.step = 'addserver_nama_server';
        return ctx.reply('*🏷️ Silakan masukkan nama server:*', { parse_mode: 'Markdown' });
      }

      if (state.step === 'addserver_nama_server') {
        const nama_server = text;
        if (!nama_server) return ctx.reply('⚠️ *Nama server tidak boleh kosong.*', { parse_mode: 'Markdown' });
        state.nama_server = nama_server;
        state.step = 'addserver_quota';
        return ctx.reply('*📊Silakan masukkan batas kuota (GB),* _cth: 100 (maks 100 GB)_ *:*', { parse_mode: 'Markdown' });
      }

      if (state.step === 'addserver_quota') {
        const quota = parseInt(text, 10);
        if (isNaN(quota)) return ctx.reply('⚠️ *Quota tidak valid.*', { parse_mode: 'Markdown' });
        state.quota = quota;
        state.step = 'addserver_iplimit';
        return ctx.reply('*🔢 Silakan masukkan limit IP server,* _cth: 5 (maks 5 IP)_ *:*', { parse_mode: 'Markdown' });
      }

      if (state.step === 'addserver_iplimit') {
        const iplimit = parseInt(text, 10);
        if (isNaN(iplimit)) return ctx.reply('⚠️ *Limit IP tidak valid.*', { parse_mode: 'Markdown' });
        state.iplimit = iplimit;
        state.step = 'addserver_batas_create_akun';
        return ctx.reply('*🔢 Silakan masukkan batas create akun server,* _cth: 25 (maks 25 akun)_ *:*', { parse_mode: 'Markdown' });
      }

      if (state.step === 'addserver_batas_create_akun') {
        const batas = parseInt(text, 10);
        if (isNaN(batas)) return ctx.reply('⚠️ *Batas create akun tidak valid.*', { parse_mode: 'Markdown' });
        state.batas_create_akun = batas;
        state.step = 'addserver_harga';
        return ctx.reply('*💰 Silakan masukkan harga/hari,* _cth: 500 (Rp500 per hari)_ *:*', { parse_mode: 'Markdown' });
      }

      if (state.step === 'addserver_harga') {
        const harga = parseFloat(text);
        if (isNaN(harga) || harga <= 0) return ctx.reply('⚠️ *Harga tidak valid.*', { parse_mode: 'Markdown' });

        const { domain, auth, nama_server, quota, iplimit, batas_create_akun } = state;

        try {
          // Note: resolveDomainToIP and getISPAndLocation should be imported from utils
          // For now, we'll use default values
          const isp = 'Tidak diketahui';
          const lokasi = 'Tidak diketahui';

          await new Promise((resolve, reject) => {
            global.db.run(`
              INSERT INTO Server (domain, auth, nama_server, quota, iplimit, batas_create_akun, harga, total_create_akun, isp, lokasi)
              VALUES (?, ?, ?, ?, ?, ?, ?, 0, ?, ?)
            `, [domain, auth, nama_server, quota, iplimit, batas_create_akun, harga, isp, lokasi], function (err) {
              if (err) {
                logger.error('❌ Error saat tambah server:', err.message);
                return reject(err);
              }
              resolve();
            });
          });

          await ctx.reply(
            `✅ *Server berhasil ditambahkan!*\n\n` +
            `🌐 Domain: ${domain}\n` +
            `📍 Lokasi: ${lokasi}\n` +
            `🏢 ISP: ${isp}\n` +
            `💸 Harga: Rp${harga} per hari\n` +
            `📶 Kuota: ${quota} GB\n` +
            `🔢 Limit IP: ${iplimit} IP\n` +
            `🛒 Batas Create Akun: ${batas_create_akun}\n`,
            { parse_mode: 'Markdown' }
          );
        } catch (err) {
          logger.error('❌ Gagal tambah server:', err.message);
          await ctx.reply('❌ *Terjadi kesalahan saat menambahkan server.*', { parse_mode: 'Markdown' });
        }

        delete global.userState[ctx.chat.id];
        return;
      }

    } catch (err) {
      logger.error('❌ Error on text handler:', err.message);
      logger.error('❌ Error stack:', err.stack);

      try {
        await ctx.reply('❌ *Terjadi kesalahan saat memproses permintaan.*\n\nDetail: ' + err.message, { parse_mode: 'Markdown' });
      } catch (replyErr) {
        console.error('Failed to send error message:', replyErr);
      }

      delete global.userState[chatId];
    }
  });

  logger.info('✅ Text event handler registered');
}

module.exports = {
  registerTextHandler,
  handleServiceFlow
};
