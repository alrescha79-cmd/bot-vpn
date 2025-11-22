
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

/**
 * Register all create account actions
 */
function registerCreateActions(bot) {
  // SSH Create
  bot.action(/^create_server_ssh_(\d+)$/, async (ctx) => {
    await handleCreateAccount(ctx, 'ssh', ctx.match[1], createSSH);
  });

  // VMESS Create
  bot.action(/^create_server_vmess_(\d+)$/, async (ctx) => {
    await handleCreateAccount(ctx, 'vmess', ctx.match[1], createVMESS);
  });

  // VLESS Create
  bot.action(/^create_server_vless_(\d+)$/, async (ctx) => {
    await handleCreateAccount(ctx, 'vless', ctx.match[1], createVLESS);
  });

  // TROJAN Create
  bot.action(/^create_server_trojan_(\d+)$/, async (ctx) => {
    await handleCreateAccount(ctx, 'trojan', ctx.match[1], createTROJAN);
  });

  // SHADOWSOCKS Create
  bot.action(/^create_server_shadowsocks_(\d+)$/, async (ctx) => {
    await handleCreateAccount(ctx, 'shadowsocks', ctx.match[1], createSHADOWSOCKS);
  });

  logger.info('✅ Create account actions registered');
}

/**
 * Handle account creation
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
