/**
 * Application Constants
 * Centralized configuration values and magic numbers
 */

export interface ResellerLevel {
  threshold: number;
  name: string;
  displayName: string;
}

export interface ResellerLevels {
  SILVER: ResellerLevel;
  GOLD: ResellerLevel;
  PLATINUM: ResellerLevel;
}

export interface DailyTrialLimits {
  user: number;
  reseller: number;
  admin: number;
}

export interface CronSchedules {
  RESET_DAILY_TRIALS: string;
  DAILY_RESTART: string;
  MONTHLY_COMMISSION_RESET: string;
}

export interface StatusEmoji {
  SUCCESS: string;
  ERROR: string;
  WARNING: string;
  PROCESSING: string;
  INFO: string;
  MONEY: string;
  ROCKET: string;
  LOCK: string;
  CHECK: string;
  CROSS: string;
}

export interface UserRoles {
  USER: string;
  RESELLER: string;
  ADMIN: string;
}

export interface VPNProtocols {
  SSH: string;
  VMESS: string;
  VLESS: string;
  TROJAN: string;
  SHADOWSOCKS: string;
}

export interface Constants {
  // Commission & Pricing
  COMMISSION_RATE: number;
  RESELLER_UPGRADE_COST: number;

  // Trial Configuration
  TRIAL_DURATION_MINUTES: number;
  DAILY_TRIAL_LIMITS: DailyTrialLimits;

  // Payment Configuration
  PAYMENT_QR_EXPIRY_MINUTES: number;
  PAYMENT_QR_EXPIRY_MS: number;
  PAYMENT_CHECK_INTERVAL_MS: number;

  // SSH Configuration
  SSH_TIMEOUT_MS: number;
  SSH_DEFAULT_USER: string;

  // Reseller Levels
  RESELLER_LEVELS: ResellerLevels;

  // User Roles
  USER_ROLES: UserRoles;

  // VPN Protocols
  VPN_PROTOCOLS: VPNProtocols;

  // Cache Configuration
  CACHE_TTL_MS: number;

  // File Paths
  TELEGRAM_UPLOAD_DIR: string;
  BACKUP_DIR: string;
  DB_PATH: string;
  UPLOAD_DIR: string;

  // Cron Schedules
  CRON_SCHEDULES: CronSchedules;

  // Pagination
  ITEMS_PER_PAGE: number;
  MAX_KEYBOARD_ROWS: number;

  // Validation Patterns
  USERNAME_PATTERN: RegExp;
  MIN_USERNAME_LENGTH: number;
  MAX_USERNAME_LENGTH: number;

  // Status Messages
  STATUS_EMOJI: StatusEmoji;
}

const constants: Constants = {
  // Commission & Pricing
  COMMISSION_RATE: 0.1,
  RESELLER_UPGRADE_COST: 50000,

  // Trial Configuration
  TRIAL_DURATION_MINUTES: 60,
  DAILY_TRIAL_LIMITS: {
    user: 1,
    reseller: 10,
    admin: Infinity
  },

  // Payment Configuration
  PAYMENT_QR_EXPIRY_MINUTES: 5,
  PAYMENT_QR_EXPIRY_MS: 5 * 60 * 1000,
  PAYMENT_CHECK_INTERVAL_MS: 10000, // 10 seconds

  // SSH Configuration
  SSH_TIMEOUT_MS: 35000,
  SSH_DEFAULT_USER: 'root',

  // Reseller Levels
  RESELLER_LEVELS: {
    SILVER: { threshold: 0, name: 'silver', displayName: 'Silver' },
    GOLD: { threshold: 50000, name: 'gold', displayName: 'Gold' },
    PLATINUM: { threshold: 80000, name: 'platinum', displayName: 'Platinum' }
  },

  // User Roles
  USER_ROLES: {
    USER: 'user',
    RESELLER: 'reseller',
    ADMIN: 'admin'
  },

  // VPN Protocols
  VPN_PROTOCOLS: {
    SSH: 'ssh',
    VMESS: 'vmess',
    VLESS: 'vless',
    TROJAN: 'trojan',
    SHADOWSOCKS: 'shadowsocks'
  },

  // Cache Configuration
  CACHE_TTL_MS: 60000, // 1 minute

  // File Paths
  TELEGRAM_UPLOAD_DIR: './data/uploaded_restore',
  BACKUP_DIR: './data/backups',
  DB_PATH: './data/botvpn.db',
  UPLOAD_DIR: './data/uploaded_restore',

  // Cron Schedules
  CRON_SCHEDULES: {
    RESET_DAILY_TRIALS: '0 0 * * *',         // Daily at 00:00
    DAILY_RESTART: '0 4 * * *',              // Daily at 04:00
    MONTHLY_COMMISSION_RESET: '0 1 1 * *'    // 1st of month at 01:00
  },

  // Pagination
  ITEMS_PER_PAGE: 10,
  MAX_KEYBOARD_ROWS: 8,

  // Validation Patterns
  USERNAME_PATTERN: /^[a-zA-Z0-9]+$/,
  MIN_USERNAME_LENGTH: 3,
  MAX_USERNAME_LENGTH: 20,

  // Status Messages
  STATUS_EMOJI: {
    SUCCESS: '✅',
    ERROR: '❌',
    WARNING: '⚠️',
    PROCESSING: '🔄',
    INFO: 'ℹ️',
    MONEY: '💰',
    ROCKET: '🚀',
    LOCK: '🔒',
    CHECK: '✔️',
    CROSS: '❌'
  }
};

module.exports = constants;
