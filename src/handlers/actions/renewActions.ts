
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

/**
 * Register all renew account actions
 */
function registerRenewActions(bot) {
  // SSH Renew
  bot.action(/^renew_server_ssh_(\d+)$/, async (ctx) => {
    await handleRenewAccount(ctx, 'ssh', ctx.match[1], renewSSH);
  });

  // VMESS Renew
  bot.action(/^renew_server_vmess_(\d+)$/, async (ctx) => {
    await handleRenewAccount(ctx, 'vmess', ctx.match[1], renewVMESS);
  });

  // VLESS Renew
  bot.action(/^renew_server_vless_(\d+)$/, async (ctx) => {
    await handleRenewAccount(ctx, 'vless', ctx.match[1], renewVLESS);
  });

  // TROJAN Renew
  bot.action(/^renew_server_trojan_(\d+)$/, async (ctx) => {
    await handleRenewAccount(ctx, 'trojan', ctx.match[1], renewTROJAN);
  });

  // SHADOWSOCKS Renew
  bot.action(/^renew_server_shadowsocks_(\d+)$/, async (ctx) => {
    await handleRenewAccount(ctx, 'shadowsocks', ctx.match[1], renewSHADOWSOCKS);
  });

  logger.info('✅ Renew account actions registered');
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
