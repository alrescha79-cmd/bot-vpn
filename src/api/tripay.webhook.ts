/**
 * @fileoverview Tripay Webhook Handler
 * Handles instant payment notifications from Tripay
 */

import { Request, Response } from 'express';
import { verifyTripayWebhookSignature } from '../services/tripay.service';

const logger = require('../utils/logger');
const { getPendingDeposit, updateDepositStatus } = require('../repositories/depositRepository');
const { getUserById, updateUserSaldo } = require('../repositories/userRepository');

let config: any;
try {
  config = require('../config').default || require('../config');
} catch (e) {
  config = require('../config');
}

/**
 * Handle Tripay webhook callback
 */
export async function handleTripayNotification(req: Request, res: Response, bot: any) {
  try {
    const callbackSignature = req.headers['x-callback-signature'] as string;
    const event = req.headers['x-callback-event'] as string;

    if (!callbackSignature) {
      logger.warn('Tripay webhook: Missing X-Callback-Signature header');
      return res.status(400).json({ success: false, message: 'Missing signature' });
    }

    const rawBody = JSON.stringify(req.body);
    const isValid = verifyTripayWebhookSignature(rawBody, callbackSignature);

    if (!isValid) {
      logger.error('Tripay webhook: Invalid HMAC signature!');
      return res.status(403).json({ success: false, message: 'Invalid signature' });
    }

    const payload = req.body;
    logger.info(`Received Tripay webhook event [${event}]:`, {
      reference: payload.reference,
      merchant_ref: payload.merchant_ref,
      status: payload.status,
      total_amount: payload.total_amount
    });

    if (event !== 'payment_status') {
      return res.status(200).json({ success: true, message: 'Unprocessed event acknowledged' });
    }

    const orderId = payload.merchant_ref;
    const deposit = await getPendingDeposit(orderId);

    if (!deposit) {
      logger.warn(`Tripay webhook: Deposit not found for ${orderId}`);
      return res.status(404).json({ success: false, message: 'Deposit not found' });
    }

    if (deposit.status !== 'pending') {
      return res.status(200).json({ success: true, message: 'Already processed' });
    }

    if (payload.status === 'PAID') {
      const userId = deposit.user_id;
      const depositAmount = deposit.amount || deposit.original_amount || payload.total_amount;

      await updateDepositStatus(orderId, 'paid');
      const user = await getUserById(userId);

      if (user) {
        const newSaldo = user.saldo + depositAmount;
        await updateUserSaldo(userId, newSaldo);

        // Update message in chat if message_id exists
        if (deposit.qr_message_id && bot) {
          try {
            await bot.telegram.editMessageCaption(
              userId,
              deposit.qr_message_id,
              undefined,
              `
✅ *PEMBAYARAN BERHASIL!*

💰 *Nominal:* Rp ${depositAmount.toLocaleString('id-ID')}
🆔 *Invoice:* \`${orderId}\`
⚡ *Gateway:* Tripay (${payload.payment_method || 'QRIS'})
💳 *Saldo Baru:* Rp ${newSaldo.toLocaleString('id-ID')}

Terima kasih! Saldo Anda telah otomatis bertambah.
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
          } catch (e: any) {
            logger.warn('Failed to update Telegram message for Tripay payment:', e.message);
          }
        }

        // Notify user
        if (bot) {
          await bot.telegram.sendMessage(
            userId,
            `🎉 *Deposit Berhasil!*\n\n` +
            `💰 Saldo Anda telah ditambah Rp ${depositAmount.toLocaleString('id-ID')}\n` +
            `💳 Saldo sekarang: Rp ${newSaldo.toLocaleString('id-ID')}\n` +
            `💳 Metode: ${payload.payment_method || 'Tripay QRIS'}\n\n` +
            `_Verified via Tripay Webhook_`,
            { parse_mode: 'Markdown' }
          );

          if (config.GROUP_ID) {
            await bot.telegram.sendMessage(
              config.GROUP_ID,
              `💰 *Deposit Notification (Tripay)*\n\n` +
              `👤 User: ${userId}\n` +
              `💵 Nominal: Rp ${depositAmount.toLocaleString('id-ID')}\n` +
              `🆔 Invoice: ${orderId}\n` +
              `✅ Status: Success`,
              { parse_mode: 'Markdown' }
            );
          }
        }
      }

      return res.status(200).json({ success: true });
    } else if (payload.status === 'EXPIRED' || payload.status === 'FAILED') {
      await updateDepositStatus(orderId, payload.status === 'EXPIRED' ? 'expired' : 'failed');
      return res.status(200).json({ success: true });
    }

    return res.status(200).json({ success: true, message: 'Status pending acknowledged' });
  } catch (error: any) {
    logger.error('Error handling Tripay notification:', error);
    return res.status(500).json({ success: false, message: 'Internal server error' });
  }
}

module.exports = {
  handleTripayNotification
};
