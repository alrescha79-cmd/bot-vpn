
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
      "UPDATE pending_deposits SET status = ? WHERE unique_code = ? AND status = 'pending'",
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
      "UPDATE pending_deposits SET proof_image_id = ?, status = ? WHERE unique_code = ? AND status = 'pending' AND payment_method = 'static_qris'",
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
  return settleDeposit(uniqueCode, adminId, notes);
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
      WHERE unique_code = ? AND status = 'awaiting_verification'`,
      [adminId, notes, uniqueCode]
    );
  } catch (err) {
    logger.error('❌ Error rejecting deposit:', err.message);
    throw err;
  }
}

let settlementQueue: Promise<any> = Promise.resolve();

function settleDeposit(uniqueCode, adminId = null, notes = '') {
  const result = settlementQueue.then(() => settleDepositTransaction(uniqueCode, adminId, notes));
  settlementQueue = result.catch(() => undefined);
  return result;
}

async function settleDepositTransaction(uniqueCode, adminId, notes) {
  const sqlite3 = require('sqlite3');
  const { DB_PATH } = require('../config/constants');
  const connection = await new Promise<any>((resolve, reject) => {
    const db = new sqlite3.Database(DB_PATH, sqlite3.OPEN_READWRITE, err => err ? reject(err) : resolve(db));
  });
  connection.configure('busyTimeout', 5000);
  const run = (sql, params = []) => new Promise<any>((resolve, reject) => {
    connection.run(sql, params, function (err) {
      if (err) reject(err);
      else resolve({ changes: this.changes });
    });
  });
  const get = (sql, params = []) => new Promise<any>((resolve, reject) => {
    connection.get(sql, params, (err, row) => err ? reject(err) : resolve(row));
  });
  let transaction = false;
  try {
    await run('BEGIN IMMEDIATE');
    transaction = true;
    const deposit = await get('SELECT * FROM pending_deposits WHERE unique_code = ?', [uniqueCode]);
    const expectedStatus = adminId === null ? 'pending' : 'awaiting_verification';
    if (!deposit || deposit.status !== expectedStatus) {
      await run('ROLLBACK');
      transaction = false;
      return null;
    }
    if (adminId !== null && deposit.payment_method !== 'static_qris') {
      throw new Error('Invalid manual deposit');
    }
    const amount = Number(deposit.amount);
    if (!Number.isSafeInteger(amount) || amount <= 0) throw new Error('Invalid deposit amount');
    const user = await get('SELECT * FROM users WHERE user_id = ?', [deposit.user_id]);
    if (!user || !Number.isSafeInteger(Number(user.saldo) + amount)) throw new Error('Invalid deposit beneficiary');
    const claim = await run(
      "UPDATE pending_deposits SET status = 'paid' WHERE unique_code = ? AND status = ?",
      [uniqueCode, expectedStatus]
    );
    if (claim.changes !== 1) throw new Error('Deposit claim failed');
    const credit = await run('UPDATE users SET saldo = saldo + ? WHERE user_id = ?', [amount, deposit.user_id]);
    if (credit.changes !== 1) throw new Error('Deposit credit failed');
    if (adminId !== null) {
      await run(
        "UPDATE pending_deposits SET admin_approved_by = ?, admin_approved_at = datetime('now'), admin_notes = ? WHERE unique_code = ?",
        [adminId, notes, uniqueCode]
      );
    }
    const creditedUser = await get('SELECT * FROM users WHERE user_id = ?', [deposit.user_id]);
    await run('COMMIT');
    transaction = false;
    return { deposit, user, amount, newSaldo: creditedUser.saldo };
  } catch (err) {
    if (transaction) await run('ROLLBACK');
    throw err;
  } finally {
    await new Promise<void>((resolve, reject) => connection.close(err => err ? reject(err) : resolve()));
  }
}

module.exports = {
  settleDeposit,
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
