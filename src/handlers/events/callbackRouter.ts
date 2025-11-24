
import type { BotContext, DatabaseUser, DatabaseServer } from "../../types";
/**
 * @fileoverview Centralized Callback Query Router
 * Routes callback queries to appropriate handlers based on data patterns
 * 
 * Architecture:
 * - Centralized callback_query handling
 * - State-based routing (deposit, edit, etc.)
 * - Admin action routing
 * - Backup/restore routing
 */

const logger = require('../../utils/logger');
const { handleDepositState } = require('../../services/depositService');
const {
  handleAddSaldo,
  handleEditBatasCreateAkun,
  handleEditiplimit,
  handleEditQuota,
  handleEditHarga
} = require('../../utils/serverEditHelpers');

const fs = require('fs');
const path = require('path');

const BACKUP_DIR = process.env.BACKUP_DIR || path.join(__dirname, '../../backups');
const DB_PATH = process.env.DB_PATH || path.join(__dirname, '../../database.db');
const adminIds = process.env.ADMIN_IDS ? process.env.ADMIN_IDS.split(',').map(id => parseInt(id.trim())) : [];

/**
 * Register centralized callback query handler
 * @param {Object} bot - Telegraf bot instance
 */
function registerCallbackRouter(bot) {
  bot.on('callback_query', async (ctx) => {
    const userId = String(ctx.from.id);
    const data = ctx.callbackQuery.data;
    const userStateData = global.userState?.[ctx.chat?.id];

    try {
      await ctx.answerCbQuery();
    } catch (error) {
      logger.warn('Failed to answer callback query:', error.message);
    }

    // === 1️⃣ DEPOSIT STATE HANDLING ===
    if (global.depositState?.[userId]?.action === 'request_amount') {
      return await handleDepositState(ctx, userId, data);
    }

    // === 1.5️⃣ PAYMENT CHECKING & CANCELLATION ===
    if (data.startsWith('check_payment_')) {
      const invoiceId = data.replace('check_payment_', '');
      return await handleCheckPaymentStatus(ctx, invoiceId, userId);
    }

    if (data.startsWith('cancel_payment_')) {
      const invoiceId = data.replace('cancel_payment_', '');
      return await handleCancelPayment(ctx, invoiceId, userId);
    }

    // === 2️⃣ USER STATE HANDLING (EDIT OPERATIONS) ===
    if (userStateData) {
      switch (userStateData.step) {
        case 'add_saldo':
          return await handleAddSaldo(ctx, userStateData, data);
        case 'edit_batas_create_akun':
          return await handleEditBatasCreateAkun(ctx, userStateData, data);
        case 'edit_limit_ip':
          return await handleEditiplimit(ctx, userStateData, data);
        case 'edit_quota':
          return await handleEditQuota(ctx, userStateData, data);
        case 'edit_harga':
          return await handleEditHarga(ctx, userStateData, data);
        // edit_total_create_akun removed - now read-only display
      }
    }

    // === 3️⃣ ADMIN BACKUP/RESTORE ACTIONS ===
    // Check if this is an admin-only action
    const adminOnlyActions = [
      'admin_backup_db',
      'admin_restore_db',
      'admin_restore_all',
      'restore_file::',
      'restore_uploaded_file::',
      'delete_file::',
      'confirm_delete::',
      'delete_uploaded_file::'
    ];

    const isAdminAction = adminOnlyActions.some(action => data.startsWith(action));

    // Only check admin permission for admin-only actions
    if (isAdminAction && !adminIds.includes(parseInt(userId))) {
      logger.warn(`Unauthorized admin action attempt by user ${userId}: ${data}`);
      return await ctx.reply('⛔ Aksi ini hanya untuk admin.');
    }

    // Admin backup database
    if (data === 'admin_backup_db') {
      return await handleAdminBackup(ctx, userId);
    }

    // Admin restore database - show today's backups
    if (data === 'admin_restore_db') {
      return await handleAdminRestoreList(ctx);
    }

    // Admin restore all backups
    if (data === 'admin_restore_all') {
      return await handleAdminRestoreAllList(ctx);
    }

    // Restore from specific file
    if (data.startsWith('restore_file::')) {
      const fileName = data.split('::')[1];
      return await handleRestoreFile(ctx, fileName, userId);
    }

    // Restore from uploaded file
    if (data.startsWith('restore_uploaded_file::')) {
      const fileName = data.split('::')[1];
      return await handleRestoreUploadedFile(ctx, fileName, userId);
    }

    // Delete backup file
    if (data.startsWith('delete_file::')) {
      const fileName = data.split('::')[1];
      return await handleDeleteFileConfirm(ctx, fileName);
    }

    // Confirm delete backup file
    if (data.startsWith('confirm_delete::')) {
      const fileName = data.split('::')[1];
      return await handleConfirmDelete(ctx, fileName, userId);
    }

    // Cancel delete
    if (data === 'cancel_delete') {
      return await ctx.editMessageText('❎ *Penghapusan dibatalkan.*', { parse_mode: 'Markdown' });
    }

    // Delete uploaded file
    if (data.startsWith('delete_uploaded_file::')) {
      const fileName = data.split('::')[1];
      return await handleDeleteUploadedFile(ctx, fileName, userId);
    }
  });

  logger.info('✅ Centralized callback router registered');
}

/**
 * Handle admin backup database
 */
async function handleAdminBackup(ctx, userId) {
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const backupFile = path.join(BACKUP_DIR, `botvpn_${timestamp}.db`);

  try {
    // Create backup directory if not exists
    if (!fs.existsSync(BACKUP_DIR)) {
      fs.mkdirSync(BACKUP_DIR, { recursive: true });
    }

    fs.copyFileSync(DB_PATH, backupFile);
    await ctx.reply('✅ *Backup berhasil dibuat dan dikirim.*', { parse_mode: 'Markdown' });
    await ctx.telegram.sendDocument(userId, { source: backupFile });
    logger.info(`✅ Backup created: ${backupFile}`);
  } catch (err) {
    logger.error('❌ Backup failed:', err);
    return ctx.reply('❌ *Gagal membuat backup.*', { parse_mode: 'Markdown' });
  }
}

/**
 * Handle admin restore list (today's backups only)
 */
async function handleAdminRestoreList(ctx) {
  const today = new Date().toISOString().slice(0, 10); // format: 2025-11-21

  try {
    const files = fs.readdirSync(BACKUP_DIR)
      .filter(f => f.endsWith('.db') && f.includes(today))
      .sort((a, b) => fs.statSync(path.join(BACKUP_DIR, b)).mtimeMs - fs.statSync(path.join(BACKUP_DIR, a)).mtimeMs)
      .slice(0, 10);

    if (!files.length) {
      return ctx.reply(`❌ *Tidak ada backup hari ini ditemukan (${today}).*`, { parse_mode: 'Markdown' });
    }

    const buttons = files.map(f => [
      { text: `🗂 ${f}`, callback_data: `restore_file::${f}` },
      { text: '🗑 Hapus', callback_data: `delete_file::${f}` }
    ]);

    return ctx.reply(`📂 *Backup Hari Ini (${today})*:\nPilih restore atau hapus:`, {
      parse_mode: 'Markdown',
      reply_markup: { inline_keyboard: buttons }
    });
  } catch (error) {
    logger.error('❌ Error listing backups:', error);
    return ctx.reply('❌ *Gagal menampilkan daftar backup.*', { parse_mode: 'Markdown' });
  }
}

/**
 * Handle admin restore all list
 */
async function handleAdminRestoreAllList(ctx) {
  try {
    const files = fs.readdirSync(BACKUP_DIR)
      .filter(f => f.endsWith('.db'))
      .sort((a, b) => fs.statSync(path.join(BACKUP_DIR, b)).mtimeMs - fs.statSync(path.join(BACKUP_DIR, a)).mtimeMs)
      .slice(0, 15);

    if (!files.length) {
      return ctx.reply('❌ *Tidak ada file backup ditemukan.*', { parse_mode: 'Markdown' });
    }

    const buttons = files.map(f => [
      { text: `🗂 ${f}`, callback_data: `restore_file::${f}` },
      { text: '🗑 Hapus', callback_data: `delete_file::${f}` }
    ]);

    return ctx.reply('📂 *Daftar Semua Backup:*\nPilih restore atau hapus:', {
      parse_mode: 'Markdown',
      reply_markup: { inline_keyboard: buttons }
    });
  } catch (error) {
    logger.error('❌ Error listing all backups:', error);
    return ctx.reply('❌ *Gagal menampilkan daftar backup.*', { parse_mode: 'Markdown' });
  }
}

/**
 * Handle restore from specific file
 */
async function handleRestoreFile(ctx, fileName, userId) {
  const filePath = path.join(BACKUP_DIR, fileName);

  try {
    if (!fs.existsSync(filePath)) {
      return ctx.reply(`❌ *File tidak ditemukan:* \`${fileName}\``, { parse_mode: 'Markdown' });
    }

    fs.copyFileSync(filePath, DB_PATH);
    await ctx.editMessageText(`✅ *Restore berhasil dari:* \`${fileName}\``, { parse_mode: 'Markdown' });
    logger.info(`[RESTORE] User ${userId} restored ${fileName}`);
  } catch (err) {
    logger.error('❌ Restore file failed:', err);
    return ctx.reply('❌ *Gagal restore file.*', { parse_mode: 'Markdown' });
  }
}

/**
 * Handle restore from uploaded file
 */
async function handleRestoreUploadedFile(ctx, fileName, userId) {
  const filePath = path.join('/backup/bot/uploaded_restore', fileName);

  if (!fs.existsSync(filePath)) {
    return ctx.reply(`❌ File tidak ditemukan: ${fileName}`);
  }

  try {
    fs.copyFileSync(filePath, DB_PATH);
    await ctx.editMessageText(`✅ Restore berhasil dari upload: ${fileName}`);
    logger.info(`[RESTORE_UPLOAD] User ${userId} restored uploaded file ${fileName}`);
    
    // Clean up state
    delete global.userState[ctx.chat.id];
  } catch (err) {
    logger.error('❌ Restore upload failed:', err);
    await ctx.reply('❌ Gagal restore file.');
  }
}

/**
 * Handle delete file confirmation
 */
async function handleDeleteFileConfirm(ctx, fileName) {
  return ctx.reply(
    `⚠️ *Yakin ingin menghapus backup berikut?*\n🗂 \`${fileName}\``,
    {
      parse_mode: 'Markdown',
      reply_markup: {
        inline_keyboard: [
          [
            { text: '✅ Ya, Hapus', callback_data: `confirm_delete::${fileName}` },
            { text: '❌ Batal', callback_data: 'cancel_delete' }
          ]
        ]
      }
    }
  );
}

/**
 * Handle confirm delete backup file
 */
async function handleConfirmDelete(ctx, fileName, userId) {
  const filePath = path.join(BACKUP_DIR, fileName);

  try {
    if (!fs.existsSync(filePath)) {
      return ctx.reply(`❌ *File tidak ditemukan:* \`${fileName}\``, { parse_mode: 'Markdown' });
    }

    fs.unlinkSync(filePath);
    await ctx.editMessageText(`🗑 *Backup dihapus:* \`${fileName}\``, { parse_mode: 'Markdown' });
    logger.info(`[CONFIRM_DELETE] User ${userId} deleted ${fileName}`);
  } catch (err) {
    logger.error('❌ Delete failed:', err);
    ctx.reply('❌ *Gagal hapus file backup.*', { parse_mode: 'Markdown' });
  }
}

/**
 * Handle delete uploaded file
 */
async function handleDeleteUploadedFile(ctx, fileName, userId) {
  const filePath = path.join('/backup/bot/uploaded_restore', fileName);

  if (!fs.existsSync(filePath)) {
    return ctx.reply(`❌ *File tidak ditemukan:* \`${fileName}\``, { parse_mode: 'Markdown' });
  }

  try {
    fs.unlinkSync(filePath);
    await ctx.editMessageText(`🗑 *File upload dihapus:* \`${fileName}\``, { parse_mode: 'Markdown' });
    logger.info(`[DELETE_UPLOAD] User ${userId} deleted ${fileName}`);
  } catch (err) {
    logger.error('❌ Delete uploaded file failed:', err);
    ctx.reply('❌ *Gagal hapus file upload.*', { parse_mode: 'Markdown' });
  }
}

/**
 * Handle check payment status
 */
async function handleCheckPaymentStatus(ctx, invoiceId, userId) {
  const { getPendingDeposit } = require('../../repositories/depositRepository');
  const { checkPaymentStatus } = require('../../services/qris.service');
  
  try {
    await ctx.answerCbQuery('🔄 Mengecek status pembayaran...');
    
    const deposit = await getPendingDeposit(invoiceId);
    
    if (!deposit) {
      return await ctx.answerCbQuery('❌ Deposit tidak ditemukan', { show_alert: true });
    }
    
    if (deposit.status !== 'pending') {
      return await ctx.answerCbQuery(`ℹ️ Status: ${deposit.status}`, { show_alert: true });
    }
    
    // Check payment status from API
    const statusResult = await checkPaymentStatus(invoiceId);
    
    if (statusResult.success && statusResult.status === 'paid') {
      const { handleSuccessfulPayment } = require('../../services/depositService');
      await handleSuccessfulPayment(ctx, invoiceId, userId, deposit.amount, deposit.qr_message_id);
      await ctx.answerCbQuery('✅ Pembayaran berhasil!', { show_alert: true });
    } else {
      await ctx.answerCbQuery(`⏳ Status: ${statusResult.status || 'pending'}`, { show_alert: true });
    }
  } catch (error) {
    logger.error('Error checking payment status:', error);
    await ctx.answerCbQuery('❌ Gagal mengecek status', { show_alert: true });
  }
}

/**
 * Handle cancel payment
 */
async function handleCancelPayment(ctx, invoiceId, userId) {
  const { updateDepositStatus, getPendingDeposit } = require('../../repositories/depositRepository');
  
  try {
    const deposit = await getPendingDeposit(invoiceId);
    
    if (!deposit) {
      return await ctx.answerCbQuery('❌ Deposit tidak ditemukan', { show_alert: true });
    }
    
    if (deposit.status !== 'pending') {
      return await ctx.answerCbQuery(`ℹ️ Deposit sudah ${deposit.status}`, { show_alert: true });
    }
    
    // Update status to cancelled
    await updateDepositStatus(invoiceId, 'cancelled');
    
    // Update message
    await ctx.editMessageCaption(
      `
❌ *PEMBAYARAN DIBATALKAN*

🆔 *Invoice:* \`${invoiceId}\`
💰 *Amount:* Rp ${deposit.amount.toLocaleString('id-ID')}
❌ *Status:* Cancelled

Deposit telah dibatalkan oleh user.
      `.trim(),
      {
        parse_mode: 'Markdown',
        reply_markup: {
          inline_keyboard: [
            [{ text: '🔄 Deposit Lagi', callback_data: 'topup_saldo' }],
            [{ text: '🔙 Menu Utama', callback_data: 'send_main_menu' }]
          ]
        }
      }
    );
    
    await ctx.answerCbQuery('✅ Deposit dibatalkan');
    logger.info(`Payment cancelled: ${invoiceId} by user ${userId}`);
  } catch (error) {
    logger.error('Error cancelling payment:', error);
    await ctx.answerCbQuery('❌ Gagal membatalkan deposit', { show_alert: true });
  }
}

module.exports = {
  registerCallbackRouter
};
