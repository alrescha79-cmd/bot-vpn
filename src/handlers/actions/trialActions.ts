
import type { BotContext, DatabaseUser, DatabaseServer } from "../../types";
/**
 * @fileoverview Trial Actions Handler
 * Handles all trial account creation for SSH, VMESS, VLESS, TROJAN, SHADOWSOCKS protocols
 * 
 * Architecture:
 * - Trial limit checking (1x for users, 10x for resellers, unlimited for admins)
 * - Daily reset mechanism
 * - Trial logging for tracking
 * - Group notification system
 */

const { dbGetAsync, dbRunAsync } = require('../../database/connection');
const { escapeMarkdown } = require('../../utils/markdown');
const logger = require('../../utils/logger');

// Import trial modules
const { trialssh } = require('../../modules/protocols/ssh/trialSSH');
const { trialvmess } = require('../../modules/protocols/vmess/trialVMESS');
const { trialvless } = require('../../modules/protocols/vless/trialVLESS');
const { trialtrojan } = require('../../modules/protocols/trojan/trialTROJAN');
const { trialshadowsocks } = require('../../modules/protocols/shadowsocks/trialSHADOWSOCKS');

// Group ID for notifications
const GROUP_ID = process.env.GROUP_ID ? parseInt(process.env.GROUP_ID, 10) : null;

/**
 * Check trial limit for user
 * @param {number} userId - Telegram user ID
 * @returns {Promise<{allowed: boolean, count: number, max: number, role: string}>}
 */
async function checkTrialLimit(userId) {
  try {
    const user = await dbGetAsync(
      'SELECT role, last_trial_date, trial_count_today FROM users WHERE user_id = ?',
      [userId]
    );

    const role = user?.role || 'user';
    const now = new Date();
    const today = now.toISOString().split('T')[0];
    let trialCount = user?.trial_count_today || 0;
    const lastDate = user?.last_trial_date;

    // Set max trial based on role
    const maxTrial = role === 'reseller' ? 10 : role === 'admin' ? Infinity : 1;

    // Reset trial count if different day
    if (lastDate !== today) {
      trialCount = 0;
      await dbRunAsync(
        'UPDATE users SET trial_count_today = 0, last_trial_date = ? WHERE user_id = ?',
        [today, userId]
      );
    }

    return {
      allowed: trialCount < maxTrial,
      count: trialCount,
      max: maxTrial,
      role
    };
  } catch (error) {
    logger.error('Error checking trial limit:', error);
    throw error;
  }
}

/**
 * Log trial creation
 * @param {number} userId - User ID
 * @param {string} username - Account username
 * @param {string} type - Protocol type
 */
async function logTrial(userId, username, type) {
  try {
    await dbRunAsync(
      'UPDATE users SET trial_count_today = trial_count_today + 1, last_trial_date = ? WHERE user_id = ?',
      [new Date().toISOString().split('T')[0], userId]
    );

    await dbRunAsync(
      'INSERT INTO trial_logs (user_id, username, jenis, created_at) VALUES (?, ?, ?, datetime("now"))',
      [userId, username, type]
    );
  } catch (error) {
    logger.error('Error logging trial:', error);
  }
}

/**
 * Send group notification for trial
 * @param {object} ctx - Telegraf context
 * @param {object} data - Trial data
 */
async function sendTrialNotification(ctx, data) {
  if (!GROUP_ID || isNaN(GROUP_ID)) return;

  try {
    const { protocol, serverName, role, trialCount, maxTrial } = data;
    const rawName = ctx.from.username ? `@${ctx.from.username}` : ctx.from.first_name;
    const mention = escapeMarkdown(rawName);
    const roleLabel = role === 'admin' ? 'Admin' : role === 'reseller' ? 'Reseller' : 'User';

    const notif = `
━━━━━━━━━━━━━━━━━━━━━━━        
🎁 𝗧𝗥𝗜𝗔𝗟 𝗔𝗖𝗖𝗢𝗨𝗡𝗧 ${protocol.toUpperCase()} 𝗡𝗘𝗪
━━━━━━━━━━━━━━━━━━━━━━━
👤 𝗨𝘀𝗲𝗿: ${mention}
📩 𝗧𝗿𝗶𝗮𝗹 𝗯𝘆: ${roleLabel} | ${trialCount} dari ${maxTrial}
🌐 𝗦𝗲𝗿𝘃𝗲𝗿: ${serverName}
🏪 𝗣𝗿𝗼𝘁𝗼𝗰𝗼𝗹: ${protocol.toUpperCase()}
⏳ 𝗗𝘂𝗿𝗮𝘀𝗶: 60 Menit
🕒 𝗪𝗮𝗸𝘁𝘂: ${new Date().toLocaleString('id-ID')}
━━━━━━━━━━━━━━━━━━━━━━━`.trim();

    await ctx.telegram.sendMessage(GROUP_ID, notif, { parse_mode: 'Markdown' });
  } catch (error) {
    logger.warn('Failed to send trial notification to group:', error.message);
  }
}

/**
 * Register trial SSH action
 */
function registerTrialSSHAction(bot) {
  bot.action(/^trial_server_ssh_(\d+)$/, async (ctx) => {
    const serverId = ctx.match[1];
    const userId = ctx.from.id;
    const chatId = ctx.chat.type === 'private' ? ctx.chat.id : ctx.from.id;

    await ctx.answerCbQuery();

    if (ctx.chat.type !== 'private') {
      await bot.telegram.sendMessage(chatId, '✅ Proses trial berjalan, cek DM ya bro!');
    }

    try {
      // Check trial limit
      const limitCheck = await checkTrialLimit(userId);
      if (!limitCheck.allowed) {
        return await bot.telegram.sendMessage(
          chatId,
          `😅 Batas trial harian sudah tercapai bro.\nKamu hanya bisa ambil *${limitCheck.max}x* per hari.`,
          { parse_mode: 'Markdown' }
        );
      }

      // Get server name
      const server = await dbGetAsync('SELECT nama_server FROM Server WHERE id = ?', [serverId]);
      const serverName = server?.nama_server || 'Unknown';

      // Execute trial SSH
      const result = await trialssh(serverId);

      if (result.status === 'error') {
        logger.error('❌ Gagal trial SSH:', result.message);
        return bot.telegram.sendMessage(chatId, `❌ ${result.message}`);
      }

      const {
        username, password, ip, domain, city, public_key, expiration,
        ports, openvpn_link, save_link, wss_payload
      } = result;

      // Log trial
      await logTrial(userId, username, 'ssh');

      // Send account details to user
      const replyText = `
⚡ *AKUN SSH TRIAL*

👤 User: \`${username}\`
🔐 Pass: \`${password}\`
🌍 Domain: \`${domain}\`
🏙️ Kota: \`${city}\`
🔑 PubKey: \`${public_key}\`

🔌 *PORT*
${ports}

🔗 *Link*
OpenVPN: \`${openvpn_link}\`
Save: \`${save_link}\`

📝 *WSS Payload:*
\`\`\`${wss_payload}\`\`\`

📆 *Expired:* ${expiration}
`.trim();

      await bot.telegram.sendMessage(chatId, replyText, {
        parse_mode: 'Markdown',
        disable_web_page_preview: true
      });

      // Send notification to group
      await sendTrialNotification(ctx, {
        protocol: 'ssh',
        serverName,
        role: limitCheck.role,
        trialCount: limitCheck.count + 1,
        maxTrial: limitCheck.max
      });

    } catch (err) {
      logger.error('❌ Gagal proses trial SSH:', err.message);
      return bot.telegram.sendMessage(chatId, '❌ Terjadi kesalahan saat cek data trial.');
    }
  });
}

/**
 * Register trial VMESS action
 */
function registerTrialVMESSAction(bot) {
  bot.action(/^trial_server_vmess_(\d+)$/, async (ctx) => {
    const serverId = ctx.match[1];
    const userId = ctx.from.id;
    const chatId = ctx.chat.type === 'private' ? ctx.chat.id : ctx.from.id;

    await ctx.answerCbQuery();

    if (ctx.chat.type !== 'private') {
      await bot.telegram.sendMessage(chatId, '✅ Proses trial berjalan, cek DM ya bro!');
    }

    try {
      // Check trial limit
      const limitCheck = await checkTrialLimit(userId);
      if (!limitCheck.allowed) {
        return await bot.telegram.sendMessage(
          chatId,
          `😅 Batas trial harian sudah tercapai bro.\nKamu hanya bisa ambil *${limitCheck.max}x* per hari.`,
          { parse_mode: 'Markdown' }
        );
      }

      // Get server name
      const server = await dbGetAsync('SELECT nama_server FROM Server WHERE id = ?', [serverId]);
      const serverName = server?.nama_server || 'Unknown';

      // Execute trial VMESS
      const result = await trialvmess(serverId);

      if (result.status === 'error') {
        return bot.telegram.sendMessage(chatId, `❌ ${result.message}`);
      }

      const {
        username, uuid, ip, domain, ns_domain, city, public_key,
        expiration, link_tls, link_ntls, link_grpc
      } = result;

      // Log trial
      await logTrial(userId, username, 'vmess');

      // Send account details to user
      const replyText = `
⚡ *AKUN VMESS TRIAL*

👤 User: \`${username}\`
🔐 UUID: \`${uuid}\`
🌍 Domain: \`${domain}\`
🏙️ Kota: ${city}
📡 NS: ${ns_domain}
🔑 PubKey: ${public_key}

🔌 *PORT*
TLS 443 | NTLS 80/8080 | gRPC 443

🔗 *Link*
TLS     : \`\`\`${link_tls}\`\`\`
Non-TLS : \`\`\`${link_ntls}\`\`\`
gRPC    : \`\`\`${link_grpc}\`\`\`

📆 *Expired:* ${expiration}
`.trim();

      await bot.telegram.sendMessage(chatId, replyText, {
        parse_mode: 'Markdown',
        disable_web_page_preview: true
      });

      // Send notification to group
      await sendTrialNotification(ctx, {
        protocol: 'vmess',
        serverName,
        role: limitCheck.role,
        trialCount: limitCheck.count + 1,
        maxTrial: limitCheck.max
      });

    } catch (err) {
      logger.error('❌ Gagal proses trial VMESS:', err.message);
      return bot.telegram.sendMessage(chatId, '❌ Terjadi kesalahan saat cek data trial.');
    }
  });
}

/**
 * Register trial VLESS action
 */
function registerTrialVLESSAction(bot) {
  bot.action(/^trial_server_vless_(\d+)$/, async (ctx) => {
    const serverId = ctx.match[1];
    const userId = ctx.from.id;
    const chatId = ctx.chat.type === 'private' ? ctx.chat.id : ctx.from.id;

    await ctx.answerCbQuery();

    if (ctx.chat.type !== 'private') {
      await bot.telegram.sendMessage(chatId, '✅ Proses trial berjalan, cek DM ya bro!');
    }

    try {
      // Check trial limit
      const limitCheck = await checkTrialLimit(userId);
      if (!limitCheck.allowed) {
        return await bot.telegram.sendMessage(
          chatId,
          `😅 Batas trial harian sudah tercapai bro.\nKamu hanya bisa ambil *${limitCheck.max}x* per hari.`,
          { parse_mode: 'Markdown' }
        );
      }

      // Get server name
      const server = await dbGetAsync('SELECT nama_server FROM Server WHERE id = ?', [serverId]);
      const serverName = server?.nama_server || 'Unknown';

      // Execute trial VLESS
      const result = await trialvless(serverId);

      if (result.status === 'error') {
        return bot.telegram.sendMessage(chatId, `❌ ${result.message}`);
      }

      const {
        username, uuid, ip, domain, ns_domain, city, public_key,
        expiration, link_tls, link_ntls, link_grpc
      } = result;

      // Log trial
      await logTrial(userId, username, 'vless');

      // Send account details to user
      const replyText = `
⚡ *AKUN VLESS TRIAL*

👤 User: \`${username}\`
🔐 UUID: \`${uuid}\`
🌍 Domain: \`${domain}\`
🏙️ Kota: ${city}
📡 NS: ${ns_domain}
🔑 PubKey: ${public_key}

🔌 *PORT*
TLS 443 | NTLS 80/8080 | gRPC 443

🔗 *Link*
TLS     : \`\`\`${link_tls}\`\`\`
Non-TLS : \`\`\`${link_ntls}\`\`\`
gRPC    : \`\`\`${link_grpc}\`\`\`

📆 *Expired:* ${expiration}
`.trim();

      await bot.telegram.sendMessage(chatId, replyText, {
        parse_mode: 'Markdown',
        disable_web_page_preview: true
      });

      // Send notification to group
      await sendTrialNotification(ctx, {
        protocol: 'vless',
        serverName,
        role: limitCheck.role,
        trialCount: limitCheck.count + 1,
        maxTrial: limitCheck.max
      });

    } catch (err) {
      logger.error('❌ Gagal proses trial VLESS:', err.message);
      return bot.telegram.sendMessage(chatId, '❌ Terjadi kesalahan saat cek data trial.');
    }
  });
}

/**
 * Register trial TROJAN action
 */
function registerTrialTROJANAction(bot) {
  bot.action(/^trial_server_trojan_(\d+)$/, async (ctx) => {
    const serverId = ctx.match[1];
    const userId = ctx.from.id;
    const chatId = ctx.chat.type === 'private' ? ctx.chat.id : ctx.from.id;

    await ctx.answerCbQuery();

    if (ctx.chat.type !== 'private') {
      await bot.telegram.sendMessage(chatId, '✅ Proses trial berjalan, cek DM ya bro!');
    }

    try {
      // Check trial limit
      const limitCheck = await checkTrialLimit(userId);
      if (!limitCheck.allowed) {
        return await bot.telegram.sendMessage(
          chatId,
          `😅 Batas trial harian sudah tercapai bro.\nKamu hanya bisa ambil *${limitCheck.max}x* per hari.`,
          { parse_mode: 'Markdown' }
        );
      }

      // Get server name
      const server = await dbGetAsync('SELECT nama_server FROM Server WHERE id = ?', [serverId]);
      const serverName = server?.nama_server || 'Unknown';

      // Execute trial TROJAN
      const result = await trialtrojan(serverId);

      if (result.status === 'error') {
        return bot.telegram.sendMessage(chatId, `❌ ${result.message}`);
      }

      const {
        username, uuid, ip, domain, ns_domain, city, public_key,
        expiration, link_tls, link_ntls, link_grpc
      } = result;

      // Log trial
      await logTrial(userId, username, 'trojan');

      // Send account details to user
      const replyText = `
⚡ *AKUN TROJAN TRIAL*

👤 User: \`${username}\`
🔐 UUID: \`${uuid}\`
🌍 Domain: \`${domain}\`
🏙️ Kota: ${city}
📡 NS: ${ns_domain}
🔑 PubKey: ${public_key}

🔌 *PORT*
TLS 443 | NTLS 80/8080 | gRPC 443

🔗 *Link*
TLS     : \`\`\`${link_tls}\`\`\`
Non-TLS : \`\`\`${link_ntls}\`\`\`
gRPC    : \`\`\`${link_grpc}\`\`\`

📆 *Expired:* ${expiration}
`.trim();

      await bot.telegram.sendMessage(chatId, replyText, {
        parse_mode: 'Markdown',
        disable_web_page_preview: true
      });

      // Send notification to group
      await sendTrialNotification(ctx, {
        protocol: 'trojan',
        serverName,
        role: limitCheck.role,
        trialCount: limitCheck.count + 1,
        maxTrial: limitCheck.max
      });

    } catch (err) {
      logger.error('❌ Gagal proses trial TROJAN:', err.message);
      return bot.telegram.sendMessage(chatId, '❌ Terjadi kesalahan saat cek data trial.');
    }
  });
}

/**
 * Register trial SHADOWSOCKS action
 */
function registerTrialSHADOWSOCKSAction(bot) {
  bot.action(/^trial_server_shadowsocks_(\d+)$/, async (ctx) => {
    const serverId = ctx.match[1];
    const userId = ctx.from.id;
    const chatId = ctx.chat.type === 'private' ? ctx.chat.id : ctx.from.id;

    await ctx.answerCbQuery();

    if (ctx.chat.type !== 'private') {
      await bot.telegram.sendMessage(chatId, '✅ Proses trial berjalan, cek DM ya bro!');
    }

    try {
      // Check trial limit
      const limitCheck = await checkTrialLimit(userId);
      if (!limitCheck.allowed) {
        return await bot.telegram.sendMessage(
          chatId,
          `😅 Batas trial harian sudah tercapai bro.\nKamu hanya bisa ambil *${limitCheck.max}x* per hari.`,
          { parse_mode: 'Markdown' }
        );
      }

      // Get server name
      const server = await dbGetAsync('SELECT nama_server FROM Server WHERE id = ?', [serverId]);
      const serverName = server?.nama_server || 'Unknown';

      // Execute trial SHADOWSOCKS
      const result = await trialshadowsocks(serverId);

      if (result.status === 'error') {
        return bot.telegram.sendMessage(chatId, `❌ ${result.message}`);
      }

      const {
        username, uuid, ip, domain, ns_domain, city, public_key,
        expiration, link_tls, link_ntls, link_grpc
      } = result;

      // Log trial
      await logTrial(userId, username, 'shadowsocks');

      // Send account details to user
      const replyText = `
⚡ *AKUN SHADOWSOCKS TRIAL*

👤 User: \`${username}\`
🔐 UUID: \`${uuid}\`
🌍 Domain: \`${domain}\`
🏙️ Kota: \`${city}\`
📡 NS: \`${ns_domain}\`
🔑 PubKey: \`${public_key}\`

🔌 *PORT*
TLS 443 | NTLS 80/8080 | gRPC 443

🔗 *Link*
TLS     : \`\`\`${link_tls}\`\`\`
Non-TLS : \`\`\`${link_ntls}\`\`\`
gRPC    : \`\`\`${link_grpc}\`\`\`

📆 *Expired:* ${expiration}
`.trim();

      await bot.telegram.sendMessage(chatId, replyText, {
        parse_mode: 'Markdown',
        disable_web_page_preview: true
      });

      // Send notification to group
      await sendTrialNotification(ctx, {
        protocol: 'shadowsocks',
        serverName,
        role: limitCheck.role,
        trialCount: limitCheck.count + 1,
        maxTrial: limitCheck.max
      });

    } catch (err) {
      logger.error('❌ Gagal proses trial SHADOWSOCKS:', err.message);
      return bot.telegram.sendMessage(chatId, '❌ Terjadi kesalahan saat cek data trial.');
    }
  });
}

/**
 * Register all trial actions
 */
function registerAllTrialActions(bot) {
  registerTrialSSHAction(bot);
  registerTrialVMESSAction(bot);
  registerTrialVLESSAction(bot);
  registerTrialTROJANAction(bot);
  registerTrialSHADOWSOCKSAction(bot);
  
  logger.info('✅ Trial actions registered (5 protocols)');
}

module.exports = {
  registerAllTrialActions,
  registerTrialSSHAction,
  registerTrialVMESSAction,
  registerTrialVLESSAction,
  registerTrialTROJANAction,
  registerTrialSHADOWSOCKSAction,
  checkTrialLimit,
  logTrial
};
