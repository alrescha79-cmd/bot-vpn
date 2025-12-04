
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
  // New: Handle direct account selection for renewal
  bot.action(/^renew_account_(.+)$/, async (ctx) => {
    await handleDirectAccountRenewal(ctx);
  });

  // Server selection handlers - redirect to username input
  const protocols = ['ssh', 'vmess', 'vless', 'trojan', 'shadowsocks', '3in1'];

  protocols.forEach(protocol => {
    bot.action(new RegExp(`^renew_server_${protocol}_(\\d+)$`), async (ctx) => {
      const serverId = ctx.match[1];
      await handleServerSelection(ctx, protocol, serverId, 'renew');
    });
  });

  // Duration selection handlers - continue flow
  // Pattern: duration_renew_{protocol}_{serverId}_{duration}
  bot.action(/^duration_renew_([a-zA-Z0-9]+)_(\d+)_(\d+)$/, async (ctx) => {
    await handleDurationSelection(ctx, 'renew');
  });

  // Payment confirmation handlers
  bot.action(/^pay_renew_([a-zA-Z0-9]+)_(\d+)_(\d+)$/, async (ctx) => {
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
 * Handle direct account renewal from account selection
 */
async function handleDirectAccountRenewal(ctx) {
  const accountId = ctx.match[1];
  const userId = ctx.from.id;

  await ctx.answerCbQuery();

  try {
    const { getAccountById } = require('../../repositories/accountRepository');
    const { dbGetAsync } = require('../../database/connection');
    const { Markup } = require('telegraf');

    // Get account details
    const account = await getAccountById(accountId);
    if (!account) {
      return ctx.reply('❌ Akun tidak ditemukan.');
    }

    // Check permission
    const user = await dbGetAsync('SELECT role FROM users WHERE user_id = ?', [userId]);
    if (!user) {
      return ctx.reply('❌ User tidak terdaftar.');
    }

    if (user.role !== 'admin' && user.role !== 'owner' && account.owner_user_id !== userId) {
      return ctx.reply('⛔ Anda tidak memiliki akses ke akun ini.');
    }

    // Get server details from Server table
    // Try matching both nama_server and domain since account.server could be either
    const server = await dbGetAsync(
      'SELECT * FROM Server WHERE nama_server = ? OR domain = ?',
      [account.server, account.server]
    );
    if (!server) {
      // Log for debugging
      logger.error(`❌ Server not found for account.server: "${account.server}"`);
      return ctx.reply(`❌ Server tidak ditemukan.\n\nDetail: Server "${account.server}" tidak ada di database.`);
    }

    // Set user state for renewal
    if (!global.userState) global.userState = {};
    global.userState[ctx.chat.id] = {
      step: `duration_renew_${account.protocol}`,
      action: 'renew',
      type: account.protocol,
      serverId: server.id,
      serverName: server.nama_server,
      serverDomain: server.domain,
      harga: server.harga,
      username: account.username,
      accountId: accountId
    };

    // Show duration selection
    const durationButtons = [
      [
        Markup.button.callback('7 Hari', `duration_renew_${account.protocol}_${server.id}_7`),
        Markup.button.callback('20 Hari', `duration_renew_${account.protocol}_${server.id}_20`)
      ],
      [
        Markup.button.callback('30 Hari', `duration_renew_${account.protocol}_${server.id}_30`),
        Markup.button.callback('45 Hari', `duration_renew_${account.protocol}_${server.id}_45`)
      ],
      [
        Markup.button.callback('🔙 Kembali', 'service_renew')
      ]
    ];

    const protocolLabels = {
      ssh: '🔐 SSH',
      vmess: '📡 VMESS',
      vless: '🌐 VLESS',
      trojan: '🔒 TROJAN',
      shadowsocks: '🕶️ SHADOWSOCKS',
      '3in1': '🎁 3 IN 1'
    };

    const message = `
${protocolLabels[account.protocol] || account.protocol.toUpperCase()}

📋 *Perpanjang Akun*
👤 Username: \`${account.username}\`
🌐 Server: ${server.nama_server}

Pilih durasi perpanjangan:
    `.trim();

    await ctx.editMessageText(message, {
      parse_mode: 'Markdown',
      ...Markup.inlineKeyboard(durationButtons)
    });

  } catch (error) {
    logger.error('❌ Error in handleDirectAccountRenewal:', error);
    await ctx.reply('❌ Terjadi kesalahan. Silakan coba lagi.');
  }
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
    logger.info(`Duration selected: protocol=${protocol}, serverId=${serverId}, duration=${duration}, userId=${userId}`);

    const state = global.userState[chatId];
    if (!state) {
      logger.error('❌ No state found for renewal duration selection');
      return ctx.reply('❌ Session expired. Silakan mulai lagi.');
    }

    logger.info(`Current state:`, JSON.stringify(state));

    // Update state with duration
    state.duration = duration;

    logger.info(`Updated state with duration: ${duration}`);

    // Show payment confirmation
    const { showPaymentConfirmation } = require('../events/textHandler');
    await showPaymentConfirmation(ctx, state);

    logger.info('✅ Payment confirmation shown successfully');

  } catch (error) {
    logger.error(`❌ Error handling duration selection:`, error);
    logger.error('Stack trace:', error.stack);
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
    logger.info(`Payment confirmation: protocol=${protocol}, serverId=${serverId}, duration=${duration}, userId=${userId}`);

    const state = global.userState[chatId];
    if (!state) {
      logger.error('❌ No state found for payment confirmation');
      return ctx.reply('❌ Session expired. Silakan mulai lagi.');
    }

    logger.info(`State found, username: ${state.username}`);

    const { username } = state;

    // Get server
    const server = await dbGetAsync('SELECT * FROM Server WHERE id = ?', [serverId]);
    if (!server) {
      logger.error(`❌ Server not found: serverId=${serverId}`);
      return ctx.reply('❌ Server tidak ditemukan.');
    }

    logger.info(`Server found: ${server.nama_server}`);

    // Verify account exists (convert protocol to lowercase for akun_aktif query)
    const protocolLower = protocol.toLowerCase();
    const accountExists = await dbGetAsync(
      'SELECT * FROM akun_aktif WHERE username = ? AND jenis = ?',
      [username, protocolLower]
    );
    if (!accountExists) {
      logger.error(`❌ Account not found in akun_aktif: username=${username}, protocol=${protocolLower}`);
      return ctx.editMessageText('❌ *Akun tidak ditemukan atau tidak aktif.*', { parse_mode: 'Markdown' });
    }

    logger.info(`✅ Account verified in akun_aktif`);

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

    // Handler mapping (use lowercase protocol)
    const handlerMap = {
      ssh: () => renewSSH.renewssh(username, duration, server.iplimit, serverId, totalHarga, duration),
      vmess: () => renewVMESS.renewvmess(username, duration, server.quota, server.iplimit, serverId, totalHarga, duration),
      vless: () => renewVLESS.renewvless(username, duration, server.quota, server.iplimit, serverId, totalHarga, duration),
      trojan: () => renewTROJAN.renewtrojan(username, duration, server.quota, server.iplimit, serverId, totalHarga, duration),
      shadowsocks: () => renewSHADOWSOCKS.renewshadowsocks(username, duration, server.quota, server.iplimit, serverId, totalHarga, duration),
      '3in1': () => renew3IN1.renew3in1(username, duration, server.quota, server.iplimit, serverId, totalHarga, duration)
    };

    const handler = handlerMap[protocolLower];
    if (!handler) {
      logger.error(`❌ Unknown protocol: ${protocolLower}`);
      return ctx.reply('❌ Protocol tidak dikenali.');
    }

    logger.info(`🔄 Starting renewal for ${username} (${protocolLower})...`);

    await ctx.editMessageText('⏳ *Sedang memperpanjang akun...* Mohon tunggu.', { parse_mode: 'Markdown' });

    // Execute handler with timeout
    let msg;
    try {
      // Set timeout untuk mencegah hanging (60 detik)
      const timeoutPromise = new Promise((_, reject) =>
        setTimeout(() => reject(new Error('Timeout: Koneksi ke server terlalu lama')), 60000)
      );

      logger.info(`Executing renewal handler...`);
      msg = await Promise.race([handler(), timeoutPromise]);
      logger.info(`Renewal handler completed, response length: ${msg?.length || 0}`);
    } catch (handlerError) {
      logger.error('❌ Handler execution error:', handlerError);
      logger.error('Handler error stack:', handlerError.stack);

      // Refund balance
      await dbRunAsync('UPDATE users SET saldo = saldo + ? WHERE user_id = ?', [totalHarga, userId]);

      return ctx.reply(
        `❌ *Gagal memperpanjang akun*\n\n` +
        `Detail error: ${handlerError.message}\n\n` +
        `Saldo Anda telah dikembalikan.`,
        { parse_mode: 'Markdown' }
      );
    }

    // Validate response
    if (!msg || typeof msg !== 'string') {
      logger.error('❌ Invalid response from handler:', { msg, type: typeof msg });

      // Refund balance
      await dbRunAsync('UPDATE users SET saldo = saldo + ? WHERE user_id = ?', [totalHarga, userId]);

      return ctx.reply(
        '❌ *Terjadi kesalahan saat memperpanjang akun.*\n\n' +
        'Response dari server tidak valid. Saldo Anda telah dikembalikan.',
        { parse_mode: 'Markdown' }
      );
    }

    // Check for error message
    if (msg.startsWith('❌')) {
      // Refund if renewal failed
      await dbRunAsync('UPDATE users SET saldo = saldo + ? WHERE user_id = ?', [totalHarga, userId]);
      return ctx.reply(msg, { parse_mode: 'Markdown' });
    }

    // Parse new expiry from response and update accounts table
    try {
      // Try RAW_EXPIRY first (most reliable)
      const rawExpiryMatch = msg.match(/\[RAW_EXPIRY:(\d{4}-\d{2}-\d{2})\]/);
      const newExpMatch = msg.match(/Exp Baru.*?`(\d{1,2} \w+ \d{4})/);
      const newExpRawMatch = msg.match(/New Expiry: (\d{4}-\d{2}-\d{2})/);

      let newExpiredAt = null;
      if (rawExpiryMatch) {
        // Format: [RAW_EXPIRY:2025-12-18]
        newExpiredAt = rawExpiryMatch[1];
        logger.info(`📅 Parsed expiry from RAW_EXPIRY: ${newExpiredAt}`);
      } else if (newExpRawMatch) {
        // Format: 2025-12-18
        newExpiredAt = newExpRawMatch[1];
      } else if (newExpMatch) {
        // Format: 18 Des 2024 - parse Indonesian date
        const dateStr = newExpMatch[1];
        const monthMap = {
          'Jan': '01', 'Feb': '02', 'Mar': '03', 'Apr': '04',
          'Mei': '05', 'Jun': '06', 'Jul': '07', 'Agu': '08',
          'Sep': '09', 'Okt': '10', 'Nov': '11', 'Des': '12'
        };
        const parts = dateStr.split(' ');
        if (parts.length === 3) {
          const day = parts[0].padStart(2, '0');
          const month = monthMap[parts[1]] || '01';
          const year = parts[2];
          newExpiredAt = `${year}-${month}-${day}`;
        }
      }

      if (newExpiredAt) {
        logger.info(`📅 Updating expired_at in database: ${newExpiredAt} for ${username} (${protocolLower})`);

        // Get server domain for matching
        const serverDomain = server?.domain || '';
        logger.info(`📅 Server domain: ${serverDomain}`);

        // Debug: Check if account exists in database
        const existingAccount = await dbGetAsync(
          `SELECT id, username, protocol, server, expired_at FROM accounts WHERE username = ? AND protocol = ?`,
          [username, protocolLower]
        );
        logger.info(`📅 Existing account in DB: ${JSON.stringify(existingAccount)}`);

        // Update or Insert accounts table
        // Note: Database stores protocol in UPPERCASE, so we use UPPER() for comparison
        if (protocolLower === '3in1') {
          // For 3in1, update vmess, vless, trojan
          await dbRunAsync(
            `UPDATE accounts SET expired_at = ?, status = 'active', expiry_warning_3d_sent = 0, expiry_warning_1d_sent = 0, expired_notified = 0
             WHERE username = ? AND UPPER(protocol) IN ('VMESS', 'VLESS', 'TROJAN')`,
            [newExpiredAt, username]
          );
          logger.info(`✅ Updated expired_at for 3in1 account (vmess, vless, trojan)`);
        } else {
          // Update using case-insensitive protocol match
          const result = await dbRunAsync(
            `UPDATE accounts SET expired_at = ?, status = 'active', expiry_warning_3d_sent = 0, expiry_warning_1d_sent = 0, expired_notified = 0
             WHERE username = ? AND UPPER(protocol) = UPPER(?)`,
            [newExpiredAt, username, protocolLower]
          );
          logger.info(`✅ Updated expired_at for ${protocolLower} account - changes: ${result?.changes || 0}`);
        }
      } else {
        logger.warn(`⚠️ Could not parse new expiry date from response`);
      }
    } catch (updateError) {
      logger.error(`❌ Failed to update expired_at in database:`, updateError);
      // Don't fail the whole process, just log the error
    }

    // Log invoice
    const komisi = user.role === 'reseller' ? Math.floor(server.harga * duration * 0.1) : 0;
    await dbRunAsync(`
      INSERT INTO invoice_log (user_id, username, layanan, akun, hari, harga, komisi, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, datetime('now'))
    `, [userId, ctx.from.username || ctx.from.first_name, protocolLower, username, duration, totalHarga, komisi]);

    // Handle reseller commission
    if (user.role === 'reseller') {
      await dbRunAsync('UPDATE users SET saldo = saldo + ? WHERE user_id = ?', [komisi, userId]);
      await dbRunAsync(`
        INSERT INTO reseller_sales (reseller_id, buyer_id, akun_type, username, komisi, created_at)
        VALUES (?, ?, ?, ?, ?, datetime('now'))
      `, [userId, userId, protocolLower, username, komisi]);
    }

    // Send success message (remove RAW_EXPIRY tag first)
    const cleanMsg = msg.replace(/\[RAW_EXPIRY:\d{4}-\d{2}-\d{2}\]/g, '').trim();
    await ctx.reply(cleanMsg, { parse_mode: 'Markdown' });

    // Clean up state
    delete global.userState[chatId];

  } catch (error) {
    logger.error(`❌ Error in payment confirmation:`, error);
    logger.error('Error stack:', error.stack);
    logger.error('Error details:', JSON.stringify(error, null, 2));

    try {
      await ctx.reply(
        '❌ *Terjadi kesalahan saat memproses perpanjangan.*\n\n' +
        `Detail: ${error.message}\n\n` +
        'Silakan hubungi admin jika masalah berlanjut.',
        { parse_mode: 'Markdown' }
      );
    } catch (replyError) {
      logger.error('Failed to send error message:', replyError);
    }
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
