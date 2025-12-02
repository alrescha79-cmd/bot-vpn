/**
 * @fileoverview Pakasir Webhook Handler
 * Handles payment notification from Pakasir
 * 
 * This enables instant payment verification instead of polling
 * 
 * Webhook payload from Pakasir:
 * {
 *   "amount": 22000,
 *   "order_id": "240910HDE7C9",
 *   "project": "depodomain",
 *   "status": "completed",
 *   "payment_method": "qris",
 *   "completed_at": "2024-09-10T08:07:02.819+07:00"
 * }
 */

// Use require for CommonJS modules  
const logger = require('../utils/logger');
const { getPendingDeposit, updateDepositStatus } = require('../repositories/depositRepository');
const { getUserById, updateUserSaldo } = require('../repositories/userRepository');

// Import config properly
let config: any;
try {
  config = require('../config').default || require('../config');
} catch (e) {
  config = require('../config');
}

// Mark as module
export {};

interface PakasirWebhookPayload {
  amount: number;
  order_id: string;
  project: string;
  status: 'pending' | 'completed' | 'expired' | 'cancelled' | 'failed';
  payment_method: string;
  completed_at?: string;
}

/**
 * Verify Pakasir webhook authenticity
 * Since Pakasir doesn't provide signature verification like Midtrans,
 * we verify by checking project slug and order_id existence
 * 
 * @param payload - Webhook payload
 * @returns true if payload is valid
 */
function verifyPakasirWebhook(payload: PakasirWebhookPayload): boolean {
  // Verify project matches our configured project
  if (payload.project !== config.PAKASIR_PROJECT) {
    logger.warn(`Invalid Pakasir webhook: project mismatch (received: ${payload.project}, expected: ${config.PAKASIR_PROJECT})`);
    return false;
  }

  // Basic validation
  if (!payload.order_id || !payload.amount || !payload.status) {
    logger.warn('Invalid Pakasir webhook: missing required fields');
    return false;
  }

  return true;
}

/**
 * Handle Pakasir payment notification webhook
 * @param req - Express request
 * @param res - Express response
 * @param bot - Telegraf bot instance
 */
async function handlePakasirNotification(req: any, res: any, bot: any) {
  try {
    const payload: PakasirWebhookPayload = req.body;

    logger.info('Received Pakasir notification:', {
      order_id: payload.order_id,
      status: payload.status,
      amount: payload.amount,
      payment_method: payload.payment_method
    });

    // Verify webhook
    if (!verifyPakasirWebhook(payload)) {
      logger.error('Invalid Pakasir webhook payload!');
      return res.status(403).json({
        success: false,
        message: 'Invalid webhook payload'
      });
    }

    const orderId = payload.order_id;
    const status = payload.status;
    const amount = payload.amount;

    // Get pending deposit
    const deposit = await getPendingDeposit(orderId);

    if (!deposit) {
      logger.warn(`Deposit not found for order: ${orderId}`);
      return res.status(404).json({
        success: false,
        message: 'Deposit not found'
      });
    }

    // Verify amount matches
    if (deposit.amount !== amount && deposit.original_amount !== amount) {
      logger.warn(`Amount mismatch for order ${orderId}: expected ${deposit.amount}, received ${amount}`);
      // Still process but log warning - Pakasir might add fees
    }

    // Check if already processed
    if (deposit.status !== 'pending') {
      logger.info(`Deposit already processed: ${orderId} (status: ${deposit.status})`);
      return res.status(200).json({
        success: true,
        message: 'Already processed'
      });
    }

    // Process based on status
    if (status === 'completed') {
      // Payment success
      await handleSuccessfulPakasirPayment(bot, deposit, orderId, amount, payload);

      return res.status(200).json({
        success: true,
        message: 'Payment processed successfully'
      });
    } else if (status === 'pending') {
      // Still pending
      logger.info(`Payment still pending: ${orderId}`);

      return res.status(200).json({
        success: true,
        message: 'Payment pending'
      });
    } else if (status === 'expired' || status === 'cancelled' || status === 'failed') {
      // Payment failed/cancelled/expired
      await updateDepositStatus(orderId, status === 'expired' ? 'expired' : 'failed');

      // Notify user
      await notifyPakasirPaymentFailed(bot, deposit, status);

      return res.status(200).json({
        success: true,
        message: `Payment ${status}`
      });
    }

    // Unknown status
    logger.warn(`Unknown Pakasir status: ${status}`);
    return res.status(200).json({
      success: true,
      message: 'Notification received'
    });

  } catch (error: any) {
    logger.error('Error handling Pakasir notification:', error);
    return res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
}

/**
 * Handle successful Pakasir payment via webhook
 */
async function handleSuccessfulPakasirPayment(
  bot: any, 
  deposit: any, 
  orderId: string, 
  amount: number,
  payload: PakasirWebhookPayload
) {
  try {
    const userId = deposit.user_id;

    logger.info(`Pakasir payment successful (webhook): ${orderId} for user ${userId}`);

    // Update deposit status
    await updateDepositStatus(orderId, 'paid');

    // Get current user
    const user = await getUserById(userId);

    if (!user) {
      throw new Error('User not found');
    }

    // Use original deposit amount (not the amount from webhook which might include fee)
    const depositAmount = deposit.amount || deposit.original_amount || amount;
    
    // Update user saldo
    const newSaldo = user.saldo + depositAmount;
    await updateUserSaldo(userId, newSaldo);

    // Update QR message if exists
    if (deposit.qr_message_id) {
      try {
        await bot.telegram.editMessageCaption(
          userId,
          deposit.qr_message_id,
          undefined,
          `
✅ *PEMBAYARAN BERHASIL!*

💰 *Amount:* Rp ${depositAmount.toLocaleString('id-ID')}
🆔 *Order ID:* \`${orderId}\`
✅ *Status:* Paid (via Pakasir)
💳 *Saldo Baru:* Rp ${newSaldo.toLocaleString('id-ID')}
💳 *Metode:* ${payload.payment_method?.toUpperCase() || 'QRIS'}

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
      } catch (err: any) {
        logger.warn('Could not update QR message:', err.message);
      }
    }

    // Send success notification
    await bot.telegram.sendMessage(
      userId,
      `🎉 *Deposit Berhasil!*\n\n` +
      `💰 Saldo Anda telah ditambah Rp ${depositAmount.toLocaleString('id-ID')}\n` +
      `💳 Saldo sekarang: Rp ${newSaldo.toLocaleString('id-ID')}\n` +
      `💳 Metode: ${payload.payment_method?.toUpperCase() || 'QRIS'}\n\n` +
      `_Verified via Pakasir Webhook_`,
      { parse_mode: 'Markdown' }
    );

    // Notify admin group if configured
    if (config.GROUP_ID) {
      await bot.telegram.sendMessage(
        config.GROUP_ID,
        `💰 *Deposit Notification (Pakasir)*\n\n` +
        `👤 User: ${userId}\n` +
        `💵 Amount: Rp ${depositAmount.toLocaleString('id-ID')}\n` +
        `🆔 Order: ${orderId}\n` +
        `💳 Method: ${payload.payment_method?.toUpperCase() || 'QRIS'}\n` +
        `✅ Status: Success\n` +
        `🔔 Source: Pakasir Webhook`,
        { parse_mode: 'Markdown' }
      );
    }

    logger.info(`User ${userId} saldo updated: ${user.saldo} -> ${newSaldo} (Pakasir webhook)`);
  } catch (error) {
    logger.error('Error handling successful Pakasir payment (webhook):', error);
  }
}

/**
 * Notify user about failed Pakasir payment
 */
async function notifyPakasirPaymentFailed(bot: any, deposit: any, status: string) {
  try {
    const userId = deposit.user_id;

    const statusMessage = status === 'expired' ? 'EXPIRED' : 'GAGAL';
    const statusEmoji = status === 'expired' ? '⏰' : '❌';

    if (deposit.qr_message_id) {
      try {
        await bot.telegram.editMessageCaption(
          userId,
          deposit.qr_message_id,
          undefined,
          `
${statusEmoji} *PEMBAYARAN ${statusMessage}*

🆔 *Order ID:* \`${deposit.unique_code}\`
💰 *Amount:* Rp ${deposit.amount.toLocaleString('id-ID')}
${statusEmoji} *Status:* ${statusMessage}

${status === 'expired'
            ? 'QR code sudah tidak valid. Silakan buat deposit baru.'
            : 'Pembayaran gagal atau dibatalkan.'
          }
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
      } catch (err: any) {
        // Message might have been deleted or is too old
        logger.warn('Could not update QR message:', err.message);
      }
    }

    // Send notification message
    await bot.telegram.sendMessage(
      userId,
      `${statusEmoji} *Pembayaran ${statusMessage}*\n\n` +
      `🆔 Order: \`${deposit.unique_code}\`\n` +
      `💰 Amount: Rp ${deposit.amount.toLocaleString('id-ID')}\n\n` +
      `${status === 'expired' 
        ? 'QR code sudah tidak valid. Silakan buat deposit baru.' 
        : 'Pembayaran gagal atau dibatalkan.'}`,
      { parse_mode: 'Markdown' }
    );
  } catch (error: any) {
    logger.error('Error notifying Pakasir payment failed:', error);
  }
}

module.exports = {
  handlePakasirNotification,
  verifyPakasirWebhook,
  handleSuccessfulPakasirPayment,
  notifyPakasirPaymentFailed
};
