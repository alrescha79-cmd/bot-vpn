
import type { BotContext, DatabaseUser, DatabaseServer } from "../types";
/**
 * Database Schema Initialization
 * Creates all necessary tables for the application
 * Production-ready with proper error handling and logging
 */

const { dbRunAsync, isNewDatabase } = require('./connection');
const logger = require('../utils/logger');

/**
 * Initialize all database tables
 * @returns {Promise<void>}
 */
async function initializeSchema() {
  const isNew = isNewDatabase();

  if (isNew) {
    logger.info('🆕 Initializing new database schema...');
  }

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

    // Add columns if not exists (for migration from older versions)
    const addColumnSafely = async (table: string, column: string, definition: string) => {
      try {
        await dbRunAsync(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`);
      } catch (err: any) {
        // Ignore "duplicate column" errors
        if (!err.message.includes('duplicate column')) {
          throw err;
        }
      }
    };

    await addColumnSafely('users', 'username', 'TEXT');
    await addColumnSafely('users', 'trial_count_today', 'INTEGER DEFAULT 0');
    await addColumnSafely('users', 'last_trial_date', 'TEXT');

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
      qr_message_id INTEGER,
      payment_method TEXT DEFAULT 'midtrans',
      proof_image_id TEXT,
      admin_approved_by INTEGER,
      admin_approved_at TEXT,
      admin_notes TEXT
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
      total_create_akun INTEGER DEFAULT 0,
      isp TEXT DEFAULT 'Tidak diketahui',
      lokasi TEXT DEFAULT 'Tidak diketahui',
      created_at TEXT DEFAULT CURRENT_TIMESTAMP
    )`);

    // Add missing columns to Server table (migration)
    await addColumnSafely('Server', 'isp', "TEXT DEFAULT 'Tidak diketahui'");
    await addColumnSafely('Server', 'lokasi', "TEXT DEFAULT 'Tidak diketahui'");
    await addColumnSafely('Server', 'created_at', 'TEXT DEFAULT CURRENT_TIMESTAMP');

    // Transactions table
    await dbRunAsync(`CREATE TABLE IF NOT EXISTS transactions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER,
      type TEXT,
      amount INTEGER,
      description TEXT,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP
    )`);

    // Topup Log table
    await dbRunAsync(`CREATE TABLE IF NOT EXISTS topup_log (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER,
      username TEXT,
      amount INTEGER,
      reference TEXT,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP
    )`);

    // Migrate pending_deposits table - add new columns if they don't exist
    await addColumnSafely('pending_deposits', 'payment_method', "TEXT DEFAULT 'midtrans'");
    await addColumnSafely('pending_deposits', 'proof_image_id', 'TEXT');
    await addColumnSafely('pending_deposits', 'admin_approved_by', 'INTEGER');
    await addColumnSafely('pending_deposits', 'admin_approved_at', 'TEXT');
    await addColumnSafely('pending_deposits', 'admin_notes', 'TEXT');

    // Accounts table - stores created premium accounts
    await dbRunAsync(`CREATE TABLE IF NOT EXISTS accounts (
      id TEXT PRIMARY KEY,
      username TEXT NOT NULL,
      protocol TEXT NOT NULL,
      server TEXT NOT NULL,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      expired_at TEXT,
      owner_user_id INTEGER NOT NULL,
      status TEXT DEFAULT 'active',
      raw_response TEXT,
      expiry_warning_3d_sent INTEGER DEFAULT 0,
      expiry_warning_1d_sent INTEGER DEFAULT 0,
      expired_notified INTEGER DEFAULT 0,
      UNIQUE(username, server, protocol)
    )`);

    // Migrate accounts table - add notification tracking columns
    await addColumnSafely('accounts', 'expiry_warning_3d_sent', 'INTEGER DEFAULT 0');
    await addColumnSafely('accounts', 'expiry_warning_1d_sent', 'INTEGER DEFAULT 0');
    await addColumnSafely('accounts', 'expired_notified', 'INTEGER DEFAULT 0');

    // Add indexes for accounts table
    await dbRunAsync(`CREATE INDEX IF NOT EXISTS idx_accounts_username ON accounts(username)`);
    await dbRunAsync(`CREATE INDEX IF NOT EXISTS idx_accounts_owner ON accounts(owner_user_id)`);
    await dbRunAsync(`CREATE INDEX IF NOT EXISTS idx_accounts_status ON accounts(status)`);
    await dbRunAsync(`CREATE INDEX IF NOT EXISTS idx_accounts_expired_at ON accounts(expired_at)`);

    if (isNew) {
      logger.info('✅ New database schema initialized successfully');
      logger.info('ℹ️  Database is ready with empty tables (no seed data)');
    } else {
      logger.info('✅ Database schema verified/updated successfully');
    }
  } catch (error: any) {
    logger.error('❌ Failed to initialize database schema:', error.message);
    throw error;
  }
}

module.exports = { initializeSchema };
