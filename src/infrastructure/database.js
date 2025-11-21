/**
 * Database Infrastructure Layer
 * Provides database connection and promisified helper methods
 * @module infrastructure/database
 */

const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const logger = require('../utils/logger');

const DB_PATH = path.resolve(__dirname, '../../botvpn.db');

/**
 * Database instance
 * @type {sqlite3.Database}
 */
let db = null;

/**
 * Initialize database connection
 * @returns {Promise<sqlite3.Database>}
 */
async function initializeDatabase() {
  if (db) return db;

  return new Promise((resolve, reject) => {
    db = new sqlite3.Database(DB_PATH, (err) => {
      if (err) {
        logger.error('❌ Database connection error:', err.message);
        reject(err);
      } else {
        logger.info('✅ Connected to SQLite database');
        resolve(db);
      }
    });
  });
}

/**
 * Get database instance
 * @returns {sqlite3.Database}
 */
function getDatabase() {
  if (!db) {
    throw new Error('Database not initialized. Call initializeDatabase() first.');
  }
  return db;
}

/**
 * Execute a SELECT query that returns a single row
 * @param {string} sql - SQL query
 * @param {Array} params - Query parameters
 * @returns {Promise<Object|null>}
 */
async function dbGet(sql, params = []) {
  return new Promise((resolve, reject) => {
    getDatabase().get(sql, params, (err, row) => {
      if (err) {
        logger.error('❌ dbGet error:', err.message);
        reject(err);
      } else {
        resolve(row || null);
      }
    });
  });
}

/**
 * Execute a SELECT query that returns multiple rows
 * @param {string} sql - SQL query
 * @param {Array} params - Query parameters
 * @returns {Promise<Array>}
 */
async function dbAll(sql, params = []) {
  return new Promise((resolve, reject) => {
    getDatabase().all(sql, params, (err, rows) => {
      if (err) {
        logger.error('❌ dbAll error:', err.message);
        reject(err);
      } else {
        resolve(rows || []);
      }
    });
  });
}

/**
 * Execute an INSERT, UPDATE, or DELETE query
 * @param {string} sql - SQL query
 * @param {Array} params - Query parameters
 * @returns {Promise<Object>} Returns object with lastID and changes
 */
async function dbRun(sql, params = []) {
  return new Promise((resolve, reject) => {
    getDatabase().run(sql, params, function (err) {
      if (err) {
        logger.error('❌ dbRun error:', err.message);
        reject(err);
      } else {
        resolve({
          lastID: this.lastID,
          changes: this.changes
        });
      }
    });
  });
}

/**
 * Execute multiple SQL statements in a transaction
 * @param {Function} callback - Callback containing db operations
 * @returns {Promise<void>}
 */
async function dbSerialize(callback) {
  return new Promise((resolve, reject) => {
    getDatabase().serialize(() => {
      try {
        callback();
        resolve();
      } catch (err) {
        logger.error('❌ dbSerialize error:', err.message);
        reject(err);
      }
    });
  });
}

/**
 * Initialize database tables
 * @returns {Promise<void>}
 */
async function initializeTables() {
  const queries = [
    // Users table
    `CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER UNIQUE,
      saldo INTEGER DEFAULT 0,
      role TEXT DEFAULT 'user',
      reseller_level TEXT DEFAULT 'silver',
      has_trial INTEGER DEFAULT 0,
      username TEXT,
      first_name TEXT,
      last_trial_date TEXT,
      trial_count_today INTEGER DEFAULT 0
    )`,
    
    // Reseller sales table
    `CREATE TABLE IF NOT EXISTS reseller_sales (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      reseller_id INTEGER,
      buyer_id INTEGER,
      akun_type TEXT,
      username TEXT,
      komisi INTEGER,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP
    )`,
    
    // Active accounts table
    `CREATE TABLE IF NOT EXISTS akun_aktif (
      username TEXT PRIMARY KEY,
      jenis TEXT
    )`,
    
    // Invoice log table
    `CREATE TABLE IF NOT EXISTS invoice_log (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER,
      username TEXT,
      layanan TEXT,
      akun TEXT,
      hari INTEGER,
      harga INTEGER,
      komisi INTEGER,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP
    )`,
    
    // Pending deposits table
    `CREATE TABLE IF NOT EXISTS pending_deposits (
      unique_code TEXT PRIMARY KEY,
      user_id INTEGER,
      amount INTEGER,
      original_amount INTEGER,
      timestamp INTEGER,
      status TEXT,
      qr_message_id INTEGER
    )`,
    
    // Trial logs table
    `CREATE TABLE IF NOT EXISTS trial_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER,
      username TEXT,
      jenis TEXT,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP
    )`,
    
    // Server table
    `CREATE TABLE IF NOT EXISTS Server (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      domain TEXT,
      auth TEXT,
      harga INTEGER,
      nama_server TEXT,
      quota INTEGER,
      iplimit INTEGER,
      batas_create_akun INTEGER,
      total_create_akun INTEGER DEFAULT 0,
      isp TEXT,
      lokasi TEXT
    )`,
    
    // Transactions table
    `CREATE TABLE IF NOT EXISTS transactions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER,
      type TEXT,
      username TEXT,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP
    )`,
    
    // Saldo transfers table
    `CREATE TABLE IF NOT EXISTS saldo_transfers (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      from_id INTEGER,
      to_id INTEGER,
      amount INTEGER,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP
    )`,
    
    // Transfer log table
    `CREATE TABLE IF NOT EXISTS transfer_log (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      from_id INTEGER,
      to_id INTEGER,
      jumlah INTEGER,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP
    )`,
    
    // Topup log table
    `CREATE TABLE IF NOT EXISTS topup_log (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER,
      username TEXT,
      amount INTEGER,
      reference TEXT,
      created_at TEXT
    )`,
    
    // Accounts table
    `CREATE TABLE IF NOT EXISTS akun (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER,
      jenis TEXT,
      username TEXT,
      server_id INTEGER,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP
    )`,
    
    // Reseller upgrade log table
    `CREATE TABLE IF NOT EXISTS reseller_upgrade_log (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER,
      username TEXT,
      amount INTEGER,
      level TEXT,
      created_at TEXT
    )`,
    
    // Global stats table
    `CREATE TABLE IF NOT EXISTS global_stats (
      id INTEGER PRIMARY KEY,
      reseller_count INTEGER DEFAULT 0,
      total_akun INTEGER DEFAULT 0,
      total_servers INTEGER DEFAULT 0
    )`
  ];

  try {
    for (const query of queries) {
      await dbRun(query);
    }
    logger.info('✅ All database tables initialized');
  } catch (err) {
    logger.error('❌ Failed to initialize tables:', err.message);
    throw err;
  }
}

/**
 * Close database connection
 * @returns {Promise<void>}
 */
async function closeDatabase() {
  if (!db) return;
  
  return new Promise((resolve, reject) => {
    db.close((err) => {
      if (err) {
        logger.error('❌ Error closing database:', err.message);
        reject(err);
      } else {
        logger.info('✅ Database connection closed');
        db = null;
        resolve();
      }
    });
  });
}

module.exports = {
  initializeDatabase,
  getDatabase,
  dbGet,
  dbAll,
  dbRun,
  dbSerialize,
  initializeTables,
  closeDatabase
};
