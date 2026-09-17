import type { BotContext } from "../types";
/**
 * @fileoverview Midtrans Webhook Handler
 * Handles payment notification from Midtrans
 * 
 * This enables instant payment verification instead of polling
 */

const crypto = require('crypto');
const logger = require('../utils/logger');
const { getPendingDeposit, updateDepositStatus } = require('../repositories/depositRepository');

// Import config properly
let config: any;
try {
  config = require('../config').default || require('../config');
} catch (e) {
  config = require('../config');
}

interface MidtransNotification {
  transaction_time: string;
  transaction_status: string;
  transaction_id: string;
  status_message: string;
  status_code: string;
  signature_key: string;
  payment_type: string;
  order_id: string;
  merchant_id: string;
  gross_amount: string;
  fraud_status: string;
  currency: string;
}

/**
 * Verify Midtrans signature
 * @param notification - Notification data from Midtrans
 * @returns true if signature is valid
 */
function verifySignature(notification: MidtransNotification): boolean {
  const { order_id, status_code, gross_amount, signature_key } = notification;
  const serverKey = config.SERVER_KEY;
  if (!serverKey || !config.MERCHANT_ID) return false;

  // Create signature string
  const signatureString = `${order_id}${status_code}${gross_amount}${serverKey}`;

  // Hash with SHA512
  const hash = crypto.createHash('sha512').update(signatureString).digest('hex');

  return hash === signature_key;
}

/**
 * Handle Midtrans payment notification
 * @param req - Express request
 * @param res - Express response
 * @param bot - Telegraf bot instance
 */
async function handleMidtransNotification(req: any, res: any, bot: any) {
  try {
    const notification: MidtransNotification = req.body;

    logger.info('Received Midtrans notification:', {
      order_id: notification.order_id,
      transaction_status: notification.transaction_status,
      fraud_status: notification.fraud_status
    });

    // Verify signature
    if (!verifySignature(notification)) {
      logger.error('Invalid Midtrans signature!');
      return res.status(403).json({
        success: false,
        message: 'Invalid signature'
      });
    }

    const orderId = notification.order_id;
    const transactionStatus = notification.transaction_status;
    const fraudStatus = notification.fraud_status;
    const grossAmount = parseInt(notification.gross_amount);

    // Get pending deposit
    const deposit = await getPendingDeposit(orderId);

    if (!deposit) {
      logger.warn(`Deposit not found for order: ${orderId}`);
      return res.status(404).json({
        success: false,
        message: 'Deposit not found'
      });
    }

    if (deposit.payment_method !== 'midtrans' || Number(notification.gross_amount) !== Number(deposit.amount)) {
      return res.status(400).json({ success: false, message: 'Deposit mismatch' });
    }

    // Check if already processed
    if (deposit.status !== 'pending') {
      logger.info(`Deposit already processed: ${orderId} (status: ${deposit.status})`);
      return res.status(200).json({
        success: true,
        message: 'Already processed'
      });
    }

    // Process based on transaction status
    if (transactionStatus === 'capture' || transactionStatus === 'settlement') {
      if (fraudStatus === 'accept') {
        // Payment success
        await handleSuccessfulPayment(bot, deposit, orderId, grossAmount);

        return res.status(200).json({
          success: true,
          message: 'Payment processed successfully'
        });
      }
    } else if (transactionStatus === 'pending') {
      // Still pending
      logger.info(`Payment still pending: ${orderId}`);

      return res.status(200).json({
        success: true,
        message: 'Payment pending'
      });
    } else if (transactionStatus === 'deny' || transactionStatus === 'cancel' || transactionStatus === 'expire') {
      // Payment failed/cancelled/expired
      await updateDepositStatus(orderId, transactionStatus === 'expire' ? 'expired' : 'failed');

      // Notify user
      await notifyPaymentFailed(bot, deposit, transactionStatus);

      return res.status(200).json({
        success: true,
        message: `Payment ${transactionStatus}`
      });
    }

    // Unknown status
    logger.warn(`Unknown transaction status: ${transactionStatus}`);
    return res.status(200).json({
      success: true,
      message: 'Notification received'
    });

  } catch (error: any) {
    logger.error('Error handling Midtrans notification:', error);
    return res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
}

/**
 * Handle successful payment via webhook
 */
async function handleSuccessfulPayment(bot: any, deposit: any, orderId: string, amount: number) {
  try {
    const userId = deposit.user_id;

    logger.info(`Payment successful (webhook): ${orderId} for user ${userId}`);

    const { settleDeposit } = require('../repositories/depositRepository');
    const settlement = await settleDeposit(orderId);
    if (!settlement) return;
    const { user, newSaldo } = settlement;
    amount = settlement.amount;

    // Update QR message if exists
    if (deposit.qr_message_id) {
      try {
        await bot.telegram.editMessageCaption(
          userId,
          deposit.qr_message_id,
          undefined,
          `
✅ *PEMBAYARAN BERHASIL!*

💰 *Amount:* Rp ${amount.toLocaleString('id-ID')}
🆔 *Order ID:* \`${orderId}\`
✅ *Status:* Paid (via Midtrans)
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
      } catch (err: any) {
        logger.warn('Could not update QR message:', err.message);
      }
    }

    // Send success notification
    await bot.telegram.sendMessage(
      userId,
      `🎉 *Deposit Berhasil!*\n\n` +
      `💰 Saldo Anda telah ditambah Rp ${amount.toLocaleString('id-ID')}\n` +
      `💳 Saldo sekarang: Rp ${newSaldo.toLocaleString('id-ID')}\n\n` +
      `_Verified via Midtrans Webhook_`,
      { parse_mode: 'Markdown' }
    );

    // Notify admin group if configured
    if (config.GROUP_ID) {
      await bot.telegram.sendMessage(
        config.GROUP_ID,
        `💰 *Deposit Notification (Webhook)*\n\n` +
        `👤 User: ${userId}\n` +
        `💵 Amount: Rp ${amount.toLocaleString('id-ID')}\n` +
        `🆔 Order: ${orderId}\n` +
        `✅ Status: Success\n` +
        `🔔 Source: Midtrans Webhook`,
        { parse_mode: 'Markdown' }
      );
    }

    logger.info(`User ${userId} saldo updated: ${user.saldo} -> ${newSaldo} (webhook)`);
  } catch (error) {
    logger.error('Error handling successful payment (webhook):', error);
  }
}

/**
 * Notify user about failed payment
 */
async function notifyPaymentFailed(bot: any, deposit: any, status: string) {
  try {
    const userId = deposit.user_id;

    const statusMessage = status === 'expire' ? 'EXPIRED' : 'GAGAL';
    const statusEmoji = status === 'expire' ? '⏰' : '❌';

    if (deposit.qr_message_id) {
      await bot.telegram.editMessageCaption(
        userId,
        deposit.qr_message_id,
        undefined,
        `
${statusEmoji} *PEMBAYARAN ${statusMessage}*

🆔 *Order ID:* \`${deposit.unique_code}\`
💰 *Amount:* Rp ${deposit.amount.toLocaleString('id-ID')}
${statusEmoji} *Status:* ${statusMessage}

${status === 'expire'
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
    }
  } catch (error: any) {
    logger.error('Error notifying payment failed:', error);
  }
}

module.exports = {
  handleMidtransNotification,
  verifySignature
};
