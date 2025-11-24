
import type { BotContext, DatabaseUser, DatabaseServer } from "../types";
/**
 * User Repository
 * Handles all user-related database operations
 * @module repositories/userRepository
 */

const { dbGet, dbAll, dbRun } = require('../infrastructure/database');
const logger = require('../utils/logger');

/**
 * Create or update user
 * @param {number} userId - Telegram user ID
 * @param {string} username - Telegram username
 * @param {string} firstName - User first name
 * @returns {Promise<Object>}
 */
async function upsertUser(userId, username, firstName) {
  try {
    const result = await dbRun(`
      INSERT INTO users (user_id, username, first_name)
      VALUES (?, ?, ?)
      ON CONFLICT(user_id) DO UPDATE SET 
        username = excluded.username,
        first_name = excluded.first_name
    `, [userId, username, firstName]);
    
    return { success: true, userId, ...result };
  } catch (err) {
    logger.error('❌ Error upserting user:', err.message);
    throw err;
  }
}

/**
 * Get user by ID
 * @param {number} userId
 * @returns {Promise<Object|null>}
 */
async function getUserById(userId) {
  try {
    return await dbGet('SELECT * FROM users WHERE user_id = ?', [userId]);
  } catch (err) {
    logger.error('❌ Error getting user:', err.message);
    throw err;
  }
}

/**
 * Get user balance
 * @param {number} userId
 * @returns {Promise<number>}
 */
async function getUserBalance(userId) {
  try {
    const user = await dbGet('SELECT saldo FROM users WHERE user_id = ?', [userId]);
    return user?.saldo || 0;
  } catch (err) {
    logger.error('❌ Error getting user balance:', err.message);
    throw err;
  }
}

/**
 * Update user balance
 * @param {number} userId
 * @param {number} amount - Amount to add/subtract
 * @returns {Promise<Object>}
 */
async function updateUserBalance(userId, amount) {
  try {
    return await dbRun(
      'UPDATE users SET saldo = saldo + ? WHERE user_id = ?',
      [amount, userId]
    );
  } catch (err) {
    logger.error('❌ Error updating balance:', err.message);
    throw err;
  }
}

/**
 * Set user balance
 * @param {number} userId
 * @param {number} amount
 * @returns {Promise<Object>}
 */
async function setUserBalance(userId, amount) {
  try {
    return await dbRun(
      'UPDATE users SET saldo = ? WHERE user_id = ?',
      [amount, userId]
    );
  } catch (err) {
    logger.error('❌ Error setting balance:', err.message);
    throw err;
  }
}

/**
 * Update user role
 * @param {number} userId
 * @param {string} role - 'user', 'reseller', or 'admin'
 * @returns {Promise<Object>}
 */
async function updateUserRole(userId, role) {
  try {
    return await dbRun(
      'UPDATE users SET role = ? WHERE user_id = ?',
      [role, userId]
    );
  } catch (err) {
    logger.error('❌ Error updating user role:', err.message);
    throw err;
  }
}

/**
 * Update reseller level
 * @param {number} userId
 * @param {string} level - 'silver', 'gold', or 'platinum'
 * @returns {Promise<Object>}
 */
async function updateResellerLevel(userId, level) {
  try {
    return await dbRun(
      'UPDATE users SET reseller_level = ? WHERE user_id = ?',
      [level, userId]
    );
  } catch (err) {
    logger.error('❌ Error updating reseller level:', err.message);
    throw err;
  }
}

/**
 * Get all users
 * @returns {Promise<Array>}
 */
async function getAllUsers() {
  try {
    return await dbAll('SELECT * FROM users');
  } catch (err) {
    logger.error('❌ Error getting all users:', err.message);
    throw err;
  }
}

/**
 * Get users by role
 * @param {string} role
 * @returns {Promise<Array>}
 */
async function getUsersByRole(role) {
  try {
    return await dbAll('SELECT * FROM users WHERE role = ?', [role]);
  } catch (err) {
    logger.error('❌ Error getting users by role:', err.message);
    throw err;
  }
}

/**
 * Get user count
 * @returns {Promise<number>}
 */
async function getUserCount() {
  try {
    const result = await dbGet('SELECT COUNT(*) AS count FROM users');
    return result?.count || 0;
  } catch (err) {
    logger.error('❌ Error getting user count:', err.message);
    throw err;
  }
}

/**
 * Get reseller count
 * @returns {Promise<number>}
 */
async function getResellerCount() {
  try {
    const result = await dbGet(
      "SELECT COUNT(*) AS count FROM users WHERE role = 'reseller'"
    );
    return result?.count || 0;
  } catch (err) {
    logger.error('❌ Error getting reseller count:', err.message);
    throw err;
  }
}

/**
 * Update trial info
 * @param {number} userId
 * @param {string} date
 * @returns {Promise<Object>}
 */
async function updateTrialInfo(userId, date) {
  try {
    return await dbRun(
      'UPDATE users SET trial_count_today = trial_count_today + 1, last_trial_date = ? WHERE user_id = ?',
      [date, userId]
    );
  } catch (err) {
    logger.error('❌ Error updating trial info:', err.message);
    throw err;
  }
}

/**
 * Reset daily trial counts
 * @returns {Promise<Object>}
 */
async function resetDailyTrialCounts() {
  try {
    return await dbRun(
      "UPDATE users SET trial_count_today = 0, last_trial_date = date('now')"
    );
  } catch (err) {
    logger.error('❌ Error resetting trial counts:', err.message);
    throw err;
  }
}

/**
 * Get total saldo across all users
 * @returns {Promise<number>}
 */
async function getTotalSaldo() {
  try {
    const result = await dbGet('SELECT SUM(saldo) AS total FROM users');
    return result?.total || 0;
  } catch (err) {
    logger.error('❌ Error getting total saldo:', err.message);
    throw err;
  }
}

/**
 * Update user saldo (set to specific amount)
 * Alias for setUserBalance for compatibility
 * @param {number} userId
 * @param {number} newSaldo - New balance amount
 * @returns {Promise<Object>}
 */
async function updateUserSaldo(userId, newSaldo) {
  return setUserBalance(userId, newSaldo);
}

module.exports = {
  upsertUser,
  getUserById,
  getUserBalance,
  updateUserBalance,
  setUserBalance,
  updateUserSaldo,
  updateUserRole,
  updateResellerLevel,
  getAllUsers,
  getUsersByRole,
  getUserCount,
  getResellerCount,
  updateTrialInfo,
  resetDailyTrialCounts,
  getTotalSaldo
};
