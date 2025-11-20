/**
 * Keyboard Builder Utilities
 * Reusable Telegram inline keyboard builders
 */

const { Markup } = require('telegraf');

/**
 * Build paginated keyboard
 * @param {Array} items - Items to paginate
 * @param {number} currentPage - Current page (0-indexed)
 * @param {number} itemsPerPage - Items per page
 * @param {Function} buildButton - Function to build button from item
 * @param {string} navigationPrefix - Prefix for navigation callbacks
 * @returns {Object} - Telegraf keyboard markup
 */
function buildPaginatedKeyboard(items, currentPage, itemsPerPage, buildButton, navigationPrefix) {
  const totalPages = Math.ceil(items.length / itemsPerPage);
  const start = currentPage * itemsPerPage;
  const end = start + itemsPerPage;
  const pageItems = items.slice(start, end);

  const buttons = pageItems.map(buildButton);
  
  // Navigation buttons
  const navButtons = [];
  if (currentPage > 0) {
    navButtons.push(Markup.button.callback('⬅️ Sebelumnya', `${navigationPrefix}_${currentPage - 1}`));
  }
  if (currentPage < totalPages - 1) {
    navButtons.push(Markup.button.callback('Selanjutnya ➡️', `${navigationPrefix}_${currentPage + 1}`));
  }

  const keyboard = [...buttons];
  if (navButtons.length > 0) {
    keyboard.push(navButtons);
  }
  keyboard.push([Markup.button.callback('🔙 Kembali', 'back')]);

  return Markup.inlineKeyboard(keyboard);
}

/**
 * Build main menu keyboard
 * @param {string} userRole - User role (user, reseller, admin)
 * @returns {Object}
 */
function buildMainMenuKeyboard(userRole) {
  const buttons = [
    [Markup.button.callback('🔐 Create Akun', 'create')],
    [Markup.button.callback('♻️ Renew Akun', 'renew')],
    [Markup.button.callback('🎯 Trial Akun', 'trial')],
    [Markup.button.callback('💰 Cek Saldo', 'ceksaldo')],
    [Markup.button.callback('➕ Deposit Saldo', 'deposit')]
  ];

  if (userRole === 'reseller') {
    buttons.push([Markup.button.callback('📊 Komisi Reseller', 'reseller_komisi')]);
  }

  buttons.push([Markup.button.callback('ℹ️ Info & Bantuan', 'info')]);

  return Markup.inlineKeyboard(buttons);
}

/**
 * Build protocol selection keyboard
 * @param {string} action - Action type (create, renew, trial)
 * @returns {Object}
 */
function buildProtocolKeyboard(action) {
  return Markup.inlineKeyboard([
    [Markup.button.callback('🔑 SSH', `${action}_ssh`)],
    [Markup.button.callback('🔷 VMESS', `${action}_vmess`)],
    [Markup.button.callback('🔶 VLESS', `${action}_vless`)],
    [Markup.button.callback('🔴 TROJAN', `${action}_trojan`)],
    [Markup.button.callback('🔵 SHADOWSOCKS', `${action}_shadowsocks`)],
    [Markup.button.callback('🔙 Kembali', 'back')]
  ]);
}

/**
 * Build server selection keyboard
 * @param {Array} servers - Array of server objects
 * @param {string} protocol - Protocol name
 * @param {string} action - Action type (trial, create, renew)
 * @param {number} page - Current page
 * @returns {Object}
 */
function buildServerKeyboard(servers, protocol, action, page = 0) {
  const buildButton = (server) => {
    const available = server.batas_create_akun - server.total_create_akun;
    const label = `${server.nama_server} (${available} slot)`;
    return [Markup.button.callback(label, `${action}_server_${protocol}_${server.id}`)];
  };

  return buildPaginatedKeyboard(
    servers,
    page,
    8,
    buildButton,
    `navigate_${action}_${protocol}`
  );
}

/**
 * Build confirmation keyboard
 * @param {string} confirmCallback - Callback data for confirm button
 * @param {string} cancelCallback - Callback data for cancel button
 * @returns {Object}
 */
function buildConfirmationKeyboard(confirmCallback, cancelCallback = 'cancel') {
  return Markup.inlineKeyboard([
    [
      Markup.button.callback('✅ Ya', confirmCallback),
      Markup.button.callback('❌ Tidak', cancelCallback)
    ]
  ]);
}

/**
 * Build admin menu keyboard
 * @returns {Object}
 */
function buildAdminMenuKeyboard() {
  return Markup.inlineKeyboard([
    [Markup.button.callback('📊 Statistik', 'admin_stats')],
    [Markup.button.callback('👥 Kelola User', 'admin_users')],
    [Markup.button.callback('🖥️ Kelola Server', 'admin_servers')],
    [Markup.button.callback('💸 Kelola Saldo', 'admin_balance')],
    [Markup.button.callback('📢 Broadcast', 'admin_broadcast')],
    [Markup.button.callback('🔙 Kembali', 'back')]
  ]);
}

/**
 * Build back button keyboard
 * @param {string} callbackData - Callback data for back button
 * @returns {Object}
 */
function buildBackButton(callbackData = 'back') {
  return Markup.inlineKeyboard([
    [Markup.button.callback('🔙 Kembali', callbackData)]
  ]);
}

module.exports = {
  buildPaginatedKeyboard,
  buildMainMenuKeyboard,
  buildProtocolKeyboard,
  buildServerKeyboard,
  buildConfirmationKeyboard,
  buildAdminMenuKeyboard,
  buildBackButton
};
