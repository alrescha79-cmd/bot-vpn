/**
 * Reseller Repository
 * Handles reseller-related database operations
 * @module repositories/resellerRepository
 */

const { dbGet, dbAll, dbRun } = require('../infrastructure/database');
const logger = require('../utils/logger');

/**
 * Create reseller sale
 * @param {Object} saleData
 * @returns {Promise<Object>}
 */
async function createResellerSale(saleData) {
  const { reseller_id, buyer_id, akun_type, username, komisi } = saleData;
  
  try {
    return await dbRun(`
      INSERT INTO reseller_sales (reseller_id, buyer_id, akun_type, username, komisi, created_at)
      VALUES (?, ?, ?, ?, ?, datetime('now'))
    `, [reseller_id, buyer_id, akun_type, username, komisi]);
  } catch (err) {
    logger.error('❌ Error creating reseller sale:', err.message);
    throw err;
  }
}

/**
 * Get reseller sales summary
 * @param {number} resellerId
 * @returns {Promise<Object>}
 */
async function getResellerSalesSummary(resellerId) {
  try {
    return await dbGet(`
      SELECT 
        COUNT(*) AS total_akun,
        SUM(komisi) AS total_komisi
      FROM reseller_sales
      WHERE reseller_id = ?
    `, [resellerId]);
  } catch (err) {
    logger.error('❌ Error getting reseller sales summary:', err.message);
    throw err;
  }
}

/**
 * Get reseller recent sales
 * @param {number} resellerId
 * @param {number} limit
 * @returns {Promise<Array>}
 */
async function getResellerRecentSales(resellerId, limit = 5) {
  try {
    return await dbAll(`
      SELECT akun_type, username, komisi, created_at
      FROM reseller_sales
      WHERE reseller_id = ?
      ORDER BY created_at DESC
      LIMIT ?
    `, [resellerId, limit]);
  } catch (err) {
    logger.error('❌ Error getting reseller recent sales:', err.message);
    throw err;
  }
}

/**
 * Get top resellers by commission (weekly)
 * @param {number} limit
 * @returns {Promise<Array>}
 */
async function getTopResellersWeekly(limit = 3) {
  try {
    return await dbAll(`
      SELECT 
        u.username,
        r.reseller_id,
        SUM(r.komisi) AS total_komisi,
        COUNT(DISTINCT i.id) AS total_create
      FROM reseller_sales r
      LEFT JOIN users u ON u.user_id = r.reseller_id
      LEFT JOIN invoice_log i ON i.user_id = r.reseller_id 
        AND i.created_at >= datetime('now', '-7 days')
      WHERE r.created_at >= datetime('now', '-7 days')
      GROUP BY r.reseller_id
      ORDER BY total_komisi DESC
      LIMIT ?
    `, [limit]);
  } catch (err) {
    logger.error('❌ Error getting top resellers weekly:', err.message);
    throw err;
  }
}

/**
 * Get top resellers all time
 * @param {number} limit
 * @returns {Promise<Array>}
 */
async function getTopResellersAllTime(limit = 10) {
  try {
    return await dbAll(`
      SELECT 
        r.reseller_id,
        COUNT(r.id) AS total_akun,
        SUM(COALESCE(r.komisi, 0)) AS total_komisi,
        u.username
      FROM reseller_sales r
      INNER JOIN users u ON r.reseller_id = u.user_id
      GROUP BY r.reseller_id
      HAVING total_komisi > 0
      ORDER BY total_komisi DESC
      LIMIT ?
    `, [limit]);
  } catch (err) {
    logger.error('❌ Error getting top resellers all time:', err.message);
    throw err;
  }
}

/**
 * Get reseller total commission
 * @param {number} resellerId
 * @returns {Promise<number>}
 */
async function getResellerTotalCommission(resellerId) {
  try {
    const result = await dbGet(
      'SELECT SUM(komisi) AS total_komisi FROM reseller_sales WHERE reseller_id = ?',
      [resellerId]
    );
    return result?.total_komisi || 0;
  } catch (err) {
    logger.error('❌ Error getting reseller total commission:', err.message);
    throw err;
  }
}

/**
 * Delete reseller sales by user ID
 * @param {number} resellerId
 * @returns {Promise<Object>}
 */
async function deleteResellerSales(resellerId) {
  try {
    return await dbRun(
      'DELETE FROM reseller_sales WHERE reseller_id = ?',
      [resellerId]
    );
  } catch (err) {
    logger.error('❌ Error deleting reseller sales:', err.message);
    throw err;
  }
}

/**
 * Reset all reseller sales (monthly reset)
 * @returns {Promise<Object>}
 */
async function resetAllResellerSales() {
  try {
    return await dbRun('DELETE FROM reseller_sales');
  } catch (err) {
    logger.error('❌ Error resetting all reseller sales:', err.message);
    throw err;
  }
}

/**
 * Cleanup orphan resellers
 * @returns {Promise<Object>}
 */
async function cleanupOrphanResellers() {
  try {
    const orphans = await dbAll(`
      SELECT DISTINCT reseller_id FROM reseller_sales
      WHERE reseller_id NOT IN (SELECT user_id FROM users)
    `);

    if (orphans.length === 0) {
      logger.info('✅ No orphan resellers found');
      return { changes: 0 };
    }

    const orphanIds = orphans.map(row => row.reseller_id);
    const placeholders = orphanIds.map(() => '?').join(',');
    
    const result = await dbRun(
      `DELETE FROM reseller_sales WHERE reseller_id IN (${placeholders})`,
      orphanIds
    );
    
    logger.info(`✅ Cleaned up ${result.changes} orphan reseller records`);
    return result;
  } catch (err) {
    logger.error('❌ Error cleaning up orphan resellers:', err.message);
    throw err;
  }
}

/**
 * Create reseller upgrade log
 * @param {Object} upgradeData
 * @returns {Promise<Object>}
 */
async function createResellerUpgradeLog(upgradeData) {
  const { user_id, username, amount, level } = upgradeData;
  
  try {
    return await dbRun(`
      INSERT INTO reseller_upgrade_log (user_id, username, amount, level, created_at)
      VALUES (?, ?, ?, ?, datetime('now'))
    `, [user_id, username, amount, level]);
  } catch (err) {
    logger.error('❌ Error creating reseller upgrade log:', err.message);
    throw err;
  }
}

module.exports = {
  createResellerSale,
  getResellerSalesSummary,
  getResellerRecentSales,
  getTopResellersWeekly,
  getTopResellersAllTime,
  getResellerTotalCommission,
  deleteResellerSales,
  resetAllResellerSales,
  cleanupOrphanResellers,
  createResellerUpgradeLog
};
