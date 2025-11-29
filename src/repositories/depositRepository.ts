
import type { BotContext, DatabaseUser, DatabaseServer } from "../types";
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
  const { unique_code, user_id, amount, original_amount, timestamp, status, qr_message_id, payment_method } = depositData;

  try {
    return await dbRun(`
      INSERT INTO pending_deposits 
      (unique_code, user_id, amount, original_amount, timestamp, status, qr_message_id, payment_method)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `, [unique_code, user_id, amount, original_amount, timestamp, status, qr_message_id, payment_method || 'midtrans']);
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

/**
 * Update deposit with payment proof
 * @param {string} uniqueCode
 * @param {string} proofImageId - Telegram file_id of uploaded proof
 * @param {string} status - New status (awaiting_verification)
 * @returns {Promise<Object>}
 */
async function updateDepositProof(uniqueCode, proofImageId, status) {
  try {
    return await dbRun(
      'UPDATE pending_deposits SET proof_image_id = ?, status = ? WHERE unique_code = ?',
      [proofImageId, status, uniqueCode]
    );
  } catch (err) {
    logger.error('❌ Error updating deposit proof:', err.message);
    throw err;
  }
}

/**
 * Get deposits awaiting admin verification
 * @returns {Promise<Array>}
 */
async function getAwaitingVerificationDeposits() {
  try {
    return await dbAll(
      "SELECT * FROM pending_deposits WHERE status = 'awaiting_verification' ORDER BY timestamp DESC"
    );
  } catch (err) {
    logger.error('❌ Error getting awaiting verification deposits:', err.message);
    throw err;
  }
}

/**
 * Approve deposit (admin action)
 * @param {string} uniqueCode
 * @param {number} adminId
 * @param {string} notes - Optional admin notes
 * @returns {Promise<Object>}
 */
async function approveDeposit(uniqueCode, adminId, notes = '') {
  try {
    return await dbRun(
      `UPDATE pending_deposits SET 
        status = 'paid', 
        admin_approved_by = ?, 
        admin_approved_at = datetime('now'),
        admin_notes = ?
      WHERE unique_code = ?`,
      [adminId, notes, uniqueCode]
    );
  } catch (err) {
    logger.error('❌ Error approving deposit:', err.message);
    throw err;
  }
}

/**
 * Reject deposit (admin action)
 * @param {string} uniqueCode
 * @param {number} adminId
 * @param {string} notes - Rejection reason
 * @returns {Promise<Object>}
 */
async function rejectDeposit(uniqueCode, adminId, notes = '') {
  try {
    return await dbRun(
      `UPDATE pending_deposits SET 
        status = 'rejected', 
        admin_approved_by = ?, 
        admin_approved_at = datetime('now'),
        admin_notes = ?
      WHERE unique_code = ?`,
      [adminId, notes, uniqueCode]
    );
  } catch (err) {
    logger.error('❌ Error rejecting deposit:', err.message);
    throw err;
  }
}

module.exports = {
  createPendingDeposit,
  getPendingDeposit,
  getAllPendingDeposits,
  updateDepositStatus,
  deletePendingDeposit,
  deleteExpiredDeposits,
  updateDepositProof,
  getAwaitingVerificationDeposits,
  approveDeposit,
  rejectDeposit
};
