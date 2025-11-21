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
      ],
      [
        Markup.button.callback('🔙 Menu Utama', 'send_main_menu')
      ]
    ];

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

    const buttons = servers.map(server => {
      const flag = getFlagEmoji(server.location || '');
      const label = `${flag} ${server.nama_server}`;
      return [Markup.button.callback(label, `${action}_server_${protocol}_${server.id}`)];
    });

    buttons.push([Markup.button.callback('🔙 Kembali', `service_${action}`)]);

    const protocolLabels = {
      ssh: '🔐 SSH',
      vmess: '📡 VMESS',
      vless: '🌐 VLESS',
      trojan: '🔒 TROJAN',
      shadowsocks: '🕶️ SHADOWSOCKS'
    };

    const message = `
${protocolLabels[protocol] || protocol.toUpperCase()}

Pilih server yang tersedia:
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
 * Register service action: service_renew
 */
function registerServiceRenewAction(bot) {
  bot.action('service_renew', async (ctx) => {
    if (!ctx || !ctx.match) {
      return ctx.reply('❌ Terjadi kesalahan saat memproses permintaan Anda.');
    }
    await handleServiceAction(ctx, 'renew');
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

  logger.info('✅ Protocol actions registered (create/renew/trial for all protocols)');
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
  registerServiceCreateAction,
  registerServiceRenewAction,
  registerServiceTrialAction,
  registerProtocolActions
};
