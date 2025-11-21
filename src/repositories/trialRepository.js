/**
 * Trial Repository
 * Handles trial-related database operations
 * @module repositories/trialRepository
 */

const { dbGet, dbAll, dbRun } = require('../infrastructure/database');
const logger = require('../utils/logger');

/**
 * Create trial log
 * @param {Object} trialData
 * @returns {Promise<Object>}
 */
async function createTrialLog(trialData) {
  const { user_id, username, jenis } = trialData;
  
  try {
    return await dbRun(`
      INSERT INTO trial_logs (user_id, username, jenis, created_at)
      VALUES (?, ?, ?, datetime('now'))
    `, [user_id, username, jenis]);
  } catch (err) {
    logger.error('❌ Error creating trial log:', err.message);
    throw err;
  }
}

/**
 * Get user trial logs
 * @param {number} userId
 * @returns {Promise<Array>}
 */
async function getUserTrialLogs(userId) {
  try {
    return await dbAll(
      'SELECT * FROM trial_logs WHERE user_id = ? ORDER BY created_at DESC',
      [userId]
    );
  } catch (err) {
    logger.error('❌ Error getting user trial logs:', err.message);
    throw err;
  }
}

/**
 * Check if user has trial for specific type
 * @param {number} userId
 * @param {string} jenis
 * @returns {Promise<boolean>}
 */
async function hasUserTrial(userId, jenis) {
  try {
    const result = await dbGet(
      'SELECT COUNT(*) AS count FROM trial_logs WHERE user_id = ? AND jenis = ?',
      [userId, jenis]
    );
    return (result?.count || 0) > 0;
  } catch (err) {
    logger.error('❌ Error checking user trial:', err.message);
    throw err;
  }
}

/**
 * Get all trial logs
 * @param {number} limit
 * @returns {Promise<Array>}
 */
async function getAllTrialLogs(limit = 100) {
  try {
    return await dbAll(
      'SELECT * FROM trial_logs ORDER BY created_at DESC LIMIT ?',
      [limit]
    );
  } catch (err) {
    logger.error('❌ Error getting all trial logs:', err.message);
    throw err;
  }
}

/**
 * Reset all trial logs
 * @returns {Promise<Object>}
 */
async function resetAllTrials() {
  try {
    return await dbRun('DELETE FROM trial_logs');
  } catch (err) {
    logger.error('❌ Error resetting all trials:', err.message);
    throw err;
  }
}

module.exports = {
  createTrialLog,
  getUserTrialLogs,
  hasUserTrial,
  getAllTrialLogs,
  resetAllTrials
};
