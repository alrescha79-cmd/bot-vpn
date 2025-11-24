
import type { BotContext, DatabaseUser, DatabaseServer } from "../types";
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

/**
 * Save created account to database
 * @param {Object} accountData
 * @returns {Promise<Object>}
 */
async function saveCreatedAccount(accountData) {
  const { 
    username, 
    protocol, 
    server, 
    expired_at, 
    owner_user_id, 
    raw_response 
  } = accountData;
  
  const id = `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  
  try {
    // Check if account already exists
    const existing = await dbGet(
      'SELECT id FROM accounts WHERE username = ? AND server = ? AND protocol = ?',
      [username, server, protocol]
    );
    
    if (existing) {
      logger.info(`⚠️ Account ${username} already exists, skipping save`);
      return existing;
    }
    
    return await dbRun(`
      INSERT INTO accounts (id, username, protocol, server, expired_at, owner_user_id, status, raw_response, created_at)
      VALUES (?, ?, ?, ?, ?, ?, 'active', ?, datetime('now'))
    `, [id, username, protocol, server, expired_at, owner_user_id, raw_response]);
  } catch (err) {
    logger.error('❌ Error saving created account:', err);
    throw err;
  }
}

/**
 * Get accounts by owner with optional status filter
 * @param {number} userId
 * @param {string} status - optional: 'active' or 'expired'
 * @returns {Promise<Array>}
 */
async function getAccountsByOwner(userId, status = null) {
  try {
    let query = 'SELECT * FROM accounts WHERE owner_user_id = ?';
    const params = [userId];
    
    if (status) {
      query += ' AND status = ?';
      params.push(status);
    }
    
    query += ' ORDER BY created_at DESC';
    
    return await dbAll(query, params);
  } catch (err) {
    logger.error('❌ Error getting owner accounts:', err);
    throw err;
  }
}

/**
 * Get all accounts (admin only)
 * @param {string} status - optional: 'active' or 'expired'
 * @returns {Promise<Array>}
 */
async function getAllAccounts(status = null) {
  try {
    let query = 'SELECT * FROM accounts';
    const params = [];
    
    if (status) {
      query += ' WHERE status = ?';
      params.push(status);
    }
    
    query += ' ORDER BY created_at DESC';
    
    return await dbAll(query, params);
  } catch (err) {
    logger.error('❌ Error getting all accounts:', err);
    throw err;
  }
}

/**
 * Delete account by id
 * @param {string} accountId
 * @param {number} userId - for permission check
 * @param {string} userRole
 * @returns {Promise<Object>}
 */
async function deleteAccountById(accountId, userId, userRole) {
  try {
    // Check ownership unless admin
    if (userRole !== 'admin' && userRole !== 'owner') {
      const account = await dbGet(
        'SELECT owner_user_id FROM accounts WHERE id = ?',
        [accountId]
      );
      
      if (!account || account.owner_user_id !== userId) {
        throw new Error('Unauthorized to delete this account');
      }
    }
    
    return await dbRun('DELETE FROM accounts WHERE id = ?', [accountId]);
  } catch (err) {
    logger.error('❌ Error deleting account:', err);
    throw err;
  }
}

/**
 * Get account detail by id
 * @param {string} accountId
 * @returns {Promise<Object|null>}
 */
async function getAccountById(accountId) {
  try {
    return await dbGet('SELECT * FROM accounts WHERE id = ?', [accountId]);
  } catch (err) {
    logger.error('❌ Error getting account by id:', err);
    throw err;
  }
}

module.exports = {
  upsertActiveAccount,
  getActiveAccount,
  createAccount,
  getAccountCount,
  getUserAccountCount,
  getAccountsByUser,
  saveCreatedAccount,
  getAccountsByOwner,
  getAllAccounts,
  deleteAccountById,
  getAccountById
};
