
import type { BotContext, DatabaseUser, DatabaseServer } from "../../types";
/**
 * Create Account Actions Handler
 * Handles account creation for all protocols (SSH, VMESS, VLESS, TROJAN, SHADOWSOCKS)
 */

const logger = require('../../utils/logger');
const { dbGetAsync } = require('../../database/connection');
const createSSH = require('../../modules/protocols/ssh/createSSH');
const createVMESS = require('../../modules/protocols/vmess/createVMESS');
const createVLESS = require('../../modules/protocols/vless/createVLESS');
const createTROJAN = require('../../modules/protocols/trojan/createTROJAN');
const createSHADOWSOCKS = require('../../modules/protocols/shadowsocks/createSHADOWSOCKS');
const create3IN1 = require('../../modules/protocols/3in1/create3IN1');

/**
 * Register all create account actions
 */
function registerCreateActions(bot) {
  // Server selection handlers - redirect to username input
  const protocols = ['ssh', 'vmess', 'vless', 'trojan', 'shadowsocks', '3in1'];
  
  protocols.forEach(protocol => {
    bot.action(new RegExp(`^create_server_${protocol}_(\\d+)$`), async (ctx) => {
      const serverId = ctx.match[1];
      await handleServerSelection(ctx, protocol, serverId, 'create');
    });
  });

  // Duration selection handlers - show username input
  bot.action(/^duration_create_([a-z0-9]+)_(\d+)_(\d+)$/, async (ctx) => {
    await handleDurationSelection(ctx, 'create');
  });

  // Payment confirmation handlers
  bot.action(/^pay_create_([a-z0-9]+)_(\d+)_(\d+)$/, async (ctx) => {
    await handlePaymentConfirmation(ctx, 'create');
  });

  // Cancel handlers
  bot.action(/^cancel_create_([a-z0-9]+)_(\d+)_(\d+)$/, async (ctx) => {
    await ctx.editMessageText('❌ *Pembuatan akun dibatalkan.*', { parse_mode: 'Markdown' });
    delete global.userState[ctx.chat.id];
  });

  logger.info('✅ Create account actions registered');
}

/**
 * Handle server selection - ask for username
 */
async function handleServerSelection(ctx, protocol, serverId, action) {
  await ctx.answerCbQuery();

  try {
    // Get server
    const server = await dbGetAsync('SELECT * FROM Server WHERE id = ?', [serverId]);
    if (!server) {
      return ctx.reply('❌ Server tidak ditemukan.');
    }

    // Set user state
    if (!global.userState) global.userState = {};
    global.userState[ctx.chat.id] = {
      step: `username_${action}_${protocol}`,
      action: action,
      type: protocol,
      serverId: serverId,
      serverName: server.nama_server,
      serverDomain: server.domain,
      harga: server.harga
    };

    // Ask for username
    await ctx.editMessageText(
      `📝 Masukkan Username\n\n` +
      `Format: huruf kecil, angka, underscore (3-20 karakter)\n` +
      `Contoh: user123, my_vpn\n\n` +
      `Ketik username yang diinginkan:`
    );

  } catch (error) {
    logger.error(`❌ Error handling server selection:`, error);
    await ctx.reply('❌ Terjadi kesalahan. Silakan coba lagi.');
  }
}

/**
 * Handle duration selection - set duration and continue to next step
 */
async function handleDurationSelection(ctx, action) {
  const protocol = ctx.match[1];   // protocol name
  const serverId = ctx.match[2];   // server id
  const duration = parseInt(ctx.match[3]);  // duration in days
  const userId = ctx.from.id;
  const chatId = ctx.chat.id;

  await ctx.answerCbQuery();

  try {
    const state = global.userState[chatId];
    if (!state) {
      return ctx.reply('❌ Session expired. Silakan mulai lagi.');
    }

    // Update state with duration
    state.duration = duration;

    // Show payment confirmation (password already collected in text handler for SSH)
    const { showPaymentConfirmation } = require('../events/textHandler');
    await showPaymentConfirmation(ctx, state);

  } catch (error) {
    logger.error(`❌ Error handling duration selection:`, error);
    await ctx.reply('❌ Terjadi kesalahan. Silakan coba lagi.');
  }
}

/**
 * Handle payment confirmation and create account
 */
async function handlePaymentConfirmation(ctx, action) {
  const protocol = ctx.match[1];
  const serverId = ctx.match[2];
  const duration = parseInt(ctx.match[3]);
  const userId = ctx.from.id;
  const chatId = ctx.chat.id;

  await ctx.answerCbQuery();

  try {
    const state = global.userState[chatId];
    if (!state) {
      return ctx.reply('❌ Session expired. Silakan mulai lagi.');
    }

    const { username, password, harga } = state;
    
    // Get server
    const server = await dbGetAsync('SELECT * FROM Server WHERE id = ?', [serverId]);
    if (!server) {
      return ctx.reply('❌ Server tidak ditemukan.');
    }

    // Get user
    const { dbRunAsync } = require('../../database/connection');
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
    const priceMultiplier = protocol === '3in1' ? 1.5 : 1;
    const hargaSatuan = Math.floor(server.harga * (1 - diskon) * priceMultiplier);
    const totalHarga = hargaSatuan * duration;

    // Check balance again
    if (user.saldo < totalHarga) {
      return ctx.editMessageText(
        `❌ *Saldo Tidak Mencukupi*\n\n` +
        `Saldo Anda hanya Rp${user.saldo.toLocaleString('id-ID')}.\n` +
        `Untuk melanjutkan silakan top up terlebih dahulu.`,
        {
          parse_mode: 'Markdown',
          reply_markup: {
            inline_keyboard: [[{ text: '💰 Top Up', callback_data: 'deposit' }]]
          }
        }
      );
    }

    // Deduct balance
    await dbRunAsync('UPDATE users SET saldo = saldo - ? WHERE user_id = ?', [totalHarga, userId]);

    // Handler mapping
    const handlerMap = {
      ssh: () => createSSH.createssh(username, password, duration, server.iplimit, serverId, totalHarga, duration),
      vmess: () => createVMESS.createvmess(username, duration, server.quota, server.iplimit, serverId, totalHarga, duration),
      vless: () => createVLESS.createvless(username, duration, server.quota, server.iplimit, serverId, totalHarga, duration),
      trojan: () => createTROJAN.createtrojan(username, duration, server.quota, server.iplimit, serverId, totalHarga, duration),
      shadowsocks: () => createSHADOWSOCKS.createshadowsocks(username, duration, server.quota, server.iplimit, serverId, totalHarga, duration),
      '3in1': () => create3IN1.create3in1(username, duration, server.quota, server.iplimit, serverId, totalHarga, duration)
    };

    const handler = handlerMap[protocol];
    if (!handler) {
      return ctx.reply('❌ Protocol tidak dikenali.');
    }

    await ctx.editMessageText('⏳ *Sedang membuat akun...* Mohon tunggu.', { parse_mode: 'Markdown' });

    // Execute handler
    const msg = await handler();

    // Validate response
    if (!msg || typeof msg !== 'string') {
      logger.error('❌ Invalid response from handler:', { msg, type: typeof msg });
      return ctx.reply('❌ *Terjadi kesalahan saat membuat akun.*', { parse_mode: 'Markdown' });
    }

    // Check for error message
    if (msg.startsWith('❌')) {
      // Refund if creation failed
      await dbRunAsync('UPDATE users SET saldo = saldo + ? WHERE user_id = ?', [totalHarga, userId]);
      
      // If username already exists, keep state and ask for new username
      if (msg.includes('Username sudah digunakan')) {
        state.step = `username_${action}_${protocol}`;
        delete state.username; // Clear old username
        if (state.password) delete state.password; // Clear password too for SSH
        
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
    const komisi = user.role === 'reseller' ? Math.floor(server.harga * duration * 0.1) : 0;
    await dbRunAsync(`
      INSERT INTO invoice_log (user_id, username, layanan, akun, hari, harga, komisi, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, datetime('now'))
    `, [userId, ctx.from.username || ctx.from.first_name, protocol, username, duration, totalHarga, komisi]);

    // Mark account as active
    // For 3in1, mark all three protocols
    if (protocol === '3in1') {
      await dbRunAsync('INSERT OR REPLACE INTO akun_aktif (username, jenis) VALUES (?, ?)', [username, 'vmess']);
      await dbRunAsync('INSERT OR REPLACE INTO akun_aktif (username, jenis) VALUES (?, ?)', [username, 'vless']);
      await dbRunAsync('INSERT OR REPLACE INTO akun_aktif (username, jenis) VALUES (?, ?)', [username, 'trojan']);
    } else {
      await dbRunAsync('INSERT OR REPLACE INTO akun_aktif (username, jenis) VALUES (?, ?)', [username, protocol]);
    }

    // Handle reseller commission
    if (user.role === 'reseller') {
      await dbRunAsync('UPDATE users SET saldo = saldo + ? WHERE user_id = ?', [komisi, userId]);
      await dbRunAsync(`
        INSERT INTO reseller_sales (reseller_id, buyer_id, akun_type, username, komisi, created_at)
        VALUES (?, ?, ?, ?, ?, datetime('now'))
      `, [userId, userId, protocol, username, komisi]);
    }

    // Send success message
    await ctx.reply(msg, { parse_mode: 'Markdown' });

    // Persist account to database (non-trial only)
    try {
      const { persistAccountIfPremium } = require('../../utils/accountPersistence');
      await persistAccountIfPremium({
        message: msg,
        protocol: protocol,
        userId: userId
      });
    } catch (persistError) {
      logger.error('⚠️ Failed to persist account (non-critical):', persistError);
      // Continue execution - this is not critical
    }

    // Clean up state
    delete global.userState[chatId];

  } catch (error) {
    logger.error(`❌ Error in payment confirmation:`, error);
    await ctx.reply('❌ Terjadi kesalahan. Silakan coba lagi.');
  }
}

/**
 * Handle account creation (OLD FUNCTION - DEPRECATED)
 */
async function handleCreateAccount(ctx, protocol, serverId, createFunction) {
  const userId = ctx.from.id;
  const chatId = ctx.chat.type === 'private' ? ctx.chat.id : ctx.from.id;

  await ctx.answerCbQuery();

  if (ctx.chat.type !== 'private') {
    await ctx.telegram.sendMessage(chatId, '✅ Proses pembuatan akun berjalan, cek DM!');
  }

  try {
    // Get server
    const server = await dbGetAsync('SELECT * FROM Server WHERE id = ?', [serverId]);
    if (!server) {
      return ctx.telegram.sendMessage(chatId, '❌ Server tidak ditemukan.');
    }

    // Get user to check balance and limits
    const user = await dbGetAsync('SELECT * FROM users WHERE user_id = ?', [userId]);
    if (!user) {
      return ctx.telegram.sendMessage(chatId, '❌ User tidak terdaftar. Silakan /start terlebih dahulu.');
    }

    // Check if user has enough balance
    const price = server.harga || 0;
    if (user.saldo < price) {
      return ctx.telegram.sendMessage(
        chatId,
        `❌ Saldo tidak cukup!\n\nHarga: Rp ${price.toLocaleString('id-ID')}\nSaldo Anda: Rp ${user.saldo.toLocaleString('id-ID')}\n\nSilakan isi saldo terlebih dahulu.`
      );
    }

    // Set user state for input
    if (!global.userState) global.userState = {};
    global.userState[chatId] = {
      step: `username_create_${protocol}`,
      action: 'create',
      type: protocol,
      serverId: serverId,
      serverName: server.nama_server,
      price: price,
      protocol: protocol
    };

    // Ask for username
    await ctx.telegram.sendMessage(
      chatId,
      `📝 Masukkan Username\n\nFormat: huruf kecil, angka, underscore\nContoh: user123, my_vpn\n\nKetik username yang diinginkan:`
    );

  } catch (error) {
    logger.error(`❌ Error creating ${protocol} account:`, error);
    await ctx.telegram.sendMessage(chatId, '❌ Terjadi kesalahan. Silakan coba lagi.');
  }
}

module.exports = {
  registerCreateActions,
  handleCreateAccount
};
