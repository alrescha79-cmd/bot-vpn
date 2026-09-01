/**
 * Configuration loader
 * Loads and exports configuration from environment variables (.env) or .vars.json
 * Supports setup mode when config doesn't exist
 */

import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';

// Load .env if present
dotenv.config();

export interface VarsConfig {
  BOT_TOKEN?: string;
  USER_ID?: number | number[] | string;
  ADMIN_USERNAME?: string;
  GROUP_ID?: string;
  PORT?: number | string;
  NAMA_STORE?: string;
  DATA_QRIS?: string;
  MERCHANT_ID?: string;
  SERVER_KEY?: string;
  SSH_USER?: string;
  SSH_PASS?: string;
  // Pakasir Payment Gateway (supports both PAKASIR_PROJECT and PAKASIR_SLUG)
  PAKASIR_PROJECT?: string;
  PAKASIR_SLUG?: string;
  PAKASIR_API_KEY?: string;
  // Tripay Payment Gateway
  TRIPAY_API_KEY?: string;
  TRIPAY_PRIVATE_KEY?: string;
  TRIPAY_MERCHANT_CODE?: string;
  TRIPAY_ENV?: 'sandbox' | 'production' | string;
  // Duitku Payment Gateway
  DUITKU_MERCHANT_CODE?: string;
  DUITKU_API_KEY?: string;
  DUITKU_ENV?: 'sandbox' | 'production' | string;
}

export interface Config {
  // Bot Configuration
  BOT_TOKEN: string;

  // Admin Configuration
  USER_ID: number | number[];
  ADMIN_USERNAME: string;

  // Group Configuration
  GROUP_ID: string;

  // Server Configuration
  PORT: number;

  // Store Configuration
  NAMA_STORE: string;

  // QRIS Payment Configuration
  DATA_QRIS: string;
  MERCHANT_ID: string;
  SERVER_KEY: string;

  // Pakasir Payment Gateway Configuration
  PAKASIR_PROJECT: string;
  PAKASIR_API_KEY: string;

  // Tripay Payment Gateway Configuration
  TRIPAY_API_KEY: string;
  TRIPAY_PRIVATE_KEY: string;
  TRIPAY_MERCHANT_CODE: string;
  TRIPAY_ENV: 'sandbox' | 'production';

  // Duitku Payment Gateway Configuration
  DUITKU_MERCHANT_CODE: string;
  DUITKU_API_KEY: string;
  DUITKU_ENV: 'sandbox' | 'production';

  // SSH Configuration
  SSH_USER: string;
  SSH_PASS: string;

  // Computed values
  adminIds: string[];
  ADMIN_IDS: number[];

  // Setup mode flag
  isSetupMode: boolean;
}

/**
 * Helper to parse USER_ID from diverse formats (number, string, array, comma-separated)
 */
function parseUserIds(raw: any): number[] {
  if (!raw) return [];
  if (Array.isArray(raw)) {
    return raw.map(id => Number(id)).filter(id => !isNaN(id) && id > 0);
  }
  if (typeof raw === 'number') {
    return raw > 0 ? [raw] : [];
  }
  if (typeof raw === 'string') {
    return raw
      .split(',')
      .map(id => Number(id.trim()))
      .filter(id => !isNaN(id) && id > 0);
  }
  return [];
}

/**
 * Load configuration with setup mode support and .env fallback
 */
function loadConfig(): Config {
  const varsPath: string = path.resolve('./.vars.json');
  let vars: VarsConfig = {};

  if (fs.existsSync(varsPath)) {
    try {
      vars = JSON.parse(fs.readFileSync(varsPath, 'utf8'));
    } catch (e) {
      console.error('⚠️ Failed to parse .vars.json, falling back to process.env');
    }
  }

  // Environment variables take precedence or provide fallbacks
  const BOT_TOKEN = vars.BOT_TOKEN || process.env.BOT_TOKEN || '';
  const rawUserId = vars.USER_ID || process.env.USER_ID || process.env.ADMIN_IDS || '';
  const ADMIN_IDS = parseUserIds(rawUserId);
  const primaryUserId = ADMIN_IDS.length > 0 ? ADMIN_IDS[0] : 0;
  const adminIds = ADMIN_IDS.map(String);

  const ADMIN_USERNAME = vars.ADMIN_USERNAME || process.env.ADMIN_USERNAME || 'Admin';
  const GROUP_ID = vars.GROUP_ID || process.env.GROUP_ID || '';
  const PORT = Number(vars.PORT || process.env.PORT) || 50123;
  const NAMA_STORE = vars.NAMA_STORE || process.env.NAMA_STORE || 'Bot VPN Store';

  // QRIS & Midtrans
  const DATA_QRIS = vars.DATA_QRIS || process.env.DATA_QRIS || '';
  const MERCHANT_ID = vars.MERCHANT_ID || process.env.MERCHANT_ID || process.env.MIDTRANS_MERCHANT_ID || '';
  const SERVER_KEY = vars.SERVER_KEY || process.env.SERVER_KEY || process.env.MIDTRANS_SERVER_KEY || '';

  // Pakasir
  const PAKASIR_PROJECT = vars.PAKASIR_PROJECT || vars.PAKASIR_SLUG || process.env.PAKASIR_PROJECT || process.env.PAKASIR_SLUG || '';
  const PAKASIR_API_KEY = vars.PAKASIR_API_KEY || process.env.PAKASIR_API_KEY || '';

  // Tripay
  const TRIPAY_API_KEY = vars.TRIPAY_API_KEY || process.env.TRIPAY_API_KEY || '';
  const TRIPAY_PRIVATE_KEY = vars.TRIPAY_PRIVATE_KEY || process.env.TRIPAY_PRIVATE_KEY || '';
  const TRIPAY_MERCHANT_CODE = vars.TRIPAY_MERCHANT_CODE || process.env.TRIPAY_MERCHANT_CODE || '';
  const TRIPAY_ENV = (vars.TRIPAY_ENV || process.env.TRIPAY_ENV || 'production').toLowerCase() === 'sandbox' ? 'sandbox' : 'production';

  // Duitku
  const DUITKU_MERCHANT_CODE = vars.DUITKU_MERCHANT_CODE || process.env.DUITKU_MERCHANT_CODE || '';
  const DUITKU_API_KEY = vars.DUITKU_API_KEY || process.env.DUITKU_API_KEY || '';
  const DUITKU_ENV = (vars.DUITKU_ENV || process.env.DUITKU_ENV || 'production').toLowerCase() === 'sandbox' ? 'sandbox' : 'production';

  // SSH
  const SSH_USER = vars.SSH_USER || process.env.SSH_USER || 'root';
  const SSH_PASS = vars.SSH_PASS || process.env.SSH_PASS || '';

  // Setup mode check: Must have BOT_TOKEN and at least one ADMIN_ID
  const isSetup = !BOT_TOKEN || ADMIN_IDS.length === 0;

  return {
    BOT_TOKEN,
    USER_ID: ADMIN_IDS.length > 1 ? ADMIN_IDS : primaryUserId,
    ADMIN_USERNAME,
    GROUP_ID,
    PORT,
    NAMA_STORE,
    DATA_QRIS,
    MERCHANT_ID,
    SERVER_KEY,
    PAKASIR_PROJECT,
    PAKASIR_API_KEY,
    TRIPAY_API_KEY,
    TRIPAY_PRIVATE_KEY,
    TRIPAY_MERCHANT_CODE,
    TRIPAY_ENV,
    DUITKU_MERCHANT_CODE,
    DUITKU_API_KEY,
    DUITKU_ENV,
    SSH_USER,
    SSH_PASS,
    adminIds,
    ADMIN_IDS,
    isSetupMode: isSetup
  };
}

const config = loadConfig();

// Export for both CommonJS and ES modules
export default config;
module.exports = config;
module.exports.default = config;
