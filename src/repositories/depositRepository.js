/**
 * Deposit Repository
 * Handles pending deposit operations
 * @module repositories/depositRepository
 */

const { dbGet, dbAll, dbRun } = require('../infrastructure/database');
const logger = require('../utils/logger');

/**
 * Create pending deposit
 * @param {Object} depositData
 * @returns {Promise<Object>}
 */
async function createPendingDeposit(depositData) {
  const { unique_code, user_id, amount, original_amount, timestamp, status, qr_message_id } = depositData;
  
  try {
    return await dbRun(`
      INSERT INTO pending_deposits 
      (unique_code, user_id, amount, original_amount, timestamp, status, qr_message_id)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `, [unique_code, user_id, amount, original_amount, timestamp, status, qr_message_id]);
  } catch (err) {
    logger.error('❌ Error creating pending deposit:', err.message);
    throw err;
  }
}

/**
 * Get pending deposit by code
 * @param {string} uniqueCode
 * @returns {Promise<Object|null>}
 */
async function getPendingDeposit(uniqueCode) {
  try {
    return await dbGet(
      'SELECT * FROM pending_deposits WHERE unique_code = ?',
      [uniqueCode]
    );
  } catch (err) {
    logger.error('❌ Error getting pending deposit:', err.message);
    throw err;
  }
}

/**
 * Get all pending deposits
 * @returns {Promise<Array>}
 */
async function getAllPendingDeposits() {
  try {
    return await dbAll(
      "SELECT * FROM pending_deposits WHERE status = 'pending' ORDER BY timestamp DESC"
    );
  } catch (err) {
    logger.error('❌ Error getting all pending deposits:', err.message);
    throw err;
  }
}

/**
 * Update deposit status
 * @param {string} uniqueCode
 * @param {string} status
 * @returns {Promise<Object>}
 */
async function updateDepositStatus(uniqueCode, status) {
  try {
    return await dbRun(
      'UPDATE pending_deposits SET status = ? WHERE unique_code = ?',
      [status, uniqueCode]
    );
  } catch (err) {
    logger.error('❌ Error updating deposit status:', err.message);
    throw err;
  }
}

/**
 * Delete pending deposit
 * @param {string} uniqueCode
 * @returns {Promise<Object>}
 */
async function deletePendingDeposit(uniqueCode) {
  try {
    return await dbRun(
      'DELETE FROM pending_deposits WHERE unique_code = ?',
      [uniqueCode]
    );
  } catch (err) {
    logger.error('❌ Error deleting pending deposit:', err.message);
    throw err;
  }
}

/**
 * Delete expired deposits
 * @param {number} expiryTime - Timestamp threshold
 * @returns {Promise<Object>}
 */
async function deleteExpiredDeposits(expiryTime) {
  try {
    return await dbRun(
      "DELETE FROM pending_deposits WHERE status = 'pending' AND timestamp < ?",
      [expiryTime]
    );
  } catch (err) {
    logger.error('❌ Error deleting expired deposits:', err.message);
    throw err;
  }
}

module.exports = {
  createPendingDeposit,
  getPendingDeposit,
  getAllPendingDeposits,
  updateDepositStatus,
  deletePendingDeposit,
  deleteExpiredDeposits
};
