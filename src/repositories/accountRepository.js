/**
 * Account Repository
 * Handles account-related database operations
 * @module repositories/accountRepository
 */

const { dbGet, dbAll, dbRun } = require('../infrastructure/database');
const logger = require('../utils/logger');

/**
 * Create or update active account
 * @param {string} username
 * @param {string} jenis - Account type
 * @returns {Promise<Object>}
 */
async function upsertActiveAccount(username, jenis) {
  try {
    return await dbRun(
      'INSERT OR REPLACE INTO akun_aktif (username, jenis) VALUES (?, ?)',
      [username, jenis]
    );
  } catch (err) {
    logger.error('❌ Error upserting active account:', err.message);
    throw err;
  }
}

/**
 * Get active account
 * @param {string} username
 * @param {string} jenis
 * @returns {Promise<Object|null>}
 */
async function getActiveAccount(username, jenis) {
  try {
    return await dbGet(
      'SELECT * FROM akun_aktif WHERE username = ? AND jenis = ?',
      [username, jenis]
    );
  } catch (err) {
    logger.error('❌ Error getting active account:', err.message);
    throw err;
  }
}

/**
 * Create account record
 * @param {Object} accountData
 * @returns {Promise<Object>}
 */
async function createAccount(accountData) {
  const { user_id, jenis, username, server_id } = accountData;
  
  try {
    return await dbRun(`
      INSERT INTO akun (user_id, jenis, username, server_id, created_at)
      VALUES (?, ?, ?, ?, datetime('now'))
    `, [user_id, jenis, username, server_id]);
  } catch (err) {
    logger.error('❌ Error creating account record:', err.message);
    throw err;
  }
}

/**
 * Get account count
 * @returns {Promise<number>}
 */
async function getAccountCount() {
  try {
    const result = await dbGet('SELECT COUNT(*) AS count FROM akun');
    return result?.count || 0;
  } catch (err) {
    logger.error('❌ Error getting account count:', err.message);
    throw err;
  }
}

/**
 * Get user's accounts count
 * @param {number} userId
 * @returns {Promise<number>}
 */
async function getUserAccountCount(userId) {
  try {
    const result = await dbGet(
      'SELECT COUNT(*) AS total FROM invoice_log WHERE user_id = ?',
      [userId]
    );
    return result?.total || 0;
  } catch (err) {
    logger.error('❌ Error getting user account count:', err.message);
    throw err;
  }
}

/**
 * Get accounts by user
 * @param {number} userId
 * @returns {Promise<Array>}
 */
async function getAccountsByUser(userId) {
  try {
    return await dbAll(
      'SELECT * FROM akun WHERE user_id = ? ORDER BY created_at DESC',
      [userId]
    );
  } catch (err) {
    logger.error('❌ Error getting user accounts:', err.message);
    throw err;
  }
}

module.exports = {
  upsertActiveAccount,
  getActiveAccount,
  createAccount,
  getAccountCount,
  getUserAccountCount,
  getAccountsByUser
};
