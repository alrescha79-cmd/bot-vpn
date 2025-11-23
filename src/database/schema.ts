
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
