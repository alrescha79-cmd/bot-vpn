
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

/**
 * Handle deposit state for numeric keyboard input
 * @param {Object} ctx - Telegraf context
 * @param {string} userId - User ID
 * @param {string} data - Button data (number, 'delete', or 'confirm')
 */
async function handleDepositState(ctx, userId, data) {
  let currentAmount = global.depositState[userId].amount;

  if (data === 'delete') {
    currentAmount = currentAmount.slice(0, -1);
  } else if (data === 'confirm') {
    if (currentAmount.length === 0) {
      return await ctx.answerCbQuery('⚠️ Jumlah tidak boleh kosong!', { show_alert: true });
    }
    if (parseInt(currentAmount) < 5000) {
      return await ctx.answerCbQuery('⚠️ Jumlah minimal top-up adalah 5000 Ya Kawan...!!!', { show_alert: true });
    }
    global.depositState[userId].action = 'confirm_amount';
    await processDeposit(ctx, currentAmount);
    return;
  } else {
    if (currentAmount.length < 12) {
      currentAmount += data;
    } else {
      return await ctx.answerCbQuery('⚠️ Jumlah maksimal adalah 12 digit!', { show_alert: true });
    }
  }

  global.depositState[userId].amount = currentAmount;
  const newMessage = `💰 *Silakan masukkan jumlah nominal saldo yang Anda ingin tambahkan ke akun Anda:*\n\nJumlah saat ini: *Rp ${currentAmount}*`;
  
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
 * Process deposit request (placeholder - needs QRIS integration)
 * @param {Object} ctx - Telegraf context
 * @param {string} amount - Deposit amount
 */
async function processDeposit(ctx, amount) {
  try {
    logger.info(`Processing deposit: ${amount} for user ${ctx.from.id}`);
    
    // TODO: Integrate with QRIS payment system
    // This is a placeholder for QRIS payment generation
    
    await ctx.reply(
      `✅ *Deposit Request Created*\n\n` +
      `💰 Amount: Rp ${parseInt(amount).toLocaleString('id-ID')}\n` +
      `📋 Status: Pending\n\n` +
      `⏳ Please wait for payment processing...`,
      { parse_mode: 'Markdown' }
    );

    // Clean up deposit state
    delete global.depositState[ctx.from.id];
  } catch (error) {
    logger.error('Error processing deposit:', error);
    await ctx.reply('❌ *Gagal memproses deposit. Silakan coba lagi.*', { parse_mode: 'Markdown' });
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
  initializeDepositState,
  clearDepositState,
  getDepositState
};
