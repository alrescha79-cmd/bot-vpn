/**
 * Account Persistence Utility
 * Helper to save created accounts to database
 * @module utils/accountPersistence
 */

const { saveCreatedAccount } = require('../repositories/accountRepository');
const logger = require('./logger');

/**
 * Extract expiry date from account message
 * @param {string} message - Account creation response
 * @returns {string|null} - ISO date string or null
 */
function extractExpiryDate(message: string): string | null {
  try {
    // Look for "Expired" or "Exp" patterns with flexible spacing
    const expiredMatch = message.match(/Expired\s*:\*?\s*`([^`]+)`/i) ||
                        message.match(/Exp\s*:\*?\s*`([^`]+)`/i) ||
                        message.match(/🕒\s*\*?Expired\s*:\*?\s*`([^`]+)`/i) ||
                        message.match(/Expired\s*:\s*([^\n]+)/i);
    
    if (expiredMatch && expiredMatch[1]) {
      const expString = expiredMatch[1].trim();
      const expDate = new Date(expString);
      if (!isNaN(expDate.getTime())) {
        return expDate.toISOString();
      }
    }
    
    // Alternative: calculate from "Masa Aktif" days
    const daysMatch = message.match(/Masa Aktif\s*:\*?\s*(\d+)\s*Hari/i) ||
                      message.match(/🗓\s*\*?Masa Aktif\s*:\*?\s*(\d+)\s*Hari/i);
    if (daysMatch && daysMatch[1]) {
      const days = parseInt(daysMatch[1]);
      const expDate = new Date();
      expDate.setDate(expDate.getDate() + days);
      return expDate.toISOString();
    }
  } catch (error) {
    logger.error('Error extracting expiry date:', error);
  }
  
  return null;
}

/**
 * Extract server domain from account message
 * @param {string} message - Account creation response
 * @returns {string|null}
 */
function extractServer(message: string): string | null {
  // More flexible regex with varying spaces
  const serverMatch = message.match(/Domain\s*:\*?\s*`([^`]+)`/i) ||
                      message.match(/Host\s*:\*?\s*`([^`]+)`/i) ||
                      message.match(/Server\s*:\*?\s*`([^`]+)`/i) ||
                      message.match(/🌐\s*\*?Domain\s*:\*?\s*`([^`]+)`/i) ||
                      message.match(/Domain\s*:\s*([a-z0-9.-]+\.[a-z]{2,})/i);
  return serverMatch ? serverMatch[1].trim() : null;
}

/**
 * Extract username from account message
 * @param {string} message - Account creation response
 * @returns {string|null}
 */
function extractUsername(message: string): string | null {
  // More flexible regex with varying spaces and asterisks
  const usernameMatch = message.match(/Username\s*:\*?\s*`([^`]+)`/i) ||
                        message.match(/👤\s*\*?Username\s*:\*?\s*`([^`]+)`/i) ||
                        message.match(/User\s*:\*?\s*`([^`]+)`/i);
  return usernameMatch ? usernameMatch[1].trim() : null;
}

/**
 * Determine if this is a trial account
 * @param {string} message - Account creation response
 * @returns {boolean}
 */
function isTrial(message: string): boolean {
  return message.toLowerCase().includes('trial') || 
         message.toLowerCase().includes('gratis');
}

/**
 * Save account after successful creation (non-trial only)
 * @param {Object} params
 * @param {string} params.message - Account creation response message
 * @param {string} params.protocol - Protocol type (SSH, VMESS, VLESS, TROJAN, SHADOWSOCKS)
 * @param {number} params.userId - User ID who created the account
 * @returns {Promise<boolean>} - true if saved, false if skipped
 */
async function persistAccountIfPremium(params: {
  message: string;
  protocol: string;
  userId: number;
}): Promise<boolean> {
  const { message, protocol, userId } = params;
  
  try {
    // Skip trial accounts
    if (isTrial(message)) {
      logger.info(`⏭️ Skipping trial account persistence`);
      return false;
    }
    
    const username = extractUsername(message);
    const server = extractServer(message);
    const expired_at = extractExpiryDate(message);
    
    logger.debug(`Extracted data: username=${username}, server=${server}, expired_at=${expired_at}`);
    
    if (!username || !server) {
      logger.warn(`⚠️ Could not extract username or server from message. username=${username}, server=${server}`);
      return false;
    }
    
    await saveCreatedAccount({
      username,
      protocol: protocol.toUpperCase(),
      server,
      expired_at,
      owner_user_id: userId,
      raw_response: message
    });
    
    logger.info(`✅ Account persisted: ${username} (${protocol}) for user ${userId}`);
    return true;
  } catch (error) {
    logger.error('❌ Failed to persist account:', error);
    return false;
  }
}

module.exports = {
  persistAccountIfPremium,
  extractExpiryDate,
  extractServer,
  extractUsername,
  isTrial
};
