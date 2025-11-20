/**
 * Database Schema Initialization
 * Creates all necessary tables for the application
 */

const { dbRunAsync } = require('./connection');
const logger = require('../utils/logger');

/**
 * Initialize all database tables
 * @returns {Promise<void>}
 */
async function initializeSchema() {
  try {
    // Users table
    await dbRunAsync(`CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER UNIQUE,
      saldo INTEGER DEFAULT 0,
      role TEXT DEFAULT 'user',
      reseller_level TEXT DEFAULT 'silver',
      has_trial INTEGER DEFAULT 0,
      username TEXT,
      first_name TEXT,
      trial_count_today INTEGER DEFAULT 0,
      last_trial_date TEXT
    )`);

    // Add columns if not exists (for migration)
    await dbRunAsync(`ALTER TABLE users ADD COLUMN username TEXT`).catch(() => {});
    await dbRunAsync(`ALTER TABLE users ADD COLUMN trial_count_today INTEGER DEFAULT 0`).catch(() => {});
    await dbRunAsync(`ALTER TABLE users ADD COLUMN last_trial_date TEXT`).catch(() => {});

    // Reseller Sales table
    await dbRunAsync(`CREATE TABLE IF NOT EXISTS reseller_sales (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      reseller_id INTEGER,
      buyer_id INTEGER,
      akun_type TEXT,
      username TEXT,
      komisi INTEGER,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP
    )`);

    // Reseller Upgrade Log table
    await dbRunAsync(`CREATE TABLE IF NOT EXISTS reseller_upgrade_log (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER,
      username TEXT,
      amount INTEGER,
      level TEXT,
      created_at TEXT
    )`);

    // Active Accounts table
    await dbRunAsync(`CREATE TABLE IF NOT EXISTS akun_aktif (
      username TEXT PRIMARY KEY,
      jenis TEXT
    )`);

    // Invoice Log table
    await dbRunAsync(`CREATE TABLE IF NOT EXISTS invoice_log (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER,
      username TEXT,
      layanan TEXT,
      akun TEXT,
      hari INTEGER,
      harga INTEGER,
      komisi INTEGER,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP
    )`);

    // Pending Deposits table
    await dbRunAsync(`CREATE TABLE IF NOT EXISTS pending_deposits (
      unique_code TEXT PRIMARY KEY,
      user_id INTEGER,
      amount INTEGER,
      original_amount INTEGER,
      timestamp INTEGER,
      status TEXT,
      qr_message_id INTEGER
    )`);

    // Trial Logs table
    await dbRunAsync(`CREATE TABLE IF NOT EXISTS trial_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER,
      username TEXT,
      jenis TEXT,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP
    )`);

    // Server table
    await dbRunAsync(`CREATE TABLE IF NOT EXISTS Server (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      domain TEXT,
      auth TEXT,
      harga INTEGER,
      nama_server TEXT,
      quota INTEGER,
      iplimit INTEGER,
      batas_create_akun INTEGER,
      total_create_akun INTEGER DEFAULT 0
    )`);

    // Transactions table
    await dbRunAsync(`CREATE TABLE IF NOT EXISTS transactions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER,
      type TEXT,
      amount INTEGER,
      description TEXT,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP
    )`);

    logger.info('✅ Database schema initialized successfully');
  } catch (error) {
    logger.error('❌ Failed to initialize database schema:', error.message);
    throw error;
  }
}

module.exports = { initializeSchema };
