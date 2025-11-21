
import type { BotContext, DatabaseUser, DatabaseServer } from "../types";
/**
 * Server Repository
 * Handles all server-related database operations
 * @module repositories/serverRepository
 */

const { dbGet, dbAll, dbRun } = require('../infrastructure/database');
const logger = require('../utils/logger');

/**
 * Get all servers
 * @returns {Promise<Array>}
 */
async function getAllServers() {
  try {
    return await dbAll('SELECT * FROM Server');
  } catch (err) {
    logger.error('❌ Error getting all servers:', err.message);
    throw err;
  }
}

/**
 * Get server by ID
 * @param {number} serverId
 * @returns {Promise<Object|null>}
 */
async function getServerById(serverId) {
  try {
    return await dbGet('SELECT * FROM Server WHERE id = ?', [serverId]);
  } catch (err) {
    logger.error('❌ Error getting server:', err.message);
    throw err;
  }
}

/**
 * Create new server
 * @param {Object} serverData
 * @returns {Promise<Object>}
 */
async function createServer(serverData) {
  const { domain, auth, harga, nama_server, quota, iplimit, batas_create_akun, isp, lokasi } = serverData;
  
  try {
    return await dbRun(`
      INSERT INTO Server 
      (domain, auth, harga, nama_server, quota, iplimit, batas_create_akun, isp, lokasi)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [domain, auth, harga, nama_server, quota, iplimit, batas_create_akun, isp || null, lokasi || null]);
  } catch (err) {
    logger.error('❌ Error creating server:', err.message);
    throw err;
  }
}

/**
 * Update server field
 * @param {number} serverId
 * @param {string} field
 * @param {any} value
 * @returns {Promise<Object>}
 */
async function updateServerField(serverId, field, value) {
  try {
    const query = `UPDATE Server SET ${field} = ? WHERE id = ?`;
    return await dbRun(query, [value, serverId]);
  } catch (err) {
    logger.error(`❌ Error updating server ${field}:`, err.message);
    throw err;
  }
}

/**
 * Increment server account count
 * @param {number} serverId
 * @returns {Promise<Object>}
 */
async function incrementAccountCount(serverId) {
  try {
    return await dbRun(
      'UPDATE Server SET total_create_akun = total_create_akun + 1 WHERE id = ?',
      [serverId]
    );
  } catch (err) {
    logger.error('❌ Error incrementing account count:', err.message);
    throw err;
  }
}

/**
 * Delete server
 * @param {number} serverId
 * @returns {Promise<Object>}
 */
async function deleteServer(serverId) {
  try {
    return await dbRun('DELETE FROM Server WHERE id = ?', [serverId]);
  } catch (err) {
    logger.error('❌ Error deleting server:', err.message);
    throw err;
  }
}

/**
 * Get server count
 * @returns {Promise<number>}
 */
async function getServerCount() {
  try {
    const result = await dbGet('SELECT COUNT(*) AS count FROM Server');
    return result?.count || 0;
  } catch (err) {
    logger.error('❌ Error getting server count:', err.message);
    throw err;
  }
}

/**
 * Get active server count
 * @returns {Promise<number>}
 */
async function getActiveServerCount() {
  try {
    const result = await dbGet(
      'SELECT COUNT(*) AS count FROM Server WHERE total_create_akun > 0'
    );
    return result?.count || 0;
  } catch (err) {
    logger.error('❌ Error getting active server count:', err.message);
    throw err;
  }
}

/**
 * Check if server is full
 * @param {number} serverId
 * @returns {Promise<boolean>}
 */
async function isServerFull(serverId) {
  try {
    const server = await getServerById(serverId);
    if (!server) return true;
    return server.total_create_akun >= server.batas_create_akun;
  } catch (err) {
    logger.error('❌ Error checking server capacity:', err.message);
    throw err;
  }
}

module.exports = {
  getAllServers,
  getServerById,
  createServer,
  updateServerField,
  incrementAccountCount,
  deleteServer,
  getServerCount,
  getActiveServerCount,
  isServerFull
};
