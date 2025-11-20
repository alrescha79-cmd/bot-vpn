/**
 * Server Database Queries
 * All server-related database operations
 */

const { dbGetAsync, dbAllAsync, dbRunAsync } = require('../connection');

class ServerQueries {
  /**
   * Find server by ID
   * @param {number} serverId - Server ID
   * @returns {Promise<Object|undefined>}
   */
  static async findById(serverId) {
    return dbGetAsync('SELECT * FROM Server WHERE id = ?', [serverId]);
  }

  /**
   * Get all servers
   * @returns {Promise<Array>}
   */
  static async getAll() {
    return dbAllAsync('SELECT * FROM Server ORDER BY id ASC');
  }

  /**
   * Get servers with available slots
   * @returns {Promise<Array>}
   */
  static async getAvailableServers() {
    return dbAllAsync(
      'SELECT * FROM Server WHERE total_create_akun < batas_create_akun ORDER BY id ASC'
    );
  }

  /**
   * Create new server
   * @param {Object} serverData - Server configuration
   * @returns {Promise<Object>}
   */
  static async create(serverData) {
    const {
      domain,
      auth,
      harga,
      nama_server,
      quota,
      iplimit,
      batas_create_akun
    } = serverData;

    return dbRunAsync(
      `INSERT INTO Server (domain, auth, harga, nama_server, quota, iplimit, batas_create_akun, total_create_akun)
       VALUES (?, ?, ?, ?, ?, ?, ?, 0)`,
      [domain, auth, harga, nama_server, quota, iplimit, batas_create_akun]
    );
  }

  /**
   * Update server
   * @param {number} serverId - Server ID
   * @param {Object} serverData - Updated server data
   * @returns {Promise<Object>}
   */
  static async update(serverId, serverData) {
    const fields = [];
    const values = [];

    Object.entries(serverData).forEach(([key, value]) => {
      fields.push(`${key} = ?`);
      values.push(value);
    });

    values.push(serverId);

    return dbRunAsync(
      `UPDATE Server SET ${fields.join(', ')} WHERE id = ?`,
      values
    );
  }

  /**
   * Increment account creation counter
   * @param {number} serverId - Server ID
   * @returns {Promise<Object>}
   */
  static async incrementAccountCount(serverId) {
    return dbRunAsync(
      'UPDATE Server SET total_create_akun = total_create_akun + 1 WHERE id = ?',
      [serverId]
    );
  }

  /**
   * Decrement account creation counter
   * @param {number} serverId - Server ID
   * @returns {Promise<Object>}
   */
  static async decrementAccountCount(serverId) {
    return dbRunAsync(
      'UPDATE Server SET total_create_akun = total_create_akun - 1 WHERE id = ? AND total_create_akun > 0',
      [serverId]
    );
  }

  /**
   * Delete server
   * @param {number} serverId - Server ID
   * @returns {Promise<Object>}
   */
  static async delete(serverId) {
    return dbRunAsync('DELETE FROM Server WHERE id = ?', [serverId]);
  }

  /**
   * Get server statistics
   * @returns {Promise<Object>}
   */
  static async getStatistics() {
    const total = await dbGetAsync('SELECT COUNT(*) as count FROM Server');
    const totalAccounts = await dbGetAsync(
      'SELECT SUM(total_create_akun) as total FROM Server'
    );
    const totalCapacity = await dbGetAsync(
      'SELECT SUM(batas_create_akun) as total FROM Server'
    );

    return {
      totalServers: total?.count || 0,
      totalAccounts: totalAccounts?.total || 0,
      totalCapacity: totalCapacity?.total || 0,
      usagePercentage: totalCapacity?.total 
        ? ((totalAccounts?.total || 0) / totalCapacity.total * 100).toFixed(2)
        : 0
    };
  }

  /**
   * Check if server has available slots
   * @param {number} serverId - Server ID
   * @returns {Promise<boolean>}
   */
  static async hasAvailableSlots(serverId) {
    const server = await this.findById(serverId);
    if (!server) return false;
    return server.total_create_akun < server.batas_create_akun;
  }
}

module.exports = ServerQueries;
