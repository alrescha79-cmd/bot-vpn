/**
 * Keyboard Builder Utilities
 * Reusable Telegram inline keyboard builders
 */

const { Markup } = require('telegraf');

export interface TelegrafButton {
  text: string;
  callback_data: string;
}

export interface ServerItem {
  id: number;
  nama_server: string;
  batas_create_akun: number;
  total_create_akun: number;
}

/**
 * Build paginated keyboard
 * @param {Array} items - Items to paginate
 * @param {number} currentPage - Current page (0-indexed)
 * @param {number} itemsPerPage - Items per page
 * @param {Function} buildButton - Function to build button from item
 * @param {string} navigationPrefix - Prefix for navigation callbacks
 * @returns {Object} - Telegraf keyboard markup
 */
export function buildPaginatedKeyboard<T>(
  items: T[], 
  currentPage: number, 
  itemsPerPage: number, 
  buildButton: (item: T) => TelegrafButton[], 
  navigationPrefix: string
): any {
  const totalPages = Math.ceil(items.length / itemsPerPage);
  const start = currentPage * itemsPerPage;
  const end = start + itemsPerPage;
  const pageItems = items.slice(start, end);

  const buttons = pageItems.map(buildButton);
  
  // Navigation buttons
  const navButtons: any[] = [];
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
export function buildMainMenuKeyboard(userRole: string): any {
  const buttons: any[][] = [
    [Markup.button.callback('🔐 Create Akun', 'create')],
    [Markup.button.callback('♻️ Renew Akun', 'renew')],
    [Markup.button.callback('🎯 Trial Akun', 'trial')],
    [Markup.button.callback('👤 Akunku', 'akunku')],
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
export function buildProtocolKeyboard(action: string): any {
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
 * @param {ServerItem[]} servers - Array of server objects
 * @param {string} protocol - Protocol name
 * @param {string} action - Action type (trial, create, renew)
 * @param {number} page - Current page
 * @returns {Object}
 */
export function buildServerKeyboard(
  servers: ServerItem[], 
  protocol: string, 
  action: string, 
  page: number = 0
): any {
  const buildButton = (server: ServerItem): TelegrafButton[] => {
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
export function buildConfirmationKeyboard(confirmCallback: string, cancelCallback: string = 'cancel'): any {
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
export function buildAdminMenuKeyboard(): any {
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
export function buildBackButton(callbackData: string = 'back'): any {
  return Markup.inlineKeyboard([
    [Markup.button.callback('🔙 Kembali', callbackData)]
  ]);
}

/**
 * Build numeric keyboard for number input
 * @returns {Array} - Inline keyboard array
 */
export function keyboard_nomor(): any[][] {
  return [
    [
      { text: '1', callback_data: 'num_1' },
      { text: '2', callback_data: 'num_2' },
      { text: '3', callback_data: 'num_3' }
    ],
    [
      { text: '4', callback_data: 'num_4' },
      { text: '5', callback_data: 'num_5' },
      { text: '6', callback_data: 'num_6' }
    ],
    [
      { text: '7', callback_data: 'num_7' },
      { text: '8', callback_data: 'num_8' },
      { text: '9', callback_data: 'num_9' }
    ],
    [
      { text: '0', callback_data: 'num_0' },
      { text: '00', callback_data: 'num_00' },
      { text: '000', callback_data: 'num_000' }
    ],
    [
      { text: '⬅️ Hapus', callback_data: 'num_backspace' },
      { text: '✅ Kirim', callback_data: 'num_submit' }
    ],
    [
      { text: '❌ Batal', callback_data: 'num_cancel' }
    ]
  ];
}

module.exports = {
  buildPaginatedKeyboard,
  buildMainMenuKeyboard,
  buildProtocolKeyboard,
  buildServerKeyboard,
  buildConfirmationKeyboard,
  buildAdminMenuKeyboard,
  buildBackButton,
  keyboard_nomor
};
