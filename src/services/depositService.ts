
import type { BotContext, DatabaseUser, DatabaseServer } from "../types";
/**
 * @fileoverview Deposit Service
 * Handles deposit flow state management and QRIS payment processing
 * 
 * Architecture:
 * - Deposit state management
 * - QRIS payment generation
 * - Payment status checking
 * - Invoice generation
 */

const logger = require('../utils/logger');
const { keyboard_nomor } = require('../utils/keyboard');
const { generateQRIS, checkPaymentStatus, generateQRImageURL, isQRISConfigured } = require('./qris.service');
const { createPendingDeposit, updateDepositStatus, getPendingDeposit } = require('../repositories/depositRepository');
const { getUserById, updateUserSaldo } = require('../repositories/userRepository');
const { Markup } = require('telegraf');

// Import config properly
let config: any;
try {
  config = require('../config').default || require('../config');
} catch (e) {
  config = require('../config');
}

/**
 * Handle deposit state for numeric keyboard input
 * @param {Object} ctx - Telegraf context
 * @param {string} userId - User ID
 * @param {string} data - Button data (number, 'delete', or 'confirm')
 */
async function handleDepositState(ctx, userId, data) {
  let currentAmount = global.depositState[userId].amount;

  if (data === 'backspace') {
    currentAmount = currentAmount.slice(0, -1);
  } else if (data === 'submit') {
    if (currentAmount.length === 0) {
      return await ctx.answerCbQuery('⚠️ Jumlah tidak boleh kosong!', { show_alert: true });
    }
    if (parseInt(currentAmount) < 5000) {
      return await ctx.answerCbQuery('⚠️ Jumlah minimal top-up adalah 5000 Ya Kawan...!!!', { show_alert: true });
    }
    global.depositState[userId].action = 'confirm_amount';
    await processDeposit(ctx, currentAmount);
    return;
  } else if (data === 'cancel') {
    delete global.depositState[userId];
    await ctx.editMessageText('❌ Input nominal dibatalkan.', {
      reply_markup: {
        inline_keyboard: [[{ text: '🔙 Kembali', callback_data: 'topup_saldo' }]]
      }
    });
    return;
  } else {
    // data is a number ('1', '2', '0', '00', '000', etc.)
    if (currentAmount.length < 12) {
      currentAmount += data;
    } else {
      return await ctx.answerCbQuery('⚠️ Jumlah maksimal adalah 12 digit!', { show_alert: true });
    }
  }

  global.depositState[userId].amount = currentAmount;
  const formattedAmount = currentAmount ? parseInt(currentAmount).toLocaleString('id-ID') : '0';
  const newMessage = `💰 *Silakan masukkan jumlah nominal saldo yang Anda ingin tambahkan ke akun Anda:*\n\nJumlah saat ini: *Rp ${formattedAmount}*`;

  try {
    await ctx.editMessageText(newMessage, {
      reply_markup: { inline_keyboard: keyboard_nomor() },
      parse_mode: 'Markdown'
    });
  } catch (error) {
    if (error.description && error.description.includes('message is not modified')) {
      return;
    }
    logger.error('Error updating deposit message:', error);
  }
}

/**
 * Process deposit request with QRIS integration
 * @param {Object} ctx - Telegraf context
 * @param {string} amount - Deposit amount
 */
async function processDeposit(ctx, amount) {
  try {
    const userId = String(ctx.from.id);
    const numAmount = parseInt(amount);

    logger.info(`Processing deposit: ${amount} for user ${userId}`);

    // Validate amount
    if (numAmount < 10000) {
      await ctx.editMessageText(
        '❌ *Jumlah minimal deposit adalah Rp 10.000*',
        {
          parse_mode: 'Markdown',
          reply_markup: {
            inline_keyboard: [
              [{ text: '🔄 Coba Lagi', callback_data: 'topup_saldo' }],
              [{ text: '🔙 Kembali', callback_data: 'send_main_menu' }]
            ]
          }
        }
      );
      clearDepositState(userId);
      return;
    }

    // Generate unique code for this deposit
    const uniqueCode = `${Date.now()}${Math.random().toString(36).substr(2, 9)}`;

    // Generate QRIS payment
    await ctx.editMessageText('⏳ Generating QRIS code...', { parse_mode: 'Markdown' });

    const qrisResult = await generateQRIS(numAmount, userId);

    if (!qrisResult.success || !qrisResult.data) {
      throw new Error(qrisResult.error || 'Failed to generate QRIS');
    }

    const { qr_string, qr_image_url, invoice_id, expired_at, payment_method } = qrisResult.data;
    const paymentMethod = payment_method || 'midtrans';

    // Generate QR image URL if not provided
    let qrImageUrl = qr_image_url;
    let sendAsPhoto = true;

    if (!qrImageUrl) {
      try {
        qrImageUrl = generateQRImageURL(qr_string);
        // Test if we can access the URL (for static QRIS)
        if (paymentMethod === 'static_qris') {
          // For static QRIS, we'll send as photo with the QR string
          // Since external service might be unreliable, we'll handle error on send
          logger.info('Using external QR generator for static QRIS');
        }
      } catch (err) {
        logger.warn('Failed to generate QR image URL, will send as text:', err.message);
        sendAsPhoto = false;
      }
    }

    // Different UI for static QRIS vs Midtrans/Pakasir/Tripay/Duitku
    let caption = '';
    let buttons = [];

    if (paymentMethod === 'static_qris') {
      caption = `
💳 *QRIS Payment - Deposit*

💰 *Nominal:* Rp ${numAmount.toLocaleString('id-ID')}
🆔 *Invoice:* \`${invoice_id}\`
⏰ *Valid:* ${new Date(expired_at).toLocaleString('id-ID')}

📱 *Cara Pembayaran:*
1️⃣ Scan QR code di atas
2️⃣ Masukan Nominal sebesar: *Rp ${numAmount.toLocaleString('id-ID')}*
3️⃣ Lakukan pembayaran
4️⃣ Upload bukti pembayaran
5️⃣ Tunggu verifikasi admin

✅ *Support E-Wallet (Gopay, OVO, ShopeePay, Dana, Dll) dan E-Mbanking (Brimo, Livin, MyBCA, Dll)*

_Status: Menunggu bukti pembayaran..._
      `.trim();

      buttons = [
        [{ text: '📤 Upload Bukti Bayar', callback_data: `upload_proof_${invoice_id}` }],
        [{ text: '🔄 Cek Status', callback_data: `check_payment_${invoice_id}` }],
        [{ text: '❌ Batalkan', callback_data: `cancel_payment_${invoice_id}` }],
        [{ text: '🔙 Menu Utama', callback_data: 'send_main_menu' }]
      ];
    } else if (paymentMethod === 'tripay') {
      const fee = qrisResult.data.fee || 0;
      const totalPayment = qrisResult.data.total_payment || numAmount;

      caption = `
💳 *QRIS Payment - Deposit (Tripay)*

💰 *Nominal:* Rp ${numAmount.toLocaleString('id-ID')}
${fee > 0 ? `💸 *Biaya Layanan:* Rp ${fee.toLocaleString('id-ID')}\n💵 *Total Bayar:* Rp ${totalPayment.toLocaleString('id-ID')}\n` : ''}🆔 *Invoice:* \`${invoice_id}\`
⏰ *Expired:* ${new Date(expired_at).toLocaleString('id-ID')}

📱 Scan QR code di atas menggunakan E-Wallet atau Mobile Banking
⚡ *Otomatis Terverifikasi 1-5 Detik*

_Status: Menunggu pembayaran..._
      `.trim();

      buttons = [
        ...(qrisResult.data.checkout_url ? [[{ text: '🌐 Buka Halaman Bayar', url: qrisResult.data.checkout_url }]] : []),
        [{ text: '🔄 Cek Status', callback_data: `check_payment_${invoice_id}` }],
        [{ text: '❌ Batalkan', callback_data: `cancel_payment_${invoice_id}` }],
        [{ text: '🔙 Menu Utama', callback_data: 'send_main_menu' }]
      ];
    } else if (paymentMethod === 'duitku') {
      caption = `
💳 *QRIS Payment - Deposit (Duitku)*

💰 *Nominal:* Rp ${numAmount.toLocaleString('id-ID')}
🆔 *Invoice:* \`${invoice_id}\`
⏰ *Expired:* ${new Date(expired_at).toLocaleString('id-ID')}

📱 Scan QR code untuk bayar dengan ShopeePay / QRIS
⚡ *Otomatis Terverifikasi*

_Status: Menunggu pembayaran..._
      `.trim();

      buttons = [
        ...(qrisResult.data.checkout_url ? [[{ text: '🌐 Buka Link Pembayaran', url: qrisResult.data.checkout_url }]] : []),
        [{ text: '🔄 Cek Status', callback_data: `check_payment_${invoice_id}` }],
        [{ text: '❌ Batalkan', callback_data: `cancel_payment_${invoice_id}` }],
        [{ text: '🔙 Menu Utama', callback_data: 'send_main_menu' }]
      ];
    } else if (paymentMethod === 'pakasir') {
      // Pakasir payment - auto verification like Midtrans
      const fee = qrisResult.data.fee || 0;
      const totalPayment = qrisResult.data.total_payment || numAmount;
      
      caption = `
💳 *QRIS Payment - Deposit (Pakasir)*

💰 *Amount:* Rp ${numAmount.toLocaleString('id-ID')}
${fee > 0 ? `💸 *Biaya Admin:* Rp ${fee.toLocaleString('id-ID')}\n💵 *Total Bayar:* Rp ${totalPayment.toLocaleString('id-ID')}` : ''}
🆔 *Invoice:* \`${invoice_id}\`
⏰ *Expired:* ${new Date(expired_at).toLocaleString('id-ID')}

📱 Scan QR code untuk melakukan pembayaran
✅ Pembayaran akan otomatis terverifikasi
⚠️ QR Code valid hingga waktu expired

_Status: Menunggu pembayaran..._
      `.trim();

      buttons = [
        [{ text: '🔄 Cek Status', callback_data: `check_payment_${invoice_id}` }],
        [{ text: '❌ Batalkan', callback_data: `cancel_payment_${invoice_id}` }],
        [{ text: '🔙 Menu Utama', callback_data: 'send_main_menu' }]
      ];
    } else {
      // Midtrans payment
      caption = `
💳 *QRIS Payment - Deposit*

💰 *Amount:* Rp ${numAmount.toLocaleString('id-ID')}
🆔 *Invoice:* \`${invoice_id}\`
⏰ *Expired:* ${new Date(expired_at).toLocaleString('id-ID')}

📱 Scan QR code untuk melakukan pembayaran
✅ Pembayaran akan otomatis terverifikasi
⚠️ QR Code valid selama 30 menit

_Status: Menunggu pembayaran..._
      `.trim();

      buttons = [
        [{ text: '🔄 Cek Status', callback_data: `check_payment_${invoice_id}` }],
        [{ text: '❌ Batalkan', callback_data: `cancel_payment_${invoice_id}` }],
        [{ text: '🔙 Menu Utama', callback_data: 'send_main_menu' }]
      ];
    }

    let qrMessage;

    // Try to send as photo first
    if (sendAsPhoto && qrImageUrl) {
      try {
        qrMessage = await ctx.replyWithPhoto(
          { url: qrImageUrl },
          {
            caption: caption,
            parse_mode: 'Markdown',
            reply_markup: {
              inline_keyboard: buttons
            }
          }
        );
      } catch (photoErr) {
        logger.warn('Failed to send QR as photo, falling back to text:', photoErr.message);
        sendAsPhoto = false;
      }
    }

    // Fallback: Send as text if photo failed
    if (!sendAsPhoto || !qrMessage) {
      const textMessage = `${caption}\n\n🔗 *QRIS String:*\n\`${qr_string}\`\n\n_Gunakan aplikasi e-wallet untuk scan QR code_`;

      qrMessage = await ctx.reply(textMessage, {
        parse_mode: 'Markdown',
        reply_markup: {
          inline_keyboard: buttons
        }
      });
    }

    // Save to pending deposits with payment method
    await createPendingDeposit({
      unique_code: invoice_id,
      user_id: userId,
      amount: numAmount,
      original_amount: numAmount,
      timestamp: Date.now(),
      status: 'pending',
      qr_message_id: qrMessage.message_id,
      payment_method: paymentMethod
    });

    // Start auto-check payment status for automatic gateways (Tripay, Duitku, Pakasir, Midtrans)
    if (paymentMethod !== 'static_qris') {
      startPaymentStatusCheck(ctx, invoice_id, userId, numAmount, qrMessage.message_id, paymentMethod);
    } else {
      logger.info(`Static QRIS deposit created: ${invoice_id}, awaiting manual upload`);
    }

    // Delete the "Generating..." message
    try {
      await ctx.deleteMessage();
    } catch (err) {
      logger.warn('Could not delete generating message');
    }

    // Clean up deposit state
    clearDepositState(userId);

    logger.info(`Deposit request created: ${invoice_id} for user ${userId}`);
  } catch (error: any) {
    const userId = String(ctx.from?.id || 'unknown');
    logger.error('Error processing deposit:', error);

    try {
      await ctx.reply('❌ *Gagal memproses deposit. Silakan coba lagi.*', {
        parse_mode: 'Markdown',
        reply_markup: {
          inline_keyboard: [
            [{ text: '🔄 Coba Lagi', callback_data: 'topup_saldo' }],
            [{ text: '🔙 Kembali', callback_data: 'send_main_menu' }]
          ]
        }
      });
    } catch (replyError) {
      logger.error('Error sending error message:', replyError);
    }

    clearDepositState(userId);
  }
}

/**
 * Start auto-checking payment status
 * @param {Object} ctx - Telegraf context
 * @param {string} invoiceId - Invoice ID
 * @param {string} userId - User ID
 * @param {number} amount - Payment amount
 * @param {number} messageId - QR message ID
 */
async function startPaymentStatusCheck(ctx, invoiceId, userId, amount, messageId, paymentMethod) {
  const maxAttempts = 180; // 30 minutes (180 * 10 seconds)
  let attempts = 0;

  const checkInterval = setInterval(async () => {
    attempts++;

    try {
      // Check if deposit still exists and pending
      const deposit = await getPendingDeposit(invoiceId);

      if (!deposit || deposit.status !== 'pending') {
        clearInterval(checkInterval);
        return;
      }

      // Check payment status (pass payment method)
      const statusResult = await checkPaymentStatus(invoiceId, paymentMethod);

      if (statusResult.success && statusResult.status === 'paid') {
        // Payment successful
        clearInterval(checkInterval);
        await handleSuccessfulPayment(ctx, invoiceId, userId, amount, messageId);
      } else if (attempts >= maxAttempts || statusResult.status === 'expired') {
        // Payment expired
        clearInterval(checkInterval);
        await handleExpiredPayment(ctx, invoiceId, userId, messageId);
      }
    } catch (error) {
      logger.error(`Error checking payment status for ${invoiceId}:`, error);

      if (attempts >= maxAttempts) {
        clearInterval(checkInterval);
      }
    }
  }, 10000); // Check every 10 seconds
}

/**
 * Handle successful payment
 * @param {Object} ctx - Telegraf context
 * @param {string} invoiceId - Invoice ID
 * @param {string} userId - User ID
 * @param {number} amount - Payment amount
 * @param {number} messageId - QR message ID
 */
async function handleSuccessfulPayment(ctx, invoiceId, userId, amount, messageId) {
  try {
    logger.info(`Payment successful: ${invoiceId} for user ${userId}`);

    // Update deposit status
    await updateDepositStatus(invoiceId, 'paid');

    // Get current user
    const user = await getUserById(userId);

    if (!user) {
      throw new Error('User not found');
    }

    // Update user saldo
    const newSaldo = user.saldo + amount;
    await updateUserSaldo(userId, newSaldo);

    // Update QR message
    try {
      await ctx.telegram.editMessageCaption(
        ctx.chat.id,
        messageId,
        undefined,
        `
✅ *PEMBAYARAN BERHASIL!*

💰 *Amount:* Rp ${amount.toLocaleString('id-ID')}
🆔 *Invoice:* \`${invoiceId}\`
✅ *Status:* Paid
💳 *Saldo Baru:* Rp ${newSaldo.toLocaleString('id-ID')}

Terima kasih! Saldo Anda telah ditambahkan.
        `.trim(),
        {
          parse_mode: 'Markdown',
          reply_markup: {
            inline_keyboard: [
              [{ text: '💰 Cek Saldo', callback_data: 'cek_saldo' }],
              [{ text: '🔙 Menu Utama', callback_data: 'send_main_menu' }]
            ]
          }
        }
      );
    } catch (err) {
      logger.warn('Could not update QR message:', err.message);
    }

    // Send success notification
    await ctx.telegram.sendMessage(
      userId,
      `🎉 *Deposit Berhasil!*\n\n` +
      `💰 Saldo Anda telah ditambah Rp ${amount.toLocaleString('id-ID')}\n` +
      `💳 Saldo sekarang: Rp ${newSaldo.toLocaleString('id-ID')}`,
      { parse_mode: 'Markdown' }
    );

    // Notify admin group if configured
    if (config.GROUP_ID) {
      await ctx.telegram.sendMessage(
        config.GROUP_ID,
        `💰 *Deposit Notification*\n\n` +
        `👤 User: ${userId}\n` +
        `💵 Amount: Rp ${amount.toLocaleString('id-ID')}\n` +
        `🆔 Invoice: ${invoiceId}\n` +
        `✅ Status: Success`,
        { parse_mode: 'Markdown' }
      );
    }

    logger.info(`User ${userId} saldo updated: ${user.saldo} -> ${newSaldo}`);
  } catch (error) {
    logger.error('Error handling successful payment:', error);
  }
}

/**
 * Handle expired payment
 * @param {Object} ctx - Telegraf context
 * @param {string} invoiceId - Invoice ID
 * @param {string} userId - User ID
 * @param {number} messageId - QR message ID
 */
async function handleExpiredPayment(ctx, invoiceId, userId, messageId) {
  try {
    logger.info(`Payment expired: ${invoiceId} for user ${userId}`);

    // Update deposit status
    await updateDepositStatus(invoiceId, 'expired');

    // Update QR message
    try {
      await ctx.telegram.editMessageCaption(
        ctx.chat.id,
        messageId,
        undefined,
        `
❌ *PEMBAYARAN EXPIRED*

🆔 *Invoice:* \`${invoiceId}\`
⏰ *Status:* Expired

QR code sudah tidak valid. Silakan buat deposit baru.
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
    } catch (err) {
      logger.warn('Could not update QR message:', err.message);
    }
  } catch (error) {
    logger.error('Error handling expired payment:', error);
  }
}

/**
 * Initialize deposit state
 * @param {string} userId - User ID
 */
function initializeDepositState(userId) {
  if (!global.depositState) {
    global.depositState = {};
  }

  global.depositState[userId] = {
    action: 'request_amount',
    amount: ''
  };
}

/**
 * Clear deposit state for user
 * @param {string} userId - User ID
 */
function clearDepositState(userId) {
  if (global.depositState && global.depositState[userId]) {
    delete global.depositState[userId];
  }
}

/**
 * Get deposit state for user
 * @param {string} userId - User ID
 * @returns {Object|null} Deposit state object or null
 */
function getDepositState(userId) {
  return global.depositState?.[userId] || null;
}

module.exports = {
  handleDepositState,
  processDeposit,
  handleSuccessfulPayment,
  handleExpiredPayment,
  startPaymentStatusCheck,
  initializeDepositState,
  clearDepositState,
  getDepositState
};
