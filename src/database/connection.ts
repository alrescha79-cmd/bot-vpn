
import type { BotContext, DatabaseUser, DatabaseServer } from "../types";
/**
 * Database Connection and Promisified Methods
 * Provides async/await interface for SQLite operations
 * Supports configurable database path for production deployment
 */

const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs');
const logger = require('../utils/logger');

// Database path can be configured via environment variable
// Default: ./data/botvpn.db (outside dist folder for production)
const DB_DIR = process.env.DB_DIR || path.resolve('./data');
const DB_PATH = process.env.DB_PATH || path.join(DB_DIR, 'botvpn.db');

// Ensure database directory exists
if (!fs.existsSync(DB_DIR)) {
  fs.mkdirSync(DB_DIR, { recursive: true });
  logger.info(`✅ Created database directory: ${DB_DIR}`);
}

// Check if database exists (for first-time initialization)
const dbExists = fs.existsSync(DB_PATH);

// Initialize SQLite database
const db = new sqlite3.Database(DB_PATH, (err) => {
  if (err) {
    logger.error('SQLite3 connection error:', err.message);
  } else {
    if (!dbExists) {
      logger.info('🆕 Creating new database at:', DB_PATH);
    } else {
      logger.info('✅ Connected to SQLite3 at:', DB_PATH);
    }
  }
});

/**
 * Check if database is newly created (empty)
 */
const isNewDatabase = (): boolean => !dbExists;

/**
 * Promisified db.get() - fetches a single row
 * @param {string} sql - SQL query
 * @param {Array} params - Query parameters
 * @returns {Promise<Object|undefined>}
 */
const dbGetAsync = (sql, params = []) => new Promise((resolve, reject) => {
  db.get(sql, params, (err, row) => (err ? reject(err) : resolve(row)));
});

/**
 * Promisified db.all() - fetches all rows
 * @param {string} sql - SQL query
 * @param {Array} params - Query parameters
 * @returns {Promise<Array>}
 */
const dbAllAsync = (sql, params = []) => new Promise((resolve, reject) => {
  db.all(sql, params, (err, rows) => (err ? reject(err) : resolve(rows)));
});

/**
 * Promisified db.run() - executes INSERT/UPDATE/DELETE
 * @param {string} sql - SQL query
 * @param {Array} params - Query parameters
 * @returns {Promise<Object>} - Returns {lastID, changes}
 */
const dbRunAsync = (sql, params = []) => new Promise((resolve, reject) => {
  db.run(sql, params, function (err) {
    if (err) reject(err);
    else resolve(this);
  });
});

/**
 * Execute multiple queries in a transaction
 * @param {Function} callback - Callback function with db.serialize
 * @returns {Promise<void>}
 */
const dbTransaction = (callback) => new Promise<void>((resolve, reject) => {
  db.serialize(() => {
    try {
      callback();
      resolve();
    } catch (err) {
      reject(err);
    }
  });
});

module.exports = {
  db,
  dbGetAsync,
  dbAllAsync,
  dbRunAsync,
  dbTransaction,
  isNewDatabase,
  DB_PATH
};
