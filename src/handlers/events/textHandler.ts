
import type { BotContext, DatabaseUser, DatabaseServer } from "../../types";
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

const { dbGetAsync, dbRunAsync, dbAllAsync } = require('../../database/connection');
const { escapeMarkdown, escapeMarkdownV2 } = require('../../utils/markdown');
const logger = require('../../utils/logger');

// Import service creation modules
const { createssh } = require('../../modules/protocols/ssh/createSSH');
const { createvmess } = require('../../modules/protocols/vmess/createVMESS');
const { createvless } = require('../../modules/protocols/vless/createVLESS');
const { createtrojan } = require('../../modules/protocols/trojan/createTROJAN');
const { createshadowsocks } = require('../../modules/protocols/shadowsocks/createSHADOWSOCKS');
const { create3in1 } = require('../../modules/protocols/3in1/create3IN1');
const { renewssh } = require('../../modules/protocols/ssh/renewSSH');
const { renewvmess } = require('../../modules/protocols/vmess/renewVMESS');
const { renewvless } = require('../../modules/protocols/vless/renewVLESS');
const { renewtrojan } = require('../../modules/protocols/trojan/renewTROJAN');
const { renewshadowsocks } = require('../../modules/protocols/shadowsocks/renewSHADOWSOCKS');
const { renew3in1 } = require('../../modules/protocols/3in1/renew3IN1');

// Import utilities (these functions should exist in app.js or be moved to utils)
// const { resolveDomainToIP, getISPAndLocation } = require('../../utils/serverUtils');
// For now, we'll use placeholder - these should be extracted from app.js

const GROUP_ID = process.env.GROUP_ID ? parseInt(process.env.GROUP_ID, 10) : null;
const adminIds = (process.env.ADMIN_IDS || '').split(',').filter(Boolean);

// Note: These handler functions (handleEditNama, handleEditAuth, etc.) are referenced from app.js
// They should be extracted and imported here, but for now we'll note them as dependencies

/**
 * Handle service creation/renewal flow
 * NEW FLOW: username → password (SSH only) → payment confirmation → create
 */
async function handleServiceFlow(ctx, state, text, bot) {
  const chatId = ctx.chat.id;
  const userId = ctx.from.id;
  const { Markup } = require('telegraf');

  try {
    // Step 1: Username input
    if (typeof state.step === 'string' && state.step.startsWith('username_')) {
      if (!/^[a-zA-Z0-9_]{3,20}$/.test(text)) {
        return ctx.reply('❌ *Username tidak valid.* Gunakan huruf, angka, underscore (3-20 karakter).', { parse_mode: 'Markdown' });
      }

      // For create action, check if username already exists
      if (state.action === 'create') {
        const existingUser = await dbGetAsync(
          'SELECT * FROM akun_aktif WHERE username = ?',
          [text]
        );
        if (existingUser) {
          return ctx.reply(
            `❌ *Username sudah digunakan!*\n\n` +
            `Username \`${text}\` sudah terdaftar untuk ${existingUser.jenis.toUpperCase()}.\n` +
            `Silakan masukkan username lain:`,
            { parse_mode: 'Markdown' }
          );
        }
      }

      state.username = text;

      // For renew action, check if account exists
      if (state.action === 'renew') {
        // For 3in1, check if account exists in all three protocols
        if (state.type === '3in1') {
          const vmessExists = await dbGetAsync('SELECT * FROM akun_aktif WHERE username = ? AND jenis = ?', [text, 'vmess']);
          const vlessExists = await dbGetAsync('SELECT * FROM akun_aktif WHERE username = ? AND jenis = ?', [text, 'vless']);
          const trojanExists = await dbGetAsync('SELECT * FROM akun_aktif WHERE username = ? AND jenis = ?', [text, 'trojan']);
          
          if (!vmessExists || !vlessExists || !trojanExists) {
            const missing = [];
            if (!vmessExists) missing.push('VMESS');
            if (!vlessExists) missing.push('VLESS');
            if (!trojanExists) missing.push('TROJAN');
            return ctx.reply(
              `❌ *Akun 3IN1 tidak lengkap!*\n\n` +
              `Username \`${text}\` tidak ditemukan di: ${missing.join(', ')}.\n` +
              `Akun 3IN1 harus ada di ketiga protokol.`,
              { parse_mode: 'Markdown' }
            );
          }
        } else {
          // For other protocols, check normally
          const row = await dbGetAsync(
            'SELECT * FROM akun_aktif WHERE username = ? AND jenis = ?',
            [text, state.type]
          );
          if (!row) {
            return ctx.reply('❌ *Akun tidak ditemukan atau tidak aktif.*', { parse_mode: 'Markdown' });
          }
        }
      }

      // For SSH create, ask for password first
      if (state.type === 'ssh' && state.action === 'create') {
        state.step = `password_${state.action}_${state.type}`;
        return ctx.reply(
          `🔑 Masukkan Password\n\n` +
          `Password untuk akun SSH (minimal 6 karakter):`
        );
      }

      // For other protocols or renew, show duration selection
      const { showDurationSelection } = require('../actions/serviceActions');
      return await showDurationSelection(ctx, state.type, state.action, state.serverId);
    }

    // Step 2: Password input (SSH only)
    if (state.step.startsWith('password_')) {
      if (!/^[a-zA-Z0-9]{6,}$/.test(text)) {
        return ctx.reply('❌ *Password minimal 6 karakter dan tanpa simbol.*', { parse_mode: 'Markdown' });
      }

      state.password = text;
      
      // Show duration selection after password
      const { showDurationSelection } = require('../actions/serviceActions');
      return await showDurationSelection(ctx, state.type, state.action, state.serverId);
    }

    // OLD FLOW BELOW - Keep for backward compatibility with old renew flow
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

      // For 3in1, price is 1.5x
      const priceMultiplier = type === '3in1' ? 1.5 : 1;
      const hargaSatuan = Math.floor(server.harga * (1 - diskon) * priceMultiplier);
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
          vmess: () => createvmess(username, days, server.quota, server.iplimit, serverId, totalHarga, days),
          vless: () => createvless(username, days, server.quota, server.iplimit, serverId, totalHarga, days),
          trojan: () => createtrojan(username, days, server.quota, server.iplimit, serverId, totalHarga, days),
          shadowsocks: () => createshadowsocks(username, days, server.quota, server.iplimit, serverId, totalHarga, days),
          ssh: () => createssh(username, password, days, server.iplimit, serverId, totalHarga, days),
          '3in1': () => create3in1(username, days, server.quota, server.iplimit, serverId, totalHarga, days)
        },
        renew: {
          vmess: () => renewvmess(username, days, server.quota, server.iplimit, serverId, totalHarga, days),
          vless: () => renewvless(username, days, server.quota, server.iplimit, serverId, totalHarga, days),
          trojan: () => renewtrojan(username, days, server.quota, server.iplimit, serverId, totalHarga, days),
          shadowsocks: () => renewshadowsocks(username, days, server.quota, server.iplimit, serverId, totalHarga, days),
          ssh: () => renewssh(username, days, server.iplimit, serverId, totalHarga, days),
          '3in1': () => renew3in1(username, days, server.quota, server.iplimit, serverId, totalHarga, days)
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
        // If username already exists, keep state and ask for new username
        if (msg.includes('Username sudah digunakan')) {
          state.step = `username_${action}_${type}`;
          delete state.username;
          if (state.password) delete state.password;
          
          return ctx.reply(
            `${msg}\n\n` +
            `📝 Masukkan Username Baru\n\n` +
            `Format: huruf kecil, angka, underscore (3-20 karakter)\n` +
            `Contoh: user123, my_vpn\n\n` +
            `Ketik username yang diinginkan:`,
            { parse_mode: 'Markdown' }
          );
        }
        
        // For other errors, clear state
        delete global.userState[chatId];
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
        // For 3in1, mark all three protocols
        if (type === '3in1') {
          await dbRunAsync('INSERT OR REPLACE INTO akun_aktif (username, jenis) VALUES (?, ?)', [username, 'vmess']);
          await dbRunAsync('INSERT OR REPLACE INTO akun_aktif (username, jenis) VALUES (?, ?)', [username, 'vless']);
          await dbRunAsync('INSERT OR REPLACE INTO akun_aktif (username, jenis) VALUES (?, ?)', [username, 'trojan']);
        } else {
          await dbRunAsync('INSERT OR REPLACE INTO akun_aktif (username, jenis) VALUES (?, ?)', [username, type]);
        }
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
          if (GROUP_ID && !isNaN(GROUP_ID)) {
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
      if (GROUP_ID && !isNaN(GROUP_ID)) {
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

      // Persist account to database (non-trial only, create action only)
      if (action === 'create') {
        try {
          const { persistAccountIfPremium } = require('../../utils/accountPersistence');
          await persistAccountIfPremium({
            message: msg,
            protocol: type,
            userId: userId
          });
        } catch (persistError) {
          logger.error('⚠️ Failed to persist account (non-critical):', persistError);
          // Continue execution - this is not critical
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

      // Server edit nama flow (only handle text input after button selection)
      if (state.step === 'edit_nama') {
        const newNama = text.trim();
        const serverId = state.serverId;

        if (!newNama) {
          return ctx.reply('❌ *Nama server tidak boleh kosong.*', { parse_mode: 'Markdown' });
        }

        // Get current server data
        const server = await dbGetAsync('SELECT * FROM Server WHERE id = ?', [serverId]).catch(err => {
          logger.error('❌ Error getting server:', err);
          return null;
        });

        if (!server) {
          return ctx.reply('⚠️ *Server tidak ditemukan.*', { parse_mode: 'Markdown' });
        }

        // Update server nama
        await dbRunAsync('UPDATE Server SET nama_server = ? WHERE id = ?', [newNama, serverId]).catch(err => {
          logger.error('❌ Error updating server nama:', err);
          throw err;
        });

        delete global.userState[ctx.chat.id];
        await ctx.reply(
          `✅ *Server berhasil diperbarui!*\n\n` +
          `Nama server: *${newNama}*\n` +
          `IP/Host: *${server.domain}*\n` +
          `Status: Aktif`,
          { parse_mode: 'Markdown' }
        );
        return;
      }

      // Server edit auth flow (only handle text input after button selection)
      if (state.step === 'edit_auth') {
        const newAuth = text.trim();
        const serverId = state.serverId;

        if (!newAuth) {
          return ctx.reply('❌ *Auth tidak boleh kosong.*', { parse_mode: 'Markdown' });
        }

        // Get current server data
        const server = await dbGetAsync('SELECT * FROM Server WHERE id = ?', [serverId]).catch(err => {
          logger.error('❌ Error getting server:', err);
          return null;
        });

        if (!server) {
          return ctx.reply('⚠️ *Server tidak ditemukan.*', { parse_mode: 'Markdown' });
        }

        // Update server auth
        await dbRunAsync('UPDATE Server SET auth = ? WHERE id = ?', [newAuth, serverId]).catch(err => {
          logger.error('❌ Error updating server auth:', err);
          throw err;
        });

        delete global.userState[ctx.chat.id];
        await ctx.reply(
          `✅ *Server berhasil diperbarui!*\n\n` +
          `Nama server: *${server.nama_server}*\n` +
          `IP/Host: *${server.domain}*\n` +
          `Auth: *diperbarui*\n` +
          `Status: Aktif`,
          { parse_mode: 'Markdown' }
        );
        return;
      }

      // Server edit domain flow (only handle text input after button selection)
      if (state.step === 'edit_domain') {
        const newDomain = text.trim();
        const serverId = state.serverId;

        if (!newDomain) {
          return ctx.reply('❌ *Domain tidak boleh kosong.*', { parse_mode: 'Markdown' });
        }

        // Get current server data
        const server = await dbGetAsync('SELECT * FROM Server WHERE id = ?', [serverId]).catch(err => {
          logger.error('❌ Error getting server:', err);
          return null;
        });

        if (!server) {
          return ctx.reply('⚠️ *Server tidak ditemukan.*', { parse_mode: 'Markdown' });
        }

        // Update server domain
        await dbRunAsync('UPDATE Server SET domain = ? WHERE id = ?', [newDomain, serverId]).catch(err => {
          logger.error('❌ Error updating server domain:', err);
          throw err;
        });

        delete global.userState[ctx.chat.id];
        await ctx.reply(
          `✅ *Server berhasil diperbarui!*\n\n` +
          `Nama server: *${server.nama_server}*\n` +
          `IP/Host: *${newDomain}*\n` +
          `Status: Aktif`,
          { parse_mode: 'Markdown' }
        );
        return;
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

        const result = await dbRunAsync(
          `UPDATE users SET reseller_level = ? WHERE user_id = ? AND role = 'reseller'`,
          [level, targetId]
        ).catch(err => {
          logger.error('❌ DB error saat ubah level:', err.message);
          return null;
        });

        if (!result || result.changes === 0) {
          return ctx.reply('⚠️ *User tidak ditemukan atau bukan reseller.*', { parse_mode: 'Markdown' });
        }

        await ctx.reply(`✅ *User ${targetId} diubah menjadi reseller ${level.toUpperCase()}.*`, {
          parse_mode: 'Markdown'
        });

        delete global.userState[ctx.chat.id];
        return;
      }

      // Broadcast flow
      if (state.step === 'await_broadcast_message') {
        // Check if user is admin from database only
        const user = await dbGetAsync('SELECT role FROM users WHERE user_id = ?', [userId]);
        
        if (!user || (user.role !== 'admin' && user.role !== 'owner')) {
          return ctx.reply('❌ Kamu tidak punya izin untuk melakukan broadcast.');
        }

        const broadcastMessage = text;
        delete global.userState[chatId];

        const rows = await dbAllAsync('SELECT user_id FROM users', []).catch(err => {
          logger.error('❌ Gagal ambil daftar user:', err.message);
          return null;
        });

        if (!rows) {
          return ctx.reply('❌ Gagal mengambil data user.');
        }

        let sukses = 0;
        let gagal = 0;

        for (const row of rows) {
          try {
            await bot.telegram.sendMessage(row.user_id, broadcastMessage);
            sukses++;
          } catch (e: any) {
            gagal++;
            logger.warn(`❌ Gagal kirim ke ${row.user_id}: ${e.message}`);
          }
        }

        await ctx.reply(`📣 *Broadcast selesai:*\n✅ Berhasil: ${sukses}\n❌ Gagal: ${gagal}`, {
          parse_mode: 'Markdown'
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

          logger.info(`📝 Attempting to add server: ${nama_server} (${domain})`);
          logger.info(`📊 Server details - Quota: ${quota}GB, IP Limit: ${iplimit}, Price: ${harga}`);

          // Use dbRunAsync instead of global.db.run
          const result = await dbRunAsync(`
            INSERT INTO Server (domain, auth, nama_server, quota, iplimit, batas_create_akun, harga, total_create_akun, isp, lokasi)
            VALUES (?, ?, ?, ?, ?, ?, ?, 0, ?, ?)
          `, [domain, auth, nama_server, quota, iplimit, batas_create_akun, harga, isp, lokasi]);

          logger.info(`✅ Server added successfully with ID: ${result.lastID}`);

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
        } catch (err: any) {
          logger.error('❌ Gagal tambah server:', {
            message: err.message,
            code: err.code,
            errno: err.errno,
            stack: err.stack
          });
          
          let errorMsg = '❌ *Terjadi kesalahan saat menambahkan server.*\n\n';
          
          if (err.message.includes('UNIQUE constraint failed')) {
            errorMsg += '⚠️ Domain atau nama server sudah ada.';
          } else if (err.message.includes('no such table')) {
            errorMsg += '⚠️ Tabel Server belum ada. Silakan restart bot.';
          } else {
            errorMsg += `Detail: ${err.message}`;
          }
          
          await ctx.reply(errorMsg, { parse_mode: 'Markdown' });
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

/**
 * Show payment confirmation screen
 * @param {Object} ctx - Telegraf context
 * @param {Object} state - User state
 */
async function showPaymentConfirmation(ctx, state) {
  const { Markup } = require('telegraf');
  const { username, password, serverId, type, action, duration, serverName, serverDomain, harga } = state;
  const userId = ctx.from.id;

  try {
    // Get server details
    const server = await dbGetAsync('SELECT * FROM Server WHERE id = ?', [serverId]);
    if (!server) {
      return ctx.reply('❌ *Server tidak ditemukan.*', { parse_mode: 'Markdown' });
    }

    // Get user details
    let user = await dbGetAsync('SELECT * FROM users WHERE user_id = ?', [userId]);
    if (!user) {
      await dbRunAsync(
        `INSERT INTO users (user_id, username, saldo, role, reseller_level) VALUES (?, ?, 0, 'user', 'silver')`,
        [userId, ctx.from.username]
      );
      user = { saldo: 0, role: 'user', reseller_level: 'silver' };
    }

    // Calculate price with reseller discount
    const diskon = user.role === 'reseller'
      ? user.reseller_level === 'gold' ? 0.2
      : user.reseller_level === 'platinum' ? 0.3
      : 0.1
      : 0;

    // For 3in1, price is 1.5x
    const priceMultiplier = type === '3in1' ? 1.5 : 1;
    const hargaSatuan = Math.floor(server.harga * (1 - diskon) * priceMultiplier);
    const totalHarga = hargaSatuan * duration;

    // Protocol label
    const protocolLabels = {
      ssh: 'SSH',
      vmess: 'VMESS',
      vless: 'VLESS',
      trojan: 'TROJAN',
      shadowsocks: 'SHADOWSOCKS',
      '3in1': '3IN1 (VMESS+VLESS+TROJAN)'
    };

    // Check balance
    const cukup = user.saldo >= totalHarga;

    const message = `
💳 *Konfirmasi Pembayaran*

📦 Akun premium *${protocolLabels[type] || type.toUpperCase()}*
🌐 Host: \`${server.domain}\`
👤 Username: \`${username}\`
⏱ Masa aktif: *${duration} Hari*
💰 Total harga: *Rp ${totalHarga.toLocaleString('id-ID')}*
💵 Saldo tersedia: *Rp ${user.saldo.toLocaleString('id-ID')}*
    `.trim();

    if (!cukup) {
      // Insufficient balance
      return ctx.reply(
        `${message}\n\n❌ *Saldo Tidak Mencukupi*\n\nSaldo Anda hanya Rp${user.saldo.toLocaleString('id-ID')}.\nUntuk melanjutkan silakan top up terlebih dahulu.`,
        {
          parse_mode: 'Markdown',
          reply_markup: {
            inline_keyboard: [[{ text: '💰 Top Up', callback_data: 'deposit' }]]
          }
        }
      );
    }

    // Sufficient balance - show payment buttons
    const buttons = [
      [
        Markup.button.callback('❌ Batal', `cancel_${action}_${type}_${serverId}_${duration}`),
        Markup.button.callback('✅ Bayar', `pay_${action}_${type}_${serverId}_${duration}`)
      ]
    ];

    return ctx.reply(message, {
      parse_mode: 'Markdown',
      ...Markup.inlineKeyboard(buttons)
    });

  } catch (error) {
    logger.error('❌ Error showing payment confirmation:', error);
    return ctx.reply('❌ *Terjadi kesalahan saat menampilkan konfirmasi pembayaran.*', { parse_mode: 'Markdown' });
  }
}

module.exports = {
  registerTextHandler,
  handleServiceFlow,
  showPaymentConfirmation
};
