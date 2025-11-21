
import type { BotContext, DatabaseUser, DatabaseServer } from "../types";
/**
 * Transaction Repository
 * Handles transaction and invoice-related database operations
 * @module repositories/transactionRepository
 */

const { dbGet, dbAll, dbRun } = require('../infrastructure/database');
const logger = require('../utils/logger');

/**
 * Create invoice log
 * @param {Object} invoiceData
 * @returns {Promise<Object>}
 */
async function createInvoice(invoiceData) {
  const { user_id, username, layanan, akun, hari, harga, komisi } = invoiceData;
  
  try {
    return await dbRun(`
      INSERT INTO invoice_log (user_id, username, layanan, akun, hari, harga, komisi, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, datetime('now'))
    `, [user_id, username, layanan, akun, hari, harga, komisi || 0]);
  } catch (err) {
    logger.error('❌ Error creating invoice:', err.message);
    throw err;
  }
}

/**
 * Get last invoice
 * @param {number} userId
 * @returns {Promise<Object|null>}
 */
async function getLastInvoice(userId) {
  try {
    return await dbGet(`
      SELECT * FROM invoice_log
      WHERE user_id = ?
      ORDER BY created_at DESC
      LIMIT 1
    `, [userId]);
  } catch (err) {
    logger.error('❌ Error getting last invoice:', err.message);
    throw err;
  }
}

/**
 * Get last invoice by username
 * @param {string} username
 * @returns {Promise<Object|null>}
 */
async function getLastInvoiceByUsername(username) {
  try {
    return await dbGet(`
      SELECT * FROM invoice_log
      WHERE username = ?
      ORDER BY created_at DESC
      LIMIT 1
    `, [username]);
  } catch (err) {
    logger.error('❌ Error getting invoice by username:', err.message);
    throw err;
  }
}

/**
 * Create transaction record
 * @param {Object} transactionData
 * @returns {Promise<Object>}
 */
async function createTransaction(transactionData) {
  const { user_id, type, username } = transactionData;
  
  try {
    return await dbRun(`
      INSERT INTO transactions (user_id, type, username, created_at)
      VALUES (?, ?, ?, datetime('now'))
    `, [user_id, type, username]);
  } catch (err) {
    logger.error('❌ Error creating transaction:', err.message);
    throw err;
  }
}

/**
 * Get all transactions
 * @returns {Promise<Array>}
 */
async function getAllTransactions() {
  try {
    return await dbAll('SELECT * FROM transactions ORDER BY created_at DESC');
  } catch (err) {
    logger.error('❌ Error getting transactions:', err.message);
    throw err;
  }
}

/**
 * Create topup log
 * @param {Object} topupData
 * @returns {Promise<Object>}
 */
async function createTopupLog(topupData) {
  const { user_id, username, amount, reference, created_at } = topupData;
  
  try {
    return await dbRun(`
      INSERT INTO topup_log (user_id, username, amount, reference, created_at)
      VALUES (?, ?, ?, ?, ?)
    `, [user_id, username, amount, reference, created_at]);
  } catch (err) {
    logger.error('❌ Error creating topup log:', err.message);
    throw err;
  }
}

/**
 * Get topup logs
 * @param {number} limit
 * @returns {Promise<Array>}
 */
async function getTopupLogs(limit = 20) {
  try {
    return await dbAll(`
      SELECT * FROM topup_log
      ORDER BY datetime(created_at) DESC
      LIMIT ?
    `, [limit]);
  } catch (err) {
    logger.error('❌ Error getting topup logs:', err.message);
    throw err;
  }
}

/**
 * Create saldo transfer
 * @param {Object} transferData
 * @returns {Promise<Object>}
 */
async function createSaldoTransfer(transferData) {
  const { from_id, to_id, amount } = transferData;
  
  try {
    // Insert into both tables for compatibility
    await dbRun(`
      INSERT INTO saldo_transfers (from_id, to_id, amount, created_at)
      VALUES (?, ?, ?, datetime('now'))
    `, [from_id, to_id, amount]);
    
    return await dbRun(`
      INSERT INTO transfer_log (from_id, to_id, jumlah, created_at)
      VALUES (?, ?, ?, datetime('now'))
    `, [from_id, to_id, amount]);
  } catch (err) {
    logger.error('❌ Error creating saldo transfer:', err.message);
    throw err;
  }
}

/**
 * Get transfer history
 * @param {number} userId
 * @param {number} limit
 * @returns {Promise<Array>}
 */
async function getTransferHistory(userId, limit = 5) {
  try {
    return await dbAll(`
      SELECT to_id, jumlah AS amount, created_at
      FROM transfer_log
      WHERE from_id = ?
      ORDER BY datetime(created_at) DESC
      LIMIT ?
    `, [userId, limit]);
  } catch (err) {
    logger.error('❌ Error getting transfer history:', err.message);
    throw err;
  }
}

module.exports = {
  createInvoice,
  getLastInvoice,
  getLastInvoiceByUsername,
  createTransaction,
  getAllTransactions,
  createTopupLog,
  getTopupLogs,
  createSaldoTransfer,
  getTransferHistory
};
