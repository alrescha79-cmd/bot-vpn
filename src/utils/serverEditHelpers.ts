/**
 * @fileoverview Server Edit Helpers
 * Helper functions for server field editing with validation
 * 
 * Architecture:
 * - Field-specific edit handlers
 * - Input validation
 * - Database update operations
 */

const logger = require('./logger');
const { keyboard_nomor } = require('./keyboard');
const { dbRunAsync } = require('../database/connection');

export interface UserStateData {
  serverId?: number;
  userId?: number;
  batasCreateAkun?: string;
  totalCreateAkun?: string;
  iplimit?: string;
  quota?: string;
  amount?: string;
  saldo?: string;
}

export interface TelegrafContext {
  chat: {
    id: number;
  };
  callbackQuery?: {
    message: {
      text: string;
    };
  };
  answerCbQuery: (text: string, options?: { show_alert?: boolean }) => Promise<void>;
  reply: (text: string, options?: any) => Promise<void>;
  editMessageText: (text: string, options?: any) => Promise<void>;
}

export interface DatabaseResult {
  changes: number;
}

/**
 * Handle edit field with numeric keyboard
 * @param {TelegrafContext} ctx - Telegraf context
 * @param {UserStateData} userStateData - User state data
 * @param {string} data - Button data
 * @param {string} field - Field name in state
 * @param {string} fieldName - Display name
 * @param {string} query - SQL update query
 */
export async function handleEditField(
  ctx: TelegrafContext,
  userStateData: UserStateData,
  data: string,
  field: keyof UserStateData,
  fieldName: string,
  query: string
): Promise<void> {
  let currentValue = (userStateData[field] as string) || '';

  // Map numeric keyboard callbacks to actions
  let action = data;
  if (data.startsWith('num_')) {
    if (data === 'num_backspace') {
      action = 'delete';
    } else if (data === 'num_submit') {
      action = 'confirm';
    } else if (data === 'num_cancel') {
      delete (global as any).userState[ctx.chat.id];
      return await ctx.reply('❌ *Operasi dibatalkan.*', { parse_mode: 'Markdown' });
    } else if (data === 'num_0') {
      action = '0';
    } else if (data === 'num_00') {
      action = '00';
    } else if (data === 'num_000') {
      action = '000';
    } else {
      // Extract number from num_X
      action = data.replace('num_', '');
    }
  }

  if (action === 'delete') {
    currentValue = currentValue.slice(0, -1);
  } else if (action === 'confirm') {
    if (currentValue.length === 0) {
      return await ctx.answerCbQuery(`⚠️ ${fieldName} tidak boleh kosong!`, { show_alert: true });
    }
    try {
      await updateServerField(userStateData.serverId!, currentValue, query);
      ctx.reply(
        `✅ *${fieldName} server berhasil diupdate.*\n\n` +
        `📄 *Detail Server:*\n` +
        `- ${fieldName.charAt(0).toUpperCase() + fieldName.slice(1)}: *${currentValue}*`,
        { parse_mode: 'Markdown' }
      );
      logger.info(`✅ Server ${userStateData.serverId} ${fieldName} updated to: ${currentValue}`);
    } catch (err: any) {
      logger.error(`❌ Error updating ${fieldName}:`, err);
      ctx.reply(`❌ *Terjadi kesalahan saat mengupdate ${fieldName} server.*`, { parse_mode: 'Markdown' });
    }
    delete (global as any).userState[ctx.chat.id];
    return;
  } else {
    // Validate numeric input
    if (!/^[0-9]+$/.test(action)) {
      return await ctx.answerCbQuery(`⚠️ Input tidak valid!`, { show_alert: true });
    }
    if (currentValue.length < 20) {
      currentValue += action;
    } else {
      return await ctx.answerCbQuery(`⚠️ Nilai maksimal 20 digit!`, { show_alert: true });
    }
  }

  (userStateData[field] as any) = currentValue;
  const newMessage = `📊 *Silakan masukkan ${fieldName} server baru:*\n\n${fieldName.charAt(0).toUpperCase() + fieldName.slice(1)} saat ini: *${currentValue || '(kosong)'}*`;
  
  if (ctx.callbackQuery && ctx.callbackQuery.message && newMessage !== ctx.callbackQuery.message.text) {
    await ctx.editMessageText(newMessage, {
      reply_markup: { inline_keyboard: keyboard_nomor() },
      parse_mode: 'Markdown'
    });
  }
}

/**
 * Handle edit batas create akun
 */
export async function handleEditBatasCreateAkun(ctx: TelegrafContext, userStateData: UserStateData, data: string): Promise<void> {
  await handleEditField(
    ctx,
    userStateData,
    data,
    'batasCreateAkun',
    'batas create akun',
    'UPDATE Server SET batas_create_akun = ? WHERE id = ?'
  );
}

/**
 * Handle edit total create akun
 */
export async function handleEditTotalCreateAkun(ctx: TelegrafContext, userStateData: UserStateData, data: string): Promise<void> {
  await handleEditField(
    ctx,
    userStateData,
    data,
    'totalCreateAkun',
    'total create akun',
    'UPDATE Server SET total_create_akun = ? WHERE id = ?'
  );
}

/**
 * Handle edit IP limit
 */
export async function handleEditiplimit(ctx: TelegrafContext, userStateData: UserStateData, data: string): Promise<void> {
  await handleEditField(
    ctx,
    userStateData,
    data,
    'iplimit',
    'limit IP',
    'UPDATE Server SET iplimit = ? WHERE id = ?'
  );
}

/**
 * Handle edit quota
 */
export async function handleEditQuota(ctx: TelegrafContext, userStateData: UserStateData, data: string): Promise<void> {
  await handleEditField(
    ctx,
    userStateData,
    data,
    'quota',
    'quota',
    'UPDATE Server SET quota = ? WHERE id = ?'
  );
}

/**
 * Handle edit server auth
 */
export async function handleEditAuth(ctx: TelegrafContext, userStateData: UserStateData, newAuth: string): Promise<void> {
  if (!newAuth || newAuth.trim().length === 0) {
    return ctx.reply('⚠️ *Auth server tidak boleh kosong!*', { parse_mode: 'Markdown' });
  }

  try {
    await dbRunAsync('UPDATE Server SET auth = ? WHERE id = ?', [newAuth.trim(), userStateData.serverId]);
    
    ctx.reply(
      `✅ *Auth server berhasil diupdate.*\n\n` +
      `📄 *Detail Server:*\n` +
      `- Auth: *${newAuth.trim()}*`,
      { parse_mode: 'Markdown' }
    );
    logger.info(`✅ Server ID ${userStateData.serverId} auth updated to: ${newAuth.trim()}`);
  } catch (err: any) {
    logger.error('❌ Error updating auth:', err);
    ctx.reply('❌ *Terjadi kesalahan saat mengupdate auth server.*', { parse_mode: 'Markdown' });
  }

  delete (global as any).userState[ctx.chat.id];
}

/**
 * Handle edit server domain
 */
export async function handleEditDomain(ctx: TelegrafContext, userStateData: UserStateData, newDomain: string): Promise<void> {
  if (!newDomain || newDomain.trim().length === 0) {
    return ctx.reply('⚠️ *Domain server tidak boleh kosong!*', { parse_mode: 'Markdown' });
  }

  // Basic domain validation
  const domainPattern = /^[a-zA-Z0-9]([a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(\.[a-zA-Z0-9]([a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*$/;
  if (!domainPattern.test(newDomain.trim())) {
    return ctx.reply('⚠️ *Format domain tidak valid! Contoh: example.com atau 192.168.1.1*', { parse_mode: 'Markdown' });
  }

  try {
    await dbRunAsync('UPDATE Server SET domain = ? WHERE id = ?', [newDomain.trim(), userStateData.serverId]);
    
    ctx.reply(
      `✅ *Domain server berhasil diupdate.*\n\n` +
      `📄 *Detail Server:*\n` +
      `- Domain: *${newDomain.trim()}*`,
      { parse_mode: 'Markdown' }
    );
    logger.info(`✅ Server ID ${userStateData.serverId} domain updated to: ${newDomain.trim()}`);
  } catch (err: any) {
    logger.error('❌ Error updating domain:', err);
    ctx.reply('❌ *Terjadi kesalahan saat mengupdate domain server.*', { parse_mode: 'Markdown' });
  }

  delete (global as any).userState[ctx.chat.id];
}

/**
 * Handle edit server harga (price)
 */
export async function handleEditHarga(ctx: TelegrafContext, userStateData: UserStateData, data: string): Promise<void> {
  let currentAmount = userStateData.amount || '';

  // Map numeric keyboard callbacks to actions
  let action = data;
  if (data.startsWith('num_')) {
    if (data === 'num_backspace') {
      action = 'delete';
    } else if (data === 'num_submit') {
      action = 'confirm';
    } else if (data === 'num_cancel') {
      delete (global as any).userState[ctx.chat.id];
      return await ctx.reply('❌ *Operasi dibatalkan.*', { parse_mode: 'Markdown' });
    } else if (data === 'num_0') {
      action = '0';
    } else if (data === 'num_00') {
      action = '00';
    } else if (data === 'num_000') {
      action = '000';
    } else {
      // Extract number from num_X
      action = data.replace('num_', '');
    }
  }

  if (action === 'delete') {
    currentAmount = currentAmount.slice(0, -1);
  } else if (action === 'confirm') {
    if (currentAmount.length === 0) {
      return await ctx.answerCbQuery('⚠️ Jumlah tidak boleh kosong!', { show_alert: true });
    }
    const hargaBaru = parseFloat(currentAmount);
    if (isNaN(hargaBaru) || hargaBaru <= 0) {
      return ctx.reply('❌ *Harga tidak valid. Masukkan angka yang valid.*', { parse_mode: 'Markdown' });
    }
    try {
      await updateServerField(userStateData.serverId!, hargaBaru, 'UPDATE Server SET harga = ? WHERE id = ?');
      ctx.reply(
        `✅ *Harga server berhasil diupdate.*\n\n` +
        `📄 *Detail Server:*\n` +
        `- Harga Baru: *Rp ${hargaBaru.toLocaleString('id-ID')}*`,
        { parse_mode: 'Markdown' }
      );
      logger.info(`✅ Server ${userStateData.serverId} harga updated to: ${hargaBaru}`);
    } catch (err: any) {
      logger.error('❌ Error updating harga:', err);
      ctx.reply('❌ *Terjadi kesalahan saat mengupdate harga server.*', { parse_mode: 'Markdown' });
    }
    delete (global as any).userState[ctx.chat.id];
    return;
  } else {
    if (!/^\d+$/.test(action)) {
      return await ctx.answerCbQuery('⚠️ Hanya angka yang diperbolehkan!', { show_alert: true });
    }
    if (currentAmount.length < 12) {
      currentAmount += action;
    } else {
      return await ctx.answerCbQuery('⚠️ Jumlah maksimal adalah 12 digit!', { show_alert: true });
    }
  }

  userStateData.amount = currentAmount;
  const newMessage = `💰 *Silakan masukkan harga server baru:*\n\nJumlah saat ini: *Rp ${currentAmount || '0'}*`;
  
  if (ctx.callbackQuery && ctx.callbackQuery.message && newMessage !== ctx.callbackQuery.message.text) {
    await ctx.editMessageText(newMessage, {
      reply_markup: { inline_keyboard: keyboard_nomor() },
      parse_mode: 'Markdown'
    });
  }
}

/**
 * Handle edit server nama (name)
 */
export async function handleEditNama(ctx: TelegrafContext, userStateData: UserStateData, newName: string): Promise<void> {
  if (!newName || newName.trim().length === 0) {
    return ctx.reply('⚠️ *Nama server tidak boleh kosong!*', { parse_mode: 'Markdown' });
  }

  try {
    await dbRunAsync('UPDATE Server SET nama_server = ? WHERE id = ?', [newName.trim(), userStateData.serverId]);
    
    ctx.reply(
      `✅ *Nama server berhasil diupdate.*\n\n` +
      `📄 *Detail Server:*\n` +
      `- Nama: *${newName.trim()}*`,
      { parse_mode: 'Markdown' }
    );
    logger.info(`✅ Server ID ${userStateData.serverId} nama updated to: ${newName.trim()}`);
  } catch (err: any) {
    logger.error('❌ Error updating nama:', err);
    ctx.reply('❌ *Terjadi kesalahan saat mengupdate nama server.*', { parse_mode: 'Markdown' });
  }

  delete (global as any).userState[ctx.chat.id];
}

/**
 * Handle add saldo user with numeric keyboard
 */
export async function handleAddSaldo(ctx: TelegrafContext, userStateData: UserStateData, data: string): Promise<void> {
  let currentSaldo = userStateData.saldo || '';

  // Map numeric keyboard callbacks to actions
  let action = data;
  if (data.startsWith('num_')) {
    if (data === 'num_backspace') {
      action = 'delete';
    } else if (data === 'num_submit') {
      action = 'confirm';
    } else if (data === 'num_cancel') {
      delete (global as any).userState[ctx.chat.id];
      return await ctx.reply('❌ *Operasi dibatalkan.*', { parse_mode: 'Markdown' });
    } else if (data === 'num_0') {
      action = '0';
    } else if (data === 'num_00') {
      action = '00';
    } else if (data === 'num_000') {
      action = '000';
    } else {
      // Extract number from num_X
      action = data.replace('num_', '');
    }
  }

  if (action === 'delete') {
    currentSaldo = currentSaldo.slice(0, -1);
  } else if (action === 'confirm') {
    if (currentSaldo.length === 0) {
      return await ctx.answerCbQuery('⚠️ Jumlah saldo tidak boleh kosong!', { show_alert: true });
    }

    try {
      await updateUserSaldo(userStateData.userId!, currentSaldo);
      ctx.reply(
        `✅ *Saldo user berhasil ditambahkan.*\n\n` +
        `📄 *Detail Saldo:*\n` +
        `- Jumlah Saldo: *Rp ${parseInt(currentSaldo).toLocaleString('id-ID')}*`,
        { parse_mode: 'Markdown' }
      );
      logger.info(`✅ User ${userStateData.userId} saldo added: ${currentSaldo}`);
    } catch (err: any) {
      logger.error('❌ Error adding saldo:', err);
      ctx.reply('❌ *Terjadi kesalahan saat menambahkan saldo user.*', { parse_mode: 'Markdown' });
    }
    delete (global as any).userState[ctx.chat.id];
    return;
  } else {
    if (!/^[0-9]+$/.test(action)) {
      return await ctx.answerCbQuery('⚠️ Jumlah saldo tidak valid!', { show_alert: true });
    }
    if (currentSaldo.length < 10) {
      currentSaldo += action;
    } else {
      return await ctx.answerCbQuery('⚠️ Jumlah saldo maksimal adalah 10 karakter!', { show_alert: true });
    }
  }

  userStateData.saldo = currentSaldo;
  const newMessage = `📊 *Silakan masukkan jumlah saldo yang ingin ditambahkan:*\n\nJumlah saldo saat ini: *${currentSaldo || '0'}*`;
  
  if (ctx.callbackQuery && ctx.callbackQuery.message && newMessage !== ctx.callbackQuery.message.text) {
    await ctx.editMessageText(newMessage, {
      reply_markup: { inline_keyboard: keyboard_nomor() },
      parse_mode: 'Markdown'
    });
  }
}

/**
 * Update server field in database
 * @param {number} serverId - Server ID
 * @param {any} value - New value
 * @param {string} query - SQL query
 */
export async function updateServerField(serverId: number, value: any, query: string): Promise<void> {
  try {
    await dbRunAsync(query, [value, serverId]);
    logger.info(`✅ Server ${serverId} field updated successfully`);
  } catch (err: any) {
    logger.error(`❌ Error updating server field:`, err);
    throw err;
  }
}

/**
 * Update user saldo in database
 * @param {number} userId - User ID
 * @param {string} saldo - Saldo amount to add
 */
export async function updateUserSaldo(userId: number, saldo: string): Promise<void> {
  try {
    await dbRunAsync('UPDATE Users SET saldo = saldo + ? WHERE id = ?', [saldo, userId]);
    logger.info(`✅ User ${userId} saldo updated: +${saldo}`);
  } catch (err: any) {
    logger.error(`❌ Error updating user saldo:`, err);
    throw err;
  }
}

module.exports = {
  handleEditField,
  handleEditBatasCreateAkun,
  handleEditTotalCreateAkun,
  handleEditiplimit,
  handleEditQuota,
  handleEditAuth,
  handleEditDomain,
  handleEditHarga,
  handleEditNama,
  handleAddSaldo,
  updateServerField,
  updateUserSaldo
};
