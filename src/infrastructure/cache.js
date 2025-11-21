/**
 * Cache Management Module
 * Provides in-memory caching for frequently accessed data
 * @module infrastructure/cache
 */

const logger = require('../utils/logger');

/**
 * Cache store
 */
const cache = {
  systemStatus: {
    jumlahServer: 0,
    jumlahPengguna: 0,
    lastUpdated: 0
  },
  userSessions: new Map(),
  serverList: null,
  serverListExpiry: 0
};

/**
 * Cache TTL constants (in milliseconds)
 */
const TTL = {
  SYSTEM_STATUS: 60 * 1000, // 1 minute
  SERVER_LIST: 5 * 60 * 1000, // 5 minutes
  USER_SESSION: 30 * 60 * 1000 // 30 minutes
};

/**
 * Get system status from cache
 * @returns {Object|null}
 */
function getSystemStatus() {
  const now = Date.now();
  if (now - cache.systemStatus.lastUpdated < TTL.SYSTEM_STATUS) {
    return cache.systemStatus;
  }
  return null;
}

/**
 * Set system status in cache
 * @param {number} jumlahServer
 * @param {number} jumlahPengguna
 */
function setSystemStatus(jumlahServer, jumlahPengguna) {
  cache.systemStatus = {
    jumlahServer,
    jumlahPengguna,
    lastUpdated: Date.now()
  };
  logger.debug('✅ System status cache updated');
}

/**
 * Get server list from cache
 * @returns {Array|null}
 */
function getServerList() {
  const now = Date.now();
  if (cache.serverList && now < cache.serverListExpiry) {
    return cache.serverList;
  }
  return null;
}

/**
 * Set server list in cache
 * @param {Array} servers
 */
function setServerList(servers) {
  cache.serverList = servers;
  cache.serverListExpiry = Date.now() + TTL.SERVER_LIST;
  logger.debug('✅ Server list cache updated');
}

/**
 * Get user session
 * @param {number} chatId
 * @returns {Object|null}
 */
function getUserSession(chatId) {
  return cache.userSessions.get(chatId) || null;
}

/**
 * Set user session
 * @param {number} chatId
 * @param {Object} data
 */
function setUserSession(chatId, data) {
  cache.userSessions.set(chatId, {
    ...data,
    timestamp: Date.now()
  });
}

/**
 * Delete user session
 * @param {number} chatId
 */
function deleteUserSession(chatId) {
  cache.userSessions.delete(chatId);
}

/**
 * Clear expired user sessions
 */
function clearExpiredSessions() {
  const now = Date.now();
  for (const [chatId, session] of cache.userSessions.entries()) {
    if (now - session.timestamp > TTL.USER_SESSION) {
      cache.userSessions.delete(chatId);
    }
  }
  logger.debug(`✅ Cleared expired sessions. Active: ${cache.userSessions.size}`);
}

/**
 * Clear all cache
 */
function clearAllCache() {
  cache.systemStatus = {
    jumlahServer: 0,
    jumlahPengguna: 0,
    lastUpdated: 0
  };
  cache.serverList = null;
  cache.serverListExpiry = 0;
  cache.userSessions.clear();
  logger.info('✅ All cache cleared');
}

/**
 * Get cache statistics
 * @returns {Object}
 */
function getCacheStats() {
  return {
    systemStatus: cache.systemStatus,
    serverListCached: !!cache.serverList,
    activeSessions: cache.userSessions.size
  };
}

module.exports = {
  getSystemStatus,
  setSystemStatus,
  getServerList,
  setServerList,
  getUserSession,
  setUserSession,
  deleteUserSession,
  clearExpiredSessions,
  clearAllCache,
  getCacheStats,
  TTL
};
