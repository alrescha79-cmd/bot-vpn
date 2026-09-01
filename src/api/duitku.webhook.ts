/**
 * @fileoverview Duitku Webhook Handler
 * Handles instant payment notifications from Duitku
 */

import { Request, Response } from 'express';
import { verifyDuitkuCallbackSignature } from '../services/duitku.service';

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
 * Handle Duitku webhook callback
 */
export async function handleDuitkuNotification(req: Request, res: Response, bot: any) {
  try {
    const {
      merchantCode,
      amount,
      merchantOrderId,
      signature,
      resultCode
    } = req.body;

    logger.info('Received Duitku callback:', {
      merchantOrderId,
      amount,
      resultCode
    });

    if (!merchantCode || !merchantOrderId || !signature) {
      logger.warn('Duitku callback missing required parameters');
      return res.status(400).send('BAD REQUEST');
    }

    const isValid = verifyDuitkuCallbackSignature(merchantCode, amount, merchantOrderId, signature);
    if (!isValid) {
      logger.error('Duitku callback: Invalid signature!');
      return res.status(403).send('BAD SIGNATURE');
    }

    const deposit = await getPendingDeposit(merchantOrderId);
    if (!deposit) {
      logger.warn(`Duitku callback: Deposit not found for ${merchantOrderId}`);
      return res.status(404).send('NOT FOUND');
    }

    if (deposit.status !== 'pending') {
      return res.status(200).send('SUCCESS');
    }

    // resultCode "00" = SUCCESS
    if (resultCode === '00') {
      const userId = deposit.user_id;
      const depositAmount = deposit.amount || deposit.original_amount || Number(amount);

      await updateDepositStatus(merchantOrderId, 'paid');
      const user = await getUserById(userId);

      if (user) {
        const newSaldo = user.saldo + depositAmount;
        await updateUserSaldo(userId, newSaldo);

        if (deposit.qr_message_id && bot) {
          try {
            await bot.telegram.editMessageCaption(
              userId,
              deposit.qr_message_id,
              undefined,
              `
✅ *PEMBAYARAN BERHASIL!*

💰 *Nominal:* Rp ${depositAmount.toLocaleString('id-ID')}
🆔 *Invoice:* \`${merchantOrderId}\`
⚡ *Gateway:* Duitku
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
            logger.warn('Failed to update Telegram message for Duitku payment:', e.message);
          }
        }

        if (bot) {
          await bot.telegram.sendMessage(
            userId,
            `🎉 *Deposit Berhasil!*\n\n` +
            `💰 Saldo Anda telah ditambah Rp ${depositAmount.toLocaleString('id-ID')}\n` +
            `💳 Saldo sekarang: Rp ${newSaldo.toLocaleString('id-ID')}\n\n` +
            `_Verified via Duitku Webhook_`,
            { parse_mode: 'Markdown' }
          );

          if (config.GROUP_ID) {
            await bot.telegram.sendMessage(
              config.GROUP_ID,
              `💰 *Deposit Notification (Duitku)*\n\n` +
              `👤 User: ${userId}\n` +
              `💵 Nominal: Rp ${depositAmount.toLocaleString('id-ID')}\n` +
              `🆔 Invoice: ${merchantOrderId}\n` +
              `✅ Status: Success`,
              { parse_mode: 'Markdown' }
            );
          }
        }
      }

      return res.status(200).send('SUCCESS');
    } else {
      await updateDepositStatus(merchantOrderId, 'failed');
      return res.status(200).send('SUCCESS');
    }
  } catch (error: any) {
    logger.error('Error handling Duitku callback:', error);
    return res.status(500).send('INTERNAL ERROR');
  }
}

module.exports = {
  handleDuitkuNotification
};
