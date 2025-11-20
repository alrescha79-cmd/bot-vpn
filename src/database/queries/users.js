/**
 * User Database Queries
 * All user-related database operations
 */

const { dbGetAsync, dbAllAsync, dbRunAsync } = require('../connection');

class UserQueries {
  /**
   * Find user by Telegram user_id
   * @param {number} userId - Telegram user ID
   * @returns {Promise<Object|undefined>}
   */
  static async findById(userId) {
    return dbGetAsync('SELECT * FROM users WHERE user_id = ?', [userId]);
  }

  /**
   * Find user by username
   * @param {string} username - Username
   * @returns {Promise<Object|undefined>}
   */
  static async findByUsername(username) {
    return dbGetAsync('SELECT * FROM users WHERE username = ?', [username]);
  }

  /**
   * Get all users
   * @returns {Promise<Array>}
   */
  static async getAll() {
    return dbAllAsync('SELECT * FROM users');
  }

  /**
   * Get all users with specific role
   * @param {string} role - User role (user, reseller, admin)
   * @returns {Promise<Array>}
   */
  static async getByRole(role) {
    return dbAllAsync('SELECT * FROM users WHERE role = ?', [role]);
  }

  /**
   * Create or update user
   * @param {number} userId - Telegram user ID
   * @param {string} username - Telegram username
   * @param {string} firstName - User's first name
   * @returns {Promise<Object>}
   */
  static async createOrUpdate(userId, username, firstName) {
    return dbRunAsync(
      `INSERT INTO users (user_id, username, first_name)
       VALUES (?, ?, ?)
       ON CONFLICT(user_id) DO UPDATE SET username = ?, first_name = ?`,
      [userId, username, firstName, username, firstName]
    );
  }

  /**
   * Update user balance
   * @param {number} userId - Telegram user ID
   * @param {number} amount - Amount to add (positive) or subtract (negative)
   * @returns {Promise<Object>}
   */
  static async updateBalance(userId, amount) {
    return dbRunAsync(
      'UPDATE users SET saldo = saldo + ? WHERE user_id = ?',
      [amount, userId]
    );
  }

  /**
   * Set user balance to specific amount
   * @param {number} userId - Telegram user ID
   * @param {number} balance - New balance
   * @returns {Promise<Object>}
   */
  static async setBalance(userId, balance) {
    return dbRunAsync(
      'UPDATE users SET saldo = ? WHERE user_id = ?',
      [balance, userId]
    );
  }

  /**
   * Update user role
   * @param {number} userId - Telegram user ID
   * @param {string} role - New role (user, reseller, admin)
   * @returns {Promise<Object>}
   */
  static async updateRole(userId, role) {
    return dbRunAsync(
      'UPDATE users SET role = ? WHERE user_id = ?',
      [role, userId]
    );
  }

  /**
   * Update reseller level
   * @param {number} userId - Telegram user ID
   * @param {string} level - Reseller level (silver, gold, platinum)
   * @returns {Promise<Object>}
   */
  static async updateResellerLevel(userId, level) {
    return dbRunAsync(
      'UPDATE users SET reseller_level = ? WHERE user_id = ?',
      [level, userId]
    );
  }

  /**
   * Update trial status
   * @param {number} userId - Telegram user ID
   * @param {boolean} hasTrial - Has used trial
   * @returns {Promise<Object>}
   */
  static async updateTrialStatus(userId, hasTrial) {
    return dbRunAsync(
      'UPDATE users SET has_trial = ? WHERE user_id = ?',
      [hasTrial ? 1 : 0, userId]
    );
  }

  /**
   * Increment daily trial count
   * @param {number} userId - Telegram user ID
   * @returns {Promise<Object>}
   */
  static async incrementTrialCount(userId) {
    const today = new Date().toISOString().split('T')[0];
    return dbRunAsync(
      `UPDATE users 
       SET trial_count_today = trial_count_today + 1, 
           last_trial_date = ? 
       WHERE user_id = ?`,
      [today, userId]
    );
  }

  /**
   * Reset daily trial counts for all users
   * @returns {Promise<Object>}
   */
  static async resetDailyTrialCounts() {
    const today = new Date().toISOString().split('T')[0];
    return dbRunAsync(
      `UPDATE users SET trial_count_today = 0, last_trial_date = ?`,
      [today]
    );
  }

  /**
   * Get user statistics
   * @returns {Promise<Object>}
   */
  static async getStatistics() {
    const total = await dbGetAsync('SELECT COUNT(*) as count FROM users');
    const resellers = await dbGetAsync(
      "SELECT COUNT(*) as count FROM users WHERE role = 'reseller'"
    );
    const totalBalance = await dbGetAsync(
      'SELECT SUM(saldo) as total FROM users'
    );

    return {
      totalUsers: total?.count || 0,
      totalResellers: resellers?.count || 0,
      totalBalance: totalBalance?.total || 0
    };
  }

  /**
   * Delete user
   * @param {number} userId - Telegram user ID
   * @returns {Promise<Object>}
   */
  static async delete(userId) {
    return dbRunAsync('DELETE FROM users WHERE user_id = ?', [userId]);
  }
}

module.exports = UserQueries;
