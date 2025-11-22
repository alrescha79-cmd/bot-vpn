/**
 * Helper Utilities
 * General purpose helper functions
 * @module utils/helpers
 */

import { promises as dns } from 'dns';
import axios from 'axios';
const logger = require('./logger');

export interface ISPLocationInfo {
  isp: string;
  country: string;
  city: string;
  location: string;
}

export interface RandomAmount {
  finalAmount: number;
  uniqueCode: number;
}

/**
 * Get flag emoji by location
 * @param {string} location - Location name (e.g., "Jakarta, ID" or "Singapore")
 * @returns {string}
 */
export function getFlagEmoji(location: string): string {
  if (!location) return '🌐';
  
  const locationLower = location.toLowerCase().trim();
  
  // Map country/city names and country codes to flag emojis
  const countryMap: Record<string, string> = {
    // Singapore
    'singapore': '🇸🇬',
    'sg': '🇸🇬',
    ', sg': '🇸🇬',
    
    // Indonesia
    'indonesia': '🇮🇩',
    'id': '🇮🇩',
    ', id': '🇮🇩',
    'jakarta': '🇮🇩',
    'surabaya': '🇮🇩',
    'bandung': '🇮🇩',
    
    // Japan
    'japan': '🇯🇵',
    'jp': '🇯🇵',
    ', jp': '🇯🇵',
    'tokyo': '🇯🇵',
    'osaka': '🇯🇵',
    
    // USA
    'usa': '🇺🇸',
    'us': '🇺🇸',
    ', us': '🇺🇸',
    'united states': '🇺🇸',
    'america': '🇺🇸',
    'new york': '🇺🇸',
    'california': '🇺🇸',
    'miami': '🇺🇸',
    'los angeles': '🇺🇸',
    
    // Germany
    'germany': '🇩🇪',
    'de': '🇩🇪',
    ', de': '🇩🇪',
    'berlin': '🇩🇪',
    'frankfurt': '🇩🇪',
    
    // Malaysia
    'malaysia': '🇲🇾',
    'my': '🇲🇾',
    ', my': '🇲🇾',
    'kuala lumpur': '🇲🇾',
    
    // France
    'france': '🇫🇷',
    'fr': '🇫🇷',
    ', fr': '🇫🇷',
    'paris': '🇫🇷',
    
    // Netherlands
    'netherlands': '🇳🇱',
    'nl': '🇳🇱',
    ', nl': '🇳🇱',
    'amsterdam': '🇳🇱',
    
    // United Kingdom
    'united kingdom': '🇬🇧',
    'uk': '🇬🇧',
    'gb': '🇬🇧',
    ', gb': '🇬🇧',
    ', uk': '🇬🇧',
    'england': '🇬🇧',
    'london': '🇬🇧',
    
    // India
    'india': '🇮🇳',
    'in': '🇮🇳',
    ', in': '🇮🇳',
    'mumbai': '🇮🇳',
    'delhi': '🇮🇳',
    
    // Thailand
    'thailand': '🇹🇭',
    'th': '🇹🇭',
    ', th': '🇹🇭',
    'bangkok': '🇹🇭',
    
    // Hong Kong
    'hong kong': '🇭🇰',
    'hk': '🇭🇰',
    ', hk': '🇭🇰',
    'hongkong': '🇭🇰',
    
    // Australia
    'australia': '🇦🇺',
    'au': '🇦🇺',
    ', au': '🇦🇺',
    'sydney': '🇦🇺',
    
    // Canada
    'canada': '🇨🇦',
    'ca': '🇨🇦',
    ', ca': '🇨🇦',
    'toronto': '🇨🇦',
    
    // South Korea
    'korea': '🇰🇷',
    'kr': '🇰🇷',
    ', kr': '🇰🇷',
    'south korea': '🇰🇷',
    'seoul': '🇰🇷',
    
    // Vietnam
    'vietnam': '🇻🇳',
    'vn': '🇻🇳',
    ', vn': '🇻🇳',
    'hanoi': '🇻🇳',
    
    // Philippines
    'philippines': '🇵🇭',
    'ph': '🇵🇭',
    ', ph': '🇵🇭',
    'manila': '🇵🇭',
    
    // Taiwan
    'taiwan': '🇹🇼',
    'tw': '🇹🇼',
    ', tw': '🇹🇼',
    
    // China
    'china': '🇨🇳',
    'cn': '🇨🇳',
    ', cn': '🇨🇳'
  };
  
  // Check for exact match or partial match
  for (const [key, flag] of Object.entries(countryMap)) {
    if (locationLower.includes(key)) {
      return flag;
    }
  }
  
  return '🌐';
}

/**
 * Parse JSON from command output
 * @param {string} raw - Raw output string
 * @returns {Object}
 * @throws {Error}
 */
export function parseJsonOutput(raw: string): any {
  try {
    const start = raw.indexOf('{');
    const end = raw.lastIndexOf('}');
    if (start !== -1 && end !== -1) {
      return JSON.parse(raw.substring(start, end + 1));
    }
    throw new Error('Output tidak mengandung JSON');
  } catch (e: any) {
    throw new Error('Gagal parsing JSON: ' + e.message);
  }
}

/**
 * Resolve domain to IP address
 * @param {string} domain
 * @returns {Promise<string>}
 */
export async function resolveDomainToIP(domain: string): Promise<string> {
  try {
    // Remove protocol if present
    const cleanDomain = domain.replace(/^https?:\/\//, '').split(':')[0];
    const addresses = await dns.resolve4(cleanDomain);
    return addresses[0];
  } catch (err: any) {
    logger.error(`❌ Failed to resolve domain ${domain}:`, err.message);
    throw new Error(`Failed to resolve domain: ${domain}`);
  }
}

/**
 * Get ISP and location info from IP
 * @param {string} ip
 * @returns {Promise<ISPLocationInfo>}
 */
export async function getISPAndLocation(ip: string): Promise<ISPLocationInfo> {
  try {
    const response = await axios.get(`http://ip-api.com/json/${ip}`);
    const data = response.data;
    
    return {
      isp: data.isp || 'Unknown',
      country: data.country || 'Unknown',
      city: data.city || 'Unknown',
      location: `${data.city}, ${data.countryCode}` || 'Unknown'
    };
  } catch (err: any) {
    logger.error(`❌ Failed to get ISP info for ${ip}:`, err.message);
    return {
      isp: 'Unknown',
      country: 'Unknown',
      city: 'Unknown',
      location: 'Unknown'
    };
  }
}

/**
 * Generate random amount with unique code
 * @param {number} baseAmount - Base amount
 * @returns {RandomAmount} Returns {finalAmount, uniqueCode}
 */
export function generateRandomAmount(baseAmount: number): RandomAmount {
  const uniqueCode = Math.floor(100 + Math.random() * 900);
  const finalAmount = baseAmount + uniqueCode;
  return { finalAmount, uniqueCode };
}

/**
 * Safe send message to Telegram
 * @param {Object} bot - Bot instance
 * @param {number} chatId
 * @param {string} message
 * @param {Object} extra - Extra options
 * @returns {Promise<void>}
 */
export async function safeSend(bot: any, chatId: number, message: string, extra: any = {}): Promise<void> {
  try {
    await bot.telegram.sendMessage(chatId, message, extra);
  } catch (err: any) {
    logger.warn(`⚠️ Failed to send message to ${chatId}: ${err.message}`);
  }
}

/**
 * Format uptime to readable string
 * @param {number} seconds - Uptime in seconds
 * @returns {string}
 */
export function formatUptime(seconds: number): string {
  const days = Math.floor(seconds / 86400);
  const hours = Math.floor((seconds % 86400) / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  
  const parts: string[] = [];
  if (days > 0) parts.push(`${days}d`);
  if (hours > 0) parts.push(`${hours}h`);
  if (minutes > 0) parts.push(`${minutes}m`);
  
  return parts.join(' ') || '0m';
}

/**
 * Sleep/delay function
 * @param {number} ms - Milliseconds to wait
 * @returns {Promise<void>}
 */
export function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Validate SQLite database file
 * @param {string} filePath
 * @returns {boolean}
 */
export function isValidSQLiteDB(filePath: string): boolean {
  try {
    const fs = require('fs');
    if (!fs.existsSync(filePath)) return false;
    
    const buffer = Buffer.alloc(16);
    const fd = fs.openSync(filePath, 'r');
    fs.readSync(fd, buffer, 0, 16, 0);
    fs.closeSync(fd);
    
    const header = buffer.toString('utf8', 0, 15);
    return header === 'SQLite format 3';
  } catch (err) {
    return false;
  }
}

/**
 * Validate SQL dump file
 * @param {string} filePath
 * @returns {boolean}
 */
export function isValidSQLDump(filePath: string): boolean {
  try {
    const fs = require('fs');
    if (!fs.existsSync(filePath)) return false;
    
    const content = fs.readFileSync(filePath, 'utf8');
    return content.includes('CREATE TABLE') || content.includes('INSERT INTO');
  } catch (err) {
    return false;
  }
}

/**
 * Calculate reseller level based on total commission
 * @param {number} totalCommission
 * @returns {string} 'silver', 'gold', or 'platinum'
 */
export function calculateResellerLevel(totalCommission: number): string {
  if (totalCommission >= 80000) return 'platinum';
  if (totalCommission >= 50000) return 'gold';
  return 'silver';
}

/**
 * Get level priority for comparison
 * @param {string} level
 * @returns {number}
 */
export function getLevelPriority(level: string): number {
  const levels: Record<string, number> = { silver: 1, gold: 2, platinum: 3 };
  return levels[level] || 0;
}

/**
 * Calculate discount based on reseller level
 * @param {string} level
 * @returns {number} Discount multiplier (0.0 - 1.0)
 */
export function getResellerDiscount(level: string): number {
  const discounts: Record<string, number> = {
    platinum: 0.3,
    gold: 0.2,
    silver: 0.1
  };
  return discounts[level] || 0;
}

/**
 * Get trial limit based on user role
 * @param {string} role
 * @returns {number}
 */
export function getTrialLimit(role: string): number {
  if (role === 'admin') return Infinity;
  if (role === 'reseller') return 10;
  return 1;
}

/**
 * Cleanup orphan resellers from reseller_sales table
 * Removes sales records for resellers that no longer exist in users table
 * @returns {Promise<number>} Number of rows cleaned up
 */
export async function cleanupOrphanResellers(): Promise<number> {
  const { dbAll, dbRun } = require('../infrastructure/database');
  
  try {
    const rows = await dbAll(`
      SELECT DISTINCT reseller_id FROM reseller_sales
      WHERE reseller_id NOT IN (SELECT user_id FROM users)
    `);

    if (rows.length === 0) {
      logger.info('✅ No orphan resellers found');
      return 0;
    }

    const orphanIds = rows.map((row: any) => row.reseller_id);
    logger.warn(`⚠️ Found ${orphanIds.length} orphan reseller(s): ${orphanIds.join(', ')}`);

    const placeholders = orphanIds.map(() => '?').join(',');
    const result = await dbRun(`
      DELETE FROM reseller_sales WHERE reseller_id IN (${placeholders})
    `, orphanIds);

    logger.info(`✅ Cleaned up ${result.changes} reseller_sales row(s)`);
    return result.changes;
  } catch (err: any) {
    logger.error('❌ Failed to cleanup orphan resellers:', err.message);
    return 0;
  }
}

/**
 * Validate username format
 * @param {string} username
 * @returns {boolean}
 */
export function isValidUsername(username: string): boolean {
  // Username: alphanumeric, underscore, hyphen, 3-32 chars
  return /^[a-zA-Z0-9_-]{3,32}$/.test(username);
}

/**
 * Validate password format
 * @param {string} password
 * @returns {boolean}
 */
export function isValidPassword(password: string): boolean {
  // Password: at least 6 chars, alphanumeric
  return /^[a-zA-Z0-9]{6,}$/.test(password);
}

/**
 * Generate random username
 * @param {string} prefix
 * @returns {string}
 */
export function generateUsername(prefix: string = 'user'): string {
  const randomNum = Math.floor(10000 + Math.random() * 90000);
  return `${prefix}${randomNum}`;
}

/**
 * Generate random password
 * @param {number} length
 * @returns {string}
 */
export function generatePassword(length: number = 8): string {
  const chars = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let password = '';
  for (let i = 0; i < length; i++) {
    password += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return password;
}

module.exports = {
  getFlagEmoji,
  parseJsonOutput,
  resolveDomainToIP,
  getISPAndLocation,
  generateRandomAmount,
  safeSend,
  formatUptime,
  sleep,
  isValidSQLiteDB,
  isValidSQLDump,
  calculateResellerLevel,
  getLevelPriority,
  getResellerDiscount,
  getTrialLimit,
  cleanupOrphanResellers,
  isValidUsername,
  isValidPassword,
  generateUsername,
  generatePassword
};
