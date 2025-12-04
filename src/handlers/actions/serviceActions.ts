
import type { BotContext, DatabaseUser, DatabaseServer } from "../../types";
/**
 * Service Actions Handler
 * Handles service-related actions: create, renew, trial
 * @module handlers/actions/serviceActions
 */

const { Markup } = require('telegraf');
const { dbAllAsync } = require('../../database/connection');
const logger = require('../../utils/logger');
const { escapeMarkdownV2 } = require('../../utils/markdown');
const { getFlagEmoji } = require('../../utils/helpers');

/**
 * Handle service action (create/renew/trial)
 * @param {Object} ctx - Telegraf context
 * @param {string} type - Action type: 'create', 'renew', or 'trial'
 */
async function handleServiceAction(ctx, type) {
  const userId = ctx.from.id;

  try {
    const servers = await dbAllAsync('SELECT * FROM Server ORDER BY id');

    if (!servers || servers.length === 0) {
      return ctx.reply('❌ Tidak ada server tersedia saat ini.');
    }

    const actionLabels = {
      create: { emoji: '🛒', text: 'Buat Akun' },
      renew: { emoji: '🔄', text: 'Perpanjang' },
      trial: { emoji: '🎁', text: 'Trial Gratis' }
    };

    const label = actionLabels[type] || { emoji: '📦', text: 'Layanan' };

    // Generate protocol buttons
    const protocolButtons = [
      [
        Markup.button.callback('🔐 SSH', `${type}_ssh`),
        Markup.button.callback('📡 VMESS', `${type}_vmess`)
      ],
      [
        Markup.button.callback('🌐 VLESS', `${type}_vless`),
        Markup.button.callback('🔒 TROJAN', `${type}_trojan`)
      ],
      [
        Markup.button.callback('🕶️ SHADOWSOCKS', `${type}_shadowsocks`)
      ]
    ];

    // Add 3IN1 button only for create and renew (not trial)
    if (type === 'create' || type === 'renew') {
      protocolButtons.push([
        Markup.button.callback('🎁 3 IN 1 (VMESS + VLESS + TROJAN)', `${type}_3in1`)
      ]);
    }

    protocolButtons.push([
      Markup.button.callback('🔙 Menu Utama', 'send_main_menu')
    ]);

    const message = `
${label.emoji} *${label.text}*

Silakan pilih protokol yang ingin digunakan:
    `.trim();

    if (ctx.callbackQuery) {
      await ctx.editMessageText(message, {
        parse_mode: 'Markdown',
        ...Markup.inlineKeyboard(protocolButtons)
      });
    } else {
      await ctx.reply(message, {
        parse_mode: 'Markdown',
        ...Markup.inlineKeyboard(protocolButtons)
      });
    }
  } catch (err) {
    logger.error(`❌ Error handling service ${type}:`, err.message);
    await ctx.reply('❌ Terjadi kesalahan. Silakan coba lagi.');
  }
}

/**
 * Show server selection for protocol
 * @param {Object} ctx - Telegraf context
 * @param {string} protocol - Protocol name (ssh, vmess, etc)
 * @param {string} action - Action type (create, renew, trial)
 */
async function showServerSelection(ctx, protocol, action) {
  try {
    const servers = await dbAllAsync('SELECT * FROM Server ORDER BY id');

    if (!servers || servers.length === 0) {
      return ctx.reply('❌ Tidak ada server tersedia.');
    }

    // Build server details list
    let serverDetails = '';
    servers.forEach((server, index) => {
      const flag = getFlagEmoji(server.lokasi || '');
      const harga = server.harga || 0;
      const quota = server.quota || 0;
      const iplimit = server.iplimit || 0;
      const totalCreate = server.total_create_akun || 0;
      const batasCreate = server.batas_create_akun || 0;

      // Format quota and iplimit - show "Unlimited" if 0
      const quotaText = quota === 0 ? 'Unlimited' : `${quota} GB`;
      const iplimitText = iplimit === 0 ? 'Unlimited' : `${iplimit} IP`;

      serverDetails += `\n${index + 1}. ${flag} *${server.nama_server}*\n`;

      if (action !== 'trial') {
        serverDetails += `   💰 Harga: Rp${harga.toLocaleString('id-ID')}/hari\n`;
      }

      serverDetails += `   📊 Kuota: ${quotaText}\n`;
      serverDetails += `   📶 Limit IP: ${iplimitText}\n`;
      serverDetails += `   📈 Total Akun: ${totalCreate}/${batasCreate}\n`;
    });

    const buttons = servers.map((server, index) => {
      const flag = getFlagEmoji(server.lokasi || '');
      const label = `${index + 1}. ${flag} ${server.nama_server}`;

      return [Markup.button.callback(label, `${action}_server_${protocol}_${server.id}`)];
    });

    buttons.push([Markup.button.callback('🔙 Kembali', `service_${action}`)]);

    const protocolLabels = {
      ssh: '🔐 SSH',
      vmess: '📡 VMESS',
      vless: '🌐 VLESS',
      trojan: '🔒 TROJAN',
      shadowsocks: '🕶️ SHADOWSOCKS',
      '3in1': '🎁 3 IN 1 (VMESS+VLESS+TROJAN)'
    };

    const message = `
${protocolLabels[protocol] || protocol.toUpperCase()} Premium

📋 *Daftar Server Tersedia:*
${serverDetails}

👇 *Pilih server:*
    `.trim();

    await ctx.editMessageText(message, {
      parse_mode: 'Markdown',
      ...Markup.inlineKeyboard(buttons)
    });
  } catch (err) {
    logger.error(`❌ Error showing server selection:`, err.message);
    await ctx.reply('❌ Gagal menampilkan daftar server.');
  }
}

/**
 * Show duration selection after server selection
 * @param {Object} ctx - Telegraf context
 * @param {string} protocol - Protocol name
 * @param {string} action - Action type (create/renew)
 * @param {number} serverId - Server ID
 */
async function showDurationSelection(ctx, protocol, action, serverId) {
  try {
    const durationButtons = [
      [
        Markup.button.callback('7 Hari', `duration_${action}_${protocol}_${serverId}_7`),
        Markup.button.callback('20 Hari', `duration_${action}_${protocol}_${serverId}_20`)
      ],
      [
        Markup.button.callback('30 Hari', `duration_${action}_${protocol}_${serverId}_30`),
        Markup.button.callback('45 Hari', `duration_${action}_${protocol}_${serverId}_45`)
      ],
      [
        Markup.button.callback('🔙 Kembali', `${action}_${protocol}`)
      ]
    ];

    const protocolLabels = {
      ssh: '🔐 SSH',
      vmess: '📡 VMESS',
      vless: '🌐 VLESS',
      trojan: '🔒 TROJAN',
      shadowsocks: '🕶️ SHADOWSOCKS',
      '3in1': '🎁 3 IN 1 (VMESS+VLESS+TROJAN)'
    };

    const message = `
${protocolLabels[protocol] || protocol.toUpperCase()}

Pilih durasi masa aktif:
    `.trim();

    // Use reply instead of editMessageText when called from text handler
    if (ctx.message) {
      await ctx.reply(message, {
        ...Markup.inlineKeyboard(durationButtons)
      });
    } else {
      await ctx.editMessageText(message, {
        ...Markup.inlineKeyboard(durationButtons)
      });
    }
  } catch (err) {
    logger.error(`❌ Error showing duration selection:`, err.message);
    await ctx.reply('❌ Gagal menampilkan pilihan durasi.');
  }
}

/**
 * Register service action: service_create
 */
function registerServiceCreateAction(bot) {
  bot.action('service_create', async (ctx) => {
    if (!ctx || !ctx.match) {
      return ctx.reply('❌ Terjadi kesalahan saat memproses permintaan Anda.');
    }
    await handleServiceAction(ctx, 'create');
  });
}

/**
 * Show account selection for renewal, grouped by server
 * @param {Object} ctx - Telegraf context
 */
async function showAccountSelectionForRenewal(ctx) {
  const userId = ctx.from.id;

  try {
    const { getAccountsForRenewal } = require('../../repositories/accountRepository');
    const { dbGetAsync } = require('../../database/connection');

    // Get user to check role
    const user = await dbGetAsync('SELECT role FROM users WHERE user_id = ?', [userId]);
    let accounts = [];

    if (user && (user.role === 'admin' || user.role === 'owner')) {
      // Admin sees all active accounts
      const { getAllAccounts } = require('../../repositories/accountRepository');
      accounts = await getAllAccounts('active');
    } else {
      // Regular users see only their accounts
      accounts = await getAccountsForRenewal(userId);
    }

    if (!accounts || accounts.length === 0) {
      return ctx.editMessageText(
        '📭 *Tidak ada akun aktif untuk diperpanjang.*\n\n' +
        'Silakan buat akun baru terlebih dahulu.',
        {
          parse_mode: 'Markdown',
          ...Markup.inlineKeyboard([
            [Markup.button.callback('🛒 Buat Akun', 'service_create')],
            [Markup.button.callback('🔙 Menu Utama', 'send_main_menu')]
          ])
        }
      );
    }

    // Group accounts by server
    const grouped = {};
    accounts.forEach(account => {
      const serverName = account.server || 'Unknown Server';
      if (!grouped[serverName]) {
        grouped[serverName] = [];
      }
      grouped[serverName].push(account);
    });

    // Build message with server groups
    let message = '🔄 *Perpanjang Akun*\n\n';
    message += '📋 Pilih akun yang ingin diperpanjang:\n\n';

    const buttons = [];

    Object.keys(grouped).sort().forEach(serverName => {
      const serverAccounts = grouped[serverName];

      // Add server header to message
      message += `🌐 *${serverName}*\n`;

      serverAccounts.forEach(account => {
        const expDate = account.expired_at
          ? new Date(account.expired_at)
          : null;
        const now = new Date();
        const isExpired = expDate && expDate < now;
        const statusIcon = isExpired ? '⚠️ Expired' : '✅ Aktif';
        const expDateStr = expDate
          ? expDate.toLocaleDateString('id-ID')
          : 'N/A';

        message += `  • \`${account.username}\` (${account.protocol}) - ${statusIcon}\n    Exp: ${expDateStr}\n`;

        buttons.push([
          Markup.button.callback(
            `  ${account.username} (${account.protocol}) - ${statusIcon} Exp: ${expDateStr}`,
            `renew_account_${account.id}`
          )
        ]);
      });

      message += '\n';
    });

    // Add back button
    buttons.push([Markup.button.callback('🔙 Menu Utama', 'send_main_menu')]);

    await ctx.editMessageText(message, {
      parse_mode: 'Markdown',
      ...Markup.inlineKeyboard(buttons)
    });

  } catch (error) {
    logger.error('❌ Error showing account selection for renewal:', error);
    await ctx.reply('❌ Gagal menampilkan daftar akun. ' + (error?.message || 'Unknown error'));
  }
}

/**
 * Register service action: service_renew
 */
function registerServiceRenewAction(bot) {
  bot.action('service_renew', async (ctx) => {
    if (!ctx || !ctx.match) {
      return ctx.reply('❌ Terjadi kesalahan saat memproses permintaan Anda.');
    }
    // Show account selection instead of protocol selection
    await showAccountSelectionForRenewal(ctx);
  });
}

/**
 * Register service action: service_trial
 */
function registerServiceTrialAction(bot) {
  bot.action('service_trial', async (ctx) => {
    if (!ctx || !ctx.match) {
      return ctx.reply('❌ Terjadi kesalahan saat memproses permintaan Anda.');
    }
    await handleServiceAction(ctx, 'trial');
  });
}

/**
 * Register protocol selection actions (create/renew/trial)
 */
function registerProtocolActions(bot) {
  const protocols = ['ssh', 'vmess', 'vless', 'trojan', 'shadowsocks'];
  const actions = ['create', 'renew', 'trial'];

  actions.forEach(action => {
    protocols.forEach(protocol => {
      bot.action(`${action}_${protocol}`, async (ctx) => {
        await showServerSelection(ctx, protocol, action);
      });
    });
  });

  // Register 3in1 only for create and renew (not trial)
  ['create', 'renew'].forEach(action => {
    bot.action(`${action}_3in1`, async (ctx) => {
      await showServerSelection(ctx, '3in1', action);
    });
  });

  logger.info('✅ Protocol actions registered (create/renew/trial for all protocols + 3in1)');
}

/**
 * Register all service actions
 * @param {Object} bot - Telegraf bot instance
 */
function registerServiceActions(bot) {
  registerServiceCreateAction(bot);
  registerServiceRenewAction(bot);
  registerServiceTrialAction(bot);
  registerProtocolActions(bot);

  logger.info('✅ Service actions registered');
}

module.exports = {
  registerServiceActions,
  handleServiceAction,
  showServerSelection,
  showDurationSelection,
  registerServiceCreateAction,
  registerServiceRenewAction,
  registerServiceTrialAction,
  registerProtocolActions,
  showAccountSelectionForRenewal
};
