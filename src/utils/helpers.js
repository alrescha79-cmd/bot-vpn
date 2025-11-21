/**
 * Helper Utilities
 * General purpose helper functions
 * @module utils/helpers
 */

const dns = require('dns').promises;
const axios = require('axios');
const logger = require('./logger');

/**
 * Get flag emoji by location
 * @param {string} location - Location name
 * @returns {string}
 */
function getFlagEmoji(location) {
  const map = {
    'Singapore, SG': '🇸🇬',
    'Singapore': '🇸🇬',
    'Indonesia': '🇮🇩',
    'Japan': '🇯🇵',
    'USA': '🇺🇸',
    'Germany': '🇩🇪',
    'Malaysia': '🇲🇾',
    'France': '🇫🇷',
    'Netherlands': '🇳🇱',
    'United Kingdom': '🇬🇧',
    'India': '🇮🇳',
    'Thailand': '🇹🇭',
    'Hong Kong': '🇭🇰'
  };

  return map[location?.trim()] || '🌐';
}

/**
 * Parse JSON from command output
 * @param {string} raw - Raw output string
 * @returns {Object}
 * @throws {Error}
 */
function parseJsonOutput(raw) {
  try {
    const start = raw.indexOf('{');
    const end = raw.lastIndexOf('}');
    if (start !== -1 && end !== -1) {
      return JSON.parse(raw.substring(start, end + 1));
    }
    throw new Error('Output tidak mengandung JSON');
  } catch (e) {
    throw new Error('Gagal parsing JSON: ' + e.message);
  }
}

/**
 * Resolve domain to IP address
 * @param {string} domain
 * @returns {Promise<string>}
 */
async function resolveDomainToIP(domain) {
  try {
    // Remove protocol if present
    const cleanDomain = domain.replace(/^https?:\/\//, '').split(':')[0];
    const addresses = await dns.resolve4(cleanDomain);
    return addresses[0];
  } catch (err) {
    logger.error(`❌ Failed to resolve domain ${domain}:`, err.message);
    throw new Error(`Failed to resolve domain: ${domain}`);
  }
}

/**
 * Get ISP and location info from IP
 * @param {string} ip
 * @returns {Promise<Object>}
 */
async function getISPAndLocation(ip) {
  try {
    const response = await axios.get(`http://ip-api.com/json/${ip}`);
    const data = response.data;
    
    return {
      isp: data.isp || 'Unknown',
      country: data.country || 'Unknown',
      city: data.city || 'Unknown',
      location: `${data.city}, ${data.countryCode}` || 'Unknown'
    };
  } catch (err) {
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
 * @returns {Object} Returns {finalAmount, uniqueCode}
 */
function generateRandomAmount(baseAmount) {
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
async function safeSend(bot, chatId, message, extra = {}) {
  try {
    await bot.telegram.sendMessage(chatId, message, extra);
  } catch (err) {
    logger.warn(`⚠️ Failed to send message to ${chatId}: ${err.message}`);
  }
}

/**
 * Format uptime to readable string
 * @param {number} seconds - Uptime in seconds
 * @returns {string}
 */
function formatUptime(seconds) {
  const days = Math.floor(seconds / 86400);
  const hours = Math.floor((seconds % 86400) / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  
  const parts = [];
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
function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Validate SQLite database file
 * @param {string} filePath
 * @returns {boolean}
 */
function isValidSQLiteDB(filePath) {
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
function isValidSQLDump(filePath) {
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
function calculateResellerLevel(totalCommission) {
  if (totalCommission >= 80000) return 'platinum';
  if (totalCommission >= 50000) return 'gold';
  return 'silver';
}

/**
 * Get level priority for comparison
 * @param {string} level
 * @returns {number}
 */
function getLevelPriority(level) {
  const levels = { silver: 1, gold: 2, platinum: 3 };
  return levels[level] || 0;
}

/**
 * Calculate discount based on reseller level
 * @param {string} level
 * @returns {number} Discount multiplier (0.0 - 1.0)
 */
function getResellerDiscount(level) {
  const discounts = {
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
function getTrialLimit(role) {
  if (role === 'admin') return Infinity;
  if (role === 'reseller') return 10;
  return 1;
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
  getTrialLimit
};
