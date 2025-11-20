/**
 * Account Database Queries
 * Active account tracking operations
 */

const { dbGetAsync, dbAllAsync, dbRunAsync } = require('../connection');

class AccountQueries {
  /**
   * Add active account
   * @param {string} username - Account username
   * @param {string} jenis - Account type (protocol)
   * @returns {Promise<Object>}
   */
  static async addActiveAccount(username, jenis) {
    return dbRunAsync(
      'INSERT OR REPLACE INTO akun_aktif (username, jenis) VALUES (?, ?)',
      [username, jenis]
    );
  }

  /**
   * Remove active account
   * @param {string} username - Account username
   * @returns {Promise<Object>}
   */
  static async removeActiveAccount(username) {
    return dbRunAsync(
      'DELETE FROM akun_aktif WHERE username = ?',
      [username]
    );
  }

  /**
   * Check if account exists
   * @param {string} username - Account username
   * @returns {Promise<boolean>}
   */
  static async accountExists(username) {
    const result = await dbGetAsync(
      'SELECT * FROM akun_aktif WHERE username = ?',
      [username]
    );
    return !!result;
  }

  /**
   * Get all active accounts
   * @returns {Promise<Array>}
   */
  static async getAllActiveAccounts() {
    return dbAllAsync('SELECT * FROM akun_aktif ORDER BY username ASC');
  }

  /**
   * Get active accounts by type
   * @param {string} jenis - Account type
   * @returns {Promise<Array>}
   */
  static async getActiveAccountsByType(jenis) {
    return dbAllAsync(
      'SELECT * FROM akun_aktif WHERE jenis = ? ORDER BY username ASC',
      [jenis]
    );
  }

  /**
   * Count active accounts
   * @returns {Promise<number>}
   */
  static async countActiveAccounts() {
    const result = await dbGetAsync('SELECT COUNT(*) as count FROM akun_aktif');
    return result?.count || 0;
  }

  /**
   * Count active accounts by type
   * @param {string} jenis - Account type
   * @returns {Promise<number>}
   */
  static async countActiveAccountsByType(jenis) {
    const result = await dbGetAsync(
      'SELECT COUNT(*) as count FROM akun_aktif WHERE jenis = ?',
      [jenis]
    );
    return result?.count || 0;
  }
}

module.exports = AccountQueries;
