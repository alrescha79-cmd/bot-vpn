/**
 * Cache Management Module
 * Provides in-memory caching for frequently accessed data
 * @module infrastructure/cache
 */

const logger = require('../utils/logger');

export interface SystemStatus {
  jumlahServer: number;
  jumlahPengguna: number;
  lastUpdated: number;
}

export interface UserSession {
  [key: string]: any;
  timestamp: number;
}

export interface CacheStore {
  systemStatus: SystemStatus;
  userSessions: Map<number, UserSession>;
  serverList: any[] | null;
  serverListExpiry: number;
}

export interface CacheTTL {
  SYSTEM_STATUS: number;
  SERVER_LIST: number;
  USER_SESSION: number;
}

export interface CacheStats {
  systemStatus: SystemStatus;
  serverListCached: boolean;
  activeSessions: number;
}

/**
 * Cache store
 */
const cache: CacheStore = {
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
export const TTL: CacheTTL = {
  SYSTEM_STATUS: 60 * 1000, // 1 minute
  SERVER_LIST: 5 * 60 * 1000, // 5 minutes
  USER_SESSION: 30 * 60 * 1000 // 30 minutes
};

/**
 * Get system status from cache
 * @returns {SystemStatus|null}
 */
export function getSystemStatus(): SystemStatus | null {
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
export function setSystemStatus(jumlahServer: number, jumlahPengguna: number): void {
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
export function getServerList(): any[] | null {
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
export function setServerList(servers: any[]): void {
  cache.serverList = servers;
  cache.serverListExpiry = Date.now() + TTL.SERVER_LIST;
  logger.debug('✅ Server list cache updated');
}

/**
 * Get user session
 * @param {number} chatId
 * @returns {UserSession|null}
 */
export function getUserSession(chatId: number): UserSession | null {
  return cache.userSessions.get(chatId) || null;
}

/**
 * Set user session
 * @param {number} chatId
 * @param {Object} data
 */
export function setUserSession(chatId: number, data: any): void {
  cache.userSessions.set(chatId, {
    ...data,
    timestamp: Date.now()
  });
}

/**
 * Delete user session
 * @param {number} chatId
 */
export function deleteUserSession(chatId: number): void {
  cache.userSessions.delete(chatId);
}

/**
 * Clear expired user sessions
 */
export function clearExpiredSessions(): void {
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
export function clearAllCache(): void {
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
 * @returns {CacheStats}
 */
export function getCacheStats(): CacheStats {
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
