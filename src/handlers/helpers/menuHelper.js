/**
 * Menu Helper
 * Helper functions for sending menu keyboards
 * @module handlers/helpers/menuHelper
 */

const { Markup } = require('telegraf');
const { dbGetAsync } = require('../../database/connection');
const { isAdmin, isReseller } = require('../../middleware/roleCheck');
const logger = require('../../utils/logger');

/**
 * Send main menu to user
 * @param {Object} ctx - Telegraf context
 * @returns {Promise<void>}
 */
async function sendMainMenu(ctx) {
  const userId = ctx.from.id;
  
  try {
    const user = await dbGetAsync('SELECT role, saldo FROM users WHERE user_id = ?', [userId]);
    
    if (!user) {
      return ctx.reply('❌ Anda belum terdaftar. Ketik /start untuk memulai.');
    }

    const roleEmoji = {
      admin: '👑',
      owner: '👑',
      reseller: '💼',
      user: '👤'
    }[user.role] || '👤';

    const welcomeText = `
${roleEmoji} *Selamat Datang!*

💰 *Saldo:* Rp${user.saldo.toLocaleString('id-ID')}
📊 *Role:* ${user.role}

Silakan pilih menu di bawah:
    `.trim();

    const keyboard = [
      [
        Markup.button.callback('🛒 Beli Akun', 'service_create'),
        Markup.button.callback('🔄 Perpanjang', 'service_renew')
      ],
      [
        Markup.button.callback('🎁 Trial Gratis', 'service_trial'),
        Markup.button.callback('💰 Cek Saldo', 'cek_saldo')
      ],
      [
        Markup.button.callback('💳 Top Up Saldo', 'topup_saldo')
      ]
    ];

    // Add reseller menu for resellers
    if (user.role === 'reseller' || user.role === 'admin' || user.role === 'owner') {
      keyboard.push([Markup.button.callback('💼 Menu Reseller', 'menu_reseller')]);
    }

    // Add admin menu for admins
    if (user.role === 'admin' || user.role === 'owner') {
      keyboard.push([Markup.button.callback('👑 Menu Admin', 'admin')]);
    }

    // Upgrade to reseller for regular users
    if (user.role === 'user') {
      keyboard.push([Markup.button.callback('⬆️ Upgrade Reseller', 'upgrade_to_reseller')]);
    }

    await ctx.reply(welcomeText, {
      parse_mode: 'Markdown',
      ...Markup.inlineKeyboard(keyboard)
    });
  } catch (err) {
    logger.error('❌ Error sending main menu:', err.message);
    await ctx.reply('❌ Gagal menampilkan menu.');
  }
}

/**
 * Send admin menu
 * @param {Object} ctx - Telegraf context
 * @returns {Promise<void>}
 */
async function sendAdminMenu(ctx) {
  const adminText = `
👑 *MENU ADMIN*

Pilih menu administrasi:
  `.trim();

  const keyboard = Markup.inlineKeyboard([
    [
      Markup.button.callback('🖥️ Kelola Server', 'admin_server_menu'),
      Markup.button.callback('👥 Kelola User', 'admin_listuser')
    ],
    [
      Markup.button.callback('📊 Statistik', 'admin_stats'),
      Markup.button.callback('📢 Broadcast', 'admin_broadcast')
    ],
    [
      Markup.button.callback('👑 Kelola Reseller', 'admin_listreseller'),
      Markup.button.callback('💰 Lihat Top Up', 'admin_view_topup')
    ],
    [
      Markup.button.callback('💾 Backup DB', 'admin_backup_db'),
      Markup.button.callback('♻️ Restore DB', 'admin_restore_db')
    ],
    [
      Markup.button.callback('⚙️ Sistem', 'admin_system_menu')
    ],
    [
      Markup.button.callback('🔙 Menu Utama', 'send_main_menu')
    ]
  ]);

  await ctx.reply(adminText, {
    parse_mode: 'Markdown',
    ...keyboard
  });
}

/**
 * Send reseller menu
 * @param {Object} ctx - Telegraf context
 * @returns {Promise<void>}
 */
async function sendResellerMenu(ctx) {
  const userId = ctx.from.id;

  try {
    const user = await dbGetAsync('SELECT saldo, role FROM users WHERE user_id = ?', [userId]);

    if (!user || (user.role !== 'reseller' && user.role !== 'admin' && user.role !== 'owner')) {
      return ctx.reply('❌ Anda bukan reseller.');
    }

    const menuText = `
💼 *MENU RESELLER*

💰 *Saldo:* Rp${user.saldo.toLocaleString('id-ID')}

Pilih menu reseller:
    `.trim();

    const keyboard = Markup.inlineKeyboard([
      [
        Markup.button.callback('💰 Cek Komisi', 'reseller_komisi'),
        Markup.button.callback('📊 Riwayat', 'reseller_riwayat')
      ],
      [
        Markup.button.callback('📈 Top Reseller', 'reseller_top_all'),
        Markup.button.callback('🏆 Top Weekly', 'reseller_top_weekly')
      ],
      [
        Markup.button.callback('💸 Transfer Saldo', 'reseller_transfer'),
        Markup.button.callback('📜 Log Transfer', 'reseller_logtransfer')
      ],
      [
        Markup.button.callback('📊 Export Data', 'reseller_export')
      ],
      [
        Markup.button.callback('🔙 Menu Utama', 'send_main_menu')
      ]
    ]);

    await ctx.reply(menuText, {
      parse_mode: 'Markdown',
      ...keyboard
    });
  } catch (err) {
    logger.error('❌ Error sending reseller menu:', err.message);
    await ctx.reply('❌ Gagal menampilkan menu reseller.');
  }
}

/**
 * Send server management menu
 * @param {Object} ctx - Telegraf context
 * @returns {Promise<void>}
 */
async function sendServerMenu(ctx) {
  const menuText = `
🖥️ *KELOLA SERVER*

Pilih aksi server:
  `.trim();

  const keyboard = Markup.inlineKeyboard([
    [
      Markup.button.callback('➕ Tambah Server', 'addserver'),
      Markup.button.callback('📋 List Server', 'listserver')
    ],
    [
      Markup.button.callback('🔙 Menu Admin', 'admin')
    ]
  ]);

  await ctx.reply(menuText, {
    parse_mode: 'Markdown',
    ...keyboard
  });
}

/**
 * Send system menu
 * @param {Object} ctx - Telegraf context
 * @returns {Promise<void>}
 */
async function sendSystemMenu(ctx) {
  const menuText = `
⚙️ *MENU SISTEM*

Pengaturan sistem:
  `.trim();

  const keyboard = Markup.inlineKeyboard([
    [
      Markup.button.callback('🗑️ Reset Database', 'resetdb'),
      Markup.button.callback('🧹 Clear Dummy', 'clear_dummy')
    ],
    [
      Markup.button.callback('🔙 Menu Admin', 'admin')
    ]
  ]);

  await ctx.reply(menuText, {
    parse_mode: 'Markdown',
    ...keyboard
  });
}

module.exports = {
  sendMainMenu,
  sendAdminMenu,
  sendResellerMenu,
  sendServerMenu,
  sendSystemMenu
};
