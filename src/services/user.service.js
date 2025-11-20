/**
 * User Service
 * Business logic for user operations
 */

const UserQueries = require('../database/queries/users');
const { USER_ROLES, DAILY_TRIAL_LIMITS } = require('../config/constants');
const logger = require('../utils/logger');

class UserService {
  /**
   * Register or update user information
   * @param {number} userId - Telegram user ID
   * @param {string} username - Telegram username
   * @param {string} firstName - User's first name
   * @returns {Promise<Object>}
   */
  static async registerOrUpdate(userId, username, firstName) {
    try {
      await UserQueries.createOrUpdate(userId, username, firstName);
      logger.info(`User registered/updated: ${userId} (${username})`);
      
      const user = await UserQueries.findById(userId);
      return user;
    } catch (error) {
      logger.error(`Failed to register user ${userId}:`, error.message);
      throw error;
    }
  }

  /**
   * Get user by ID
   * @param {number} userId - Telegram user ID
   * @returns {Promise<Object|null>}
   */
  static async getUserById(userId) {
    try {
      return await UserQueries.findById(userId);
    } catch (error) {
      logger.error(`Failed to get user ${userId}:`, error.message);
      throw error;
    }
  }

  /**
   * Check if user is admin
   * @param {number} userId - Telegram user ID
   * @param {Array} adminIds - Array of admin IDs
   * @returns {boolean}
   */
  static isAdmin(userId, adminIds) {
    return adminIds.includes(String(userId));
  }

  /**
   * Check if user is reseller
   * @param {Object} user - User object
   * @returns {boolean}
   */
  static isReseller(user) {
    return user && user.role === USER_ROLES.RESELLER;
  }

  /**
   * Add balance to user
   * @param {number} userId - Telegram user ID
   * @param {number} amount - Amount to add
   * @returns {Promise<Object>}
   */
  static async addBalance(userId, amount) {
    try {
      await UserQueries.updateBalance(userId, amount);
      logger.info(`Added balance ${amount} to user ${userId}`);
      
      const user = await UserQueries.findById(userId);
      return user;
    } catch (error) {
      logger.error(`Failed to add balance to user ${userId}:`, error.message);
      throw error;
    }
  }

  /**
   * Deduct balance from user
   * @param {number} userId - Telegram user ID
   * @param {number} amount - Amount to deduct
   * @returns {Promise<Object>}
   */
  static async deductBalance(userId, amount) {
    try {
      const user = await UserQueries.findById(userId);
      
      if (!user || user.saldo < amount) {
        throw new Error('Insufficient balance');
      }
      
      await UserQueries.updateBalance(userId, -amount);
      logger.info(`Deducted balance ${amount} from user ${userId}`);
      
      return await UserQueries.findById(userId);
    } catch (error) {
      logger.error(`Failed to deduct balance from user ${userId}:`, error.message);
      throw error;
    }
  }

  /**
   * Set user balance
   * @param {number} userId - Telegram user ID
   * @param {number} balance - New balance
   * @returns {Promise<Object>}
   */
  static async setBalance(userId, balance) {
    try {
      await UserQueries.setBalance(userId, balance);
      logger.info(`Set balance ${balance} for user ${userId}`);
      
      return await UserQueries.findById(userId);
    } catch (error) {
      logger.error(`Failed to set balance for user ${userId}:`, error.message);
      throw error;
    }
  }

  /**
   * Upgrade user to reseller
   * @param {number} userId - Telegram user ID
   * @returns {Promise<Object>}
   */
  static async upgradeToReseller(userId) {
    try {
      await UserQueries.updateRole(userId, USER_ROLES.RESELLER);
      await UserQueries.updateResellerLevel(userId, 'silver');
      logger.info(`User ${userId} upgraded to reseller`);
      
      return await UserQueries.findById(userId);
    } catch (error) {
      logger.error(`Failed to upgrade user ${userId} to reseller:`, error.message);
      throw error;
    }
  }

  /**
   * Check trial eligibility
   * @param {Object} user - User object
   * @param {Array} adminIds - Array of admin IDs
   * @returns {Object} - { eligible: boolean, reason?: string }
   */
  static checkTrialEligibility(user, adminIds) {
    if (!user) {
      return { eligible: false, reason: 'user_not_found' };
    }

    // Admin has unlimited trials
    if (this.isAdmin(user.user_id, adminIds)) {
      return { eligible: true };
    }

    const today = new Date().toISOString().split('T')[0];
    const limit = DAILY_TRIAL_LIMITS[user.role] || DAILY_TRIAL_LIMITS.user;

    // Check if user has reached daily limit
    if (user.last_trial_date === today && user.trial_count_today >= limit) {
      return { 
        eligible: false, 
        reason: 'daily_limit_reached',
        limit: limit,
        used: user.trial_count_today
      };
    }

    return { eligible: true };
  }

  /**
   * Increment user trial count
   * @param {number} userId - Telegram user ID
   * @returns {Promise<void>}
   */
  static async incrementTrialCount(userId) {
    try {
      await UserQueries.incrementTrialCount(userId);
      logger.info(`Incremented trial count for user ${userId}`);
    } catch (error) {
      logger.error(`Failed to increment trial count for user ${userId}:`, error.message);
      throw error;
    }
  }

  /**
   * Get user statistics
   * @returns {Promise<Object>}
   */
  static async getStatistics() {
    try {
      return await UserQueries.getStatistics();
    } catch (error) {
      logger.error('Failed to get user statistics:', error.message);
      throw error;
    }
  }
}

module.exports = UserService;
