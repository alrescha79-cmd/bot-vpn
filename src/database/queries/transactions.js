/**
 * Transaction Database Queries
 * All transaction and financial record operations
 */

const { dbGetAsync, dbAllAsync, dbRunAsync } = require('../connection');

class TransactionQueries {
  /**
   * Log invoice/transaction
   * @param {Object} invoiceData - Invoice details
   * @returns {Promise<Object>}
   */
  static async logInvoice(invoiceData) {
    const {
      userId,
      username,
      layanan,
      akun,
      hari,
      harga,
      komisi
    } = invoiceData;

    return dbRunAsync(
      `INSERT INTO invoice_log (user_id, username, layanan, akun, hari, harga, komisi, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, datetime('now'))`,
      [userId, username, layanan, akun, hari, harga, komisi]
    );
  }

  /**
   * Log trial usage
   * @param {number} userId - User ID
   * @param {string} username - Username
   * @param {string} jenis - VPN type
   * @returns {Promise<Object>}
   */
  static async logTrial(userId, username, jenis) {
    return dbRunAsync(
      `INSERT INTO trial_logs (user_id, username, jenis, created_at)
       VALUES (?, ?, ?, datetime('now'))`,
      [userId, username, jenis]
    );
  }

  /**
   * Record reseller sale
   * @param {Object} saleData - Sale details
   * @returns {Promise<Object>}
   */
  static async recordResellerSale(saleData) {
    const {
      resellerId,
      buyerId,
      akunType,
      username,
      komisi
    } = saleData;

    return dbRunAsync(
      `INSERT INTO reseller_sales (reseller_id, buyer_id, akun_type, username, komisi, created_at)
       VALUES (?, ?, ?, ?, ?, datetime('now'))`,
      [resellerId, buyerId, akunType, username, komisi]
    );
  }

  /**
   * Log reseller upgrade
   * @param {number} userId - User ID
   * @param {string} username - Username
   * @param {number} amount - Upgrade cost
   * @param {string} level - New level
   * @returns {Promise<Object>}
   */
  static async logResellerUpgrade(userId, username, amount, level) {
    return dbRunAsync(
      `INSERT INTO reseller_upgrade_log (user_id, username, amount, level, created_at)
       VALUES (?, ?, ?, ?, datetime('now'))`,
      [userId, username, amount, level]
    );
  }

  /**
   * Get reseller total commission
   * @param {number} resellerId - Reseller user ID
   * @returns {Promise<number>}
   */
  static async getResellerTotalCommission(resellerId) {
    const result = await dbGetAsync(
      'SELECT SUM(komisi) AS total_komisi FROM reseller_sales WHERE reseller_id = ?',
      [resellerId]
    );
    return result?.total_komisi || 0;
  }

  /**
   * Get reseller sales history
   * @param {number} resellerId - Reseller user ID
   * @param {number} limit - Number of records to fetch
   * @returns {Promise<Array>}
   */
  static async getResellerSales(resellerId, limit = 50) {
    return dbAllAsync(
      `SELECT * FROM reseller_sales 
       WHERE reseller_id = ? 
       ORDER BY created_at DESC 
       LIMIT ?`,
      [resellerId, limit]
    );
  }

  /**
   * Get all invoices for a user
   * @param {number} userId - User ID
   * @param {number} limit - Number of records
   * @returns {Promise<Array>}
   */
  static async getUserInvoices(userId, limit = 50) {
    return dbAllAsync(
      `SELECT * FROM invoice_log 
       WHERE user_id = ? 
       ORDER BY created_at DESC 
       LIMIT ?`,
      [userId, limit]
    );
  }

  /**
   * Get trial logs for a user
   * @param {number} userId - User ID
   * @param {number} limit - Number of records
   * @returns {Promise<Array>}
   */
  static async getUserTrialLogs(userId, limit = 50) {
    return dbAllAsync(
      `SELECT * FROM trial_logs 
       WHERE user_id = ? 
       ORDER BY created_at DESC 
       LIMIT ?`,
      [userId, limit]
    );
  }

  /**
   * Reset all reseller sales (monthly reset)
   * @returns {Promise<Object>}
   */
  static async resetResellerSales() {
    return dbRunAsync('DELETE FROM reseller_sales');
  }

  /**
   * Get transaction statistics
   * @returns {Promise<Object>}
   */
  static async getStatistics() {
    const totalInvoices = await dbGetAsync(
      'SELECT COUNT(*) as count, SUM(harga) as total FROM invoice_log'
    );
    const totalCommissions = await dbGetAsync(
      'SELECT SUM(komisi) as total FROM reseller_sales'
    );
    const totalTrials = await dbGetAsync(
      'SELECT COUNT(*) as count FROM trial_logs'
    );

    return {
      totalInvoices: totalInvoices?.count || 0,
      totalRevenue: totalInvoices?.total || 0,
      totalCommissions: totalCommissions?.total || 0,
      totalTrials: totalTrials?.count || 0
    };
  }

  /**
   * Create pending deposit record
   * @param {Object} depositData - Deposit details
   * @returns {Promise<Object>}
   */
  static async createPendingDeposit(depositData) {
    const {
      uniqueCode,
      userId,
      amount,
      originalAmount,
      timestamp,
      status,
      qrMessageId
    } = depositData;

    return dbRunAsync(
      `INSERT INTO pending_deposits (unique_code, user_id, amount, original_amount, timestamp, status, qr_message_id)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [uniqueCode, userId, amount, originalAmount, timestamp, status, qrMessageId]
    );
  }

  /**
   * Get pending deposit by unique code
   * @param {string} uniqueCode - Unique payment code
   * @returns {Promise<Object|undefined>}
   */
  static async getPendingDeposit(uniqueCode) {
    return dbGetAsync(
      'SELECT * FROM pending_deposits WHERE unique_code = ?',
      [uniqueCode]
    );
  }

  /**
   * Delete pending deposit
   * @param {string} uniqueCode - Unique payment code
   * @returns {Promise<Object>}
   */
  static async deletePendingDeposit(uniqueCode) {
    return dbRunAsync(
      'DELETE FROM pending_deposits WHERE unique_code = ?',
      [uniqueCode]
    );
  }

  /**
   * Get all pending deposits
   * @returns {Promise<Array>}
   */
  static async getAllPendingDeposits() {
    return dbAllAsync('SELECT * FROM pending_deposits');
  }
}

module.exports = TransactionQueries;
