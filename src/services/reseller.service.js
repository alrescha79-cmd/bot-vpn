/**
 * Reseller Service
 * Business logic for reseller operations and commission management
 */

const UserQueries = require('../database/queries/users');
const TransactionQueries = require('../database/queries/transactions');
const { COMMISSION_RATE, RESELLER_LEVELS, RESELLER_UPGRADE_COST } = require('../config/constants');
const logger = require('../utils/logger');

class ResellerService {
  /**
   * Calculate commission amount
   * @param {number} totalPrice - Total sale price
   * @returns {number}
   */
  static calculateCommission(totalPrice) {
    return Math.floor(totalPrice * COMMISSION_RATE);
  }

  /**
   * Determine reseller level based on total commission
   * @param {number} totalCommission - Total commission earned
   * @returns {string}
   */
  static determineLevel(totalCommission) {
    if (totalCommission >= RESELLER_LEVELS.PLATINUM.threshold) {
      return RESELLER_LEVELS.PLATINUM.name;
    }
    if (totalCommission >= RESELLER_LEVELS.GOLD.threshold) {
      return RESELLER_LEVELS.GOLD.name;
    }
    return RESELLER_LEVELS.SILVER.name;
  }

  /**
   * Get level display name
   * @param {string} level - Level name
   * @returns {string}
   */
  static getLevelDisplayName(level) {
    const levelData = Object.values(RESELLER_LEVELS).find(l => l.name === level);
    return levelData ? levelData.displayName : level.toUpperCase();
  }

  /**
   * Record reseller sale and update commission
   * @param {Object} saleData - Sale information
   * @returns {Promise<Object>}
   */
  static async recordSale(saleData) {
    const { resellerId, buyerId, accountType, username, totalPrice } = saleData;
    
    try {
      const commission = this.calculateCommission(totalPrice);
      
      // Record sale
      await TransactionQueries.recordResellerSale({
        resellerId,
        buyerId,
        akunType: accountType,
        username,
        komisi: commission
      });

      // Get total commission
      const totalCommission = await TransactionQueries.getResellerTotalCommission(resellerId);
      
      // Determine and update level
      const newLevel = this.determineLevel(totalCommission);
      await UserQueries.updateResellerLevel(resellerId, newLevel);

      logger.info(`Recorded sale for reseller ${resellerId}: ${commission} commission, level: ${newLevel}`);

      return {
        commission,
        totalCommission,
        level: newLevel,
        levelDisplay: this.getLevelDisplayName(newLevel)
      };
    } catch (error) {
      logger.error(`Failed to record sale for reseller ${resellerId}:`, error.message);
      throw error;
    }
  }

  /**
   * Get reseller commission summary
   * @param {number} resellerId - Reseller user ID
   * @returns {Promise<Object>}
   */
  static async getCommissionSummary(resellerId) {
    try {
      const user = await UserQueries.findById(resellerId);
      if (!user || user.role !== 'reseller') {
        throw new Error('User is not a reseller');
      }

      const totalCommission = await TransactionQueries.getResellerTotalCommission(resellerId);
      const sales = await TransactionQueries.getResellerSales(resellerId, 10);

      return {
        level: user.reseller_level,
        levelDisplay: this.getLevelDisplayName(user.reseller_level),
        totalCommission,
        salesCount: sales.length,
        recentSales: sales
      };
    } catch (error) {
      logger.error(`Failed to get commission summary for ${resellerId}:`, error.message);
      throw error;
    }
  }

  /**
   * Upgrade user to reseller
   * @param {number} userId - User ID
   * @param {string} username - Username
   * @returns {Promise<Object>}
   */
  static async upgradeToReseller(userId, username) {
    try {
      const user = await UserQueries.findById(userId);
      
      if (!user) {
        throw new Error('User not found');
      }

      if (user.role === 'reseller') {
        throw new Error('User is already a reseller');
      }

      if (user.saldo < RESELLER_UPGRADE_COST) {
        throw new Error('Insufficient balance');
      }

      // Deduct balance
      await UserQueries.updateBalance(userId, -RESELLER_UPGRADE_COST);
      
      // Upgrade to reseller
      await UserQueries.updateRole(userId, 'reseller');
      await UserQueries.updateResellerLevel(userId, RESELLER_LEVELS.SILVER.name);

      // Log upgrade
      await TransactionQueries.logResellerUpgrade(
        userId,
        username,
        RESELLER_UPGRADE_COST,
        RESELLER_LEVELS.SILVER.name
      );

      logger.info(`User ${userId} upgraded to reseller`);

      return await UserQueries.findById(userId);
    } catch (error) {
      logger.error(`Failed to upgrade user ${userId} to reseller:`, error.message);
      throw error;
    }
  }

  /**
   * Reset all reseller commissions (monthly reset)
   * @returns {Promise<void>}
   */
  static async resetMonthlyCommissions() {
    try {
      // Delete all sales records
      await TransactionQueries.resetResellerSales();
      
      // Reset all reseller levels to silver
      const resellers = await UserQueries.getByRole('reseller');
      for (const reseller of resellers) {
        await UserQueries.updateResellerLevel(reseller.user_id, RESELLER_LEVELS.SILVER.name);
      }

      logger.info('Monthly reseller commission reset completed');
    } catch (error) {
      logger.error('Failed to reset monthly commissions:', error.message);
      throw error;
    }
  }

  /**
   * Get reseller statistics
   * @returns {Promise<Object>}
   */
  static async getStatistics() {
    try {
      const resellers = await UserQueries.getByRole('reseller');
      const totalCommissions = await TransactionQueries.getStatistics();

      const levelCounts = {
        silver: 0,
        gold: 0,
        platinum: 0
      };

      resellers.forEach(reseller => {
        if (levelCounts.hasOwnProperty(reseller.reseller_level)) {
          levelCounts[reseller.reseller_level]++;
        }
      });

      return {
        totalResellers: resellers.length,
        levelCounts,
        totalCommissions: totalCommissions.totalCommissions || 0
      };
    } catch (error) {
      logger.error('Failed to get reseller statistics:', error.message);
      throw error;
    }
  }
}

module.exports = ResellerService;
