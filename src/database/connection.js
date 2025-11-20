/**
 * Database Connection and Promisified Methods
 * Provides async/await interface for SQLite operations
 */

const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const logger = require('../utils/logger');

const DB_PATH = path.resolve('./botvpn.db');

// Initialize SQLite database
const db = new sqlite3.Database(DB_PATH, (err) => {
  if (err) {
    logger.error('SQLite3 connection error:', err.message);
  } else {
    logger.info('Connected to SQLite3');
  }
});

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
const dbTransaction = (callback) => new Promise((resolve, reject) => {
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
  dbTransaction
};
