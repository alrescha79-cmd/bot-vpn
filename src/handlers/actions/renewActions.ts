
import type { BotContext, DatabaseUser, DatabaseServer } from "../../types";
/**
 * Renew Account Actions Handler
 * Handles account renewal for all protocols
 */

const logger = require('../../utils/logger');
const { dbGetAsync } = require('../../database/connection');
const renewSSH = require('../../modules/protocols/ssh/renewSSH');
const renewVMESS = require('../../modules/protocols/vmess/renewVMESS');
const renewVLESS = require('../../modules/protocols/vless/renewVLESS');
const renewTROJAN = require('../../modules/protocols/trojan/renewTROJAN');
const renewSHADOWSOCKS = require('../../modules/protocols/shadowsocks/renewSHADOWSOCKS');
const renew3IN1 = require('../../modules/protocols/3in1/renew3IN1');

/**
 * Register all renew account actions
 */
function registerRenewActions(bot) {
  // Server selection handlers - redirect to username input
  const protocols = ['ssh', 'vmess', 'vless', 'trojan', 'shadowsocks', '3in1'];
  
  protocols.forEach(protocol => {
    bot.action(new RegExp(`^renew_server_${protocol}_(\\d+)$`), async (ctx) => {
      const serverId = ctx.match[1];
      await handleServerSelection(ctx, protocol, serverId, 'renew');
    });
  });

  // Duration selection handlers - continue flow
  bot.action(/^duration_renew_([a-z0-9]+)_(\d+)_(\d+)$/, async (ctx) => {
    await handleDurationSelection(ctx, 'renew');
  });

  // Payment confirmation handlers
  bot.action(/^pay_renew_([a-z0-9]+)_(\d+)_(\d+)$/, async (ctx) => {
    await handlePaymentConfirmation(ctx, 'renew');
  });

  // Cancel handlers
  bot.action(/^cancel_renew_([a-z0-9]+)_(\d+)_(\d+)$/, async (ctx) => {
    await ctx.editMessageText('❌ *Perpanjangan dibatalkan.*', { parse_mode: 'Markdown' });
    delete global.userState[ctx.chat.id];
  });

  logger.info('✅ Renew account actions registered');
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
      `Ketik username akun yang ingin diperpanjang:`
    );

  } catch (error) {
    logger.error(`❌ Error handling server selection:`, error);
    await ctx.reply('❌ Terjadi kesalahan. Silakan coba lagi.');
  }
}

/**
 * Handle duration selection - set duration and show payment confirmation
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

    // Show payment confirmation
    const { showPaymentConfirmation } = require('../events/textHandler');
    await showPaymentConfirmation(ctx, state);

  } catch (error) {
    logger.error(`❌ Error handling duration selection:`, error);
    await ctx.reply('❌ Terjadi kesalahan. Silakan coba lagi.');
  }
}

/**
 * Handle payment confirmation and renew account
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

    const { username } = state;
    
    // Get server
    const server = await dbGetAsync('SELECT * FROM Server WHERE id = ?', [serverId]);
    if (!server) {
      return ctx.reply('❌ Server tidak ditemukan.');
    }

    // Verify account exists
    const accountExists = await dbGetAsync(
      'SELECT * FROM akun_aktif WHERE username = ? AND jenis = ?',
      [username, protocol]
    );
    if (!accountExists) {
      return ctx.editMessageText('❌ *Akun tidak ditemukan atau tidak aktif.*', { parse_mode: 'Markdown' });
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
      ssh: () => renewSSH.renewssh(username, duration, server.iplimit, serverId, totalHarga, duration),
      vmess: () => renewVMESS.renewvmess(username, duration, server.quota, server.iplimit, serverId, totalHarga, duration),
      vless: () => renewVLESS.renewvless(username, duration, server.quota, server.iplimit, serverId, totalHarga, duration),
      trojan: () => renewTROJAN.renewtrojan(username, duration, server.quota, server.iplimit, serverId, totalHarga, duration),
      shadowsocks: () => renewSHADOWSOCKS.renewshadowsocks(username, duration, server.quota, server.iplimit, serverId, totalHarga, duration),
      '3in1': () => renew3IN1.renew3in1(username, duration, server.quota, server.iplimit, serverId, totalHarga, duration)
    };

    const handler = handlerMap[protocol];
    if (!handler) {
      return ctx.reply('❌ Protocol tidak dikenali.');
    }

    await ctx.editMessageText('⏳ *Sedang memperpanjang akun...* Mohon tunggu.', { parse_mode: 'Markdown' });

    // Execute handler
    const msg = await handler();

    // Validate response
    if (!msg || typeof msg !== 'string') {
      logger.error('❌ Invalid response from handler:', { msg, type: typeof msg });
      return ctx.reply('❌ *Terjadi kesalahan saat memperpanjang akun.*', { parse_mode: 'Markdown' });
    }

    // Check for error message
    if (msg.startsWith('❌')) {
      // Refund if renewal failed
      await dbRunAsync('UPDATE users SET saldo = saldo + ? WHERE user_id = ?', [totalHarga, userId]);
      return ctx.reply(msg, { parse_mode: 'Markdown' });
    }

    // Log invoice
    const komisi = user.role === 'reseller' ? Math.floor(server.harga * duration * 0.1) : 0;
    await dbRunAsync(`
      INSERT INTO invoice_log (user_id, username, layanan, akun, hari, harga, komisi, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, datetime('now'))
    `, [userId, ctx.from.username || ctx.from.first_name, protocol, username, duration, totalHarga, komisi]);

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

    // Clean up state
    delete global.userState[chatId];

  } catch (error) {
    logger.error(`❌ Error in payment confirmation:`, error);
    await ctx.reply('❌ Terjadi kesalahan. Silakan coba lagi.');
  }
}

/**
 * Handle account renewal
 */
async function handleRenewAccount(ctx, protocol, serverId, renewFunction) {
  const userId = ctx.from.id;
  const chatId = ctx.chat.type === 'private' ? ctx.chat.id : ctx.from.id;

  await ctx.answerCbQuery();

  if (ctx.chat.type !== 'private') {
    await ctx.telegram.sendMessage(chatId, '✅ Proses perpanjangan berjalan, cek DM!');
  }

  try {
    // Get server
    const server = await dbGetAsync('SELECT * FROM Server WHERE id = ?', [serverId]);
    if (!server) {
      return ctx.telegram.sendMessage(chatId, '❌ Server tidak ditemukan.');
    }

    // Get user
    const user = await dbGetAsync('SELECT * FROM users WHERE user_id = ?', [userId]);
    if (!user) {
      return ctx.telegram.sendMessage(chatId, '❌ User tidak terdaftar. Silakan /start terlebih dahulu.');
    }

    // Check balance
    const price = server.harga || 0;
    if (user.saldo < price) {
      return ctx.telegram.sendMessage(
        chatId,
        `❌ Saldo tidak cukup!\n\nHarga: Rp ${price.toLocaleString('id-ID')}\nSaldo Anda: Rp ${user.saldo.toLocaleString('id-ID')}`
      );
    }

    // Set user state for username input
    if (!global.userState) global.userState = {};
    global.userState[chatId] = {
      step: `username_renew_${protocol}`,
      action: 'renew',
      type: protocol,
      serverId: serverId,
      serverName: server.nama_server,
      price: price,
      protocol: protocol
    };

    // Ask for username to renew
    await ctx.telegram.sendMessage(
      chatId,
      `📝 Perpanjang Akun ${protocol.toUpperCase()}\n\nMasukkan username yang ingin diperpanjang:`
    );

  } catch (error) {
    logger.error(`❌ Error renewing ${protocol} account:`, error);
    await ctx.telegram.sendMessage(chatId, '❌ Terjadi kesalahan. Silakan coba lagi.');
  }
}

module.exports = {
  registerRenewActions,
  handleRenewAccount
};
