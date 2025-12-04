
import type { BotContext, DatabaseUser, DatabaseServer } from "../types";
/**
 * Account Expiration Service
 * Handles expiration notifications and auto-deletion
 * @module services/expirationService
 */

const accountRepo = require('../repositories/accountRepository');
const logger = require('../utils/logger');

/**
 * Calculate days until/since expiration
 * @param {string} expiredAt - ISO date string
 * @returns {number} - Negative if expired, positive if future
 */
function calculateDaysUntilExpiry(expiredAt) {
    const now = new Date();
    const expiryDate = new Date(expiredAt);
    const diffTime = expiryDate.getTime() - now.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return diffDays;
}

/**
 * Format expiration warning message
 * @param {Object} account
 * @param {number} daysLeft
 * @returns {string}
 */
function formatExpirationMessage(account, daysLeft) {
    const { username, protocol, server, expired_at } = account;
    const expiryDate = new Date(expired_at).toLocaleString('id-ID', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
    });

    if (daysLeft === 3) {
        return `⚠️ *Peringatan Masa Aktif Akun*

Akun VPN Anda akan segera habis masa aktifnya:

👤 *Username:* \`${username}\`
🔧 *Protocol:* ${protocol.toUpperCase()}
🖥️ *Server:* ${server}
⏰ *Kadaluarsa:* ${expiryDate}
⌛ *Sisa waktu:* *3 hari*

💡 Segera perpanjang akun Anda untuk menghindari gangguan layanan.`;
    } else if (daysLeft === 1) {
        return `🚨 *PERHATIAN: Masa Aktif Hampir Habis!*

Akun VPN Anda akan kadaluarsa dalam 24 jam:

👤 *Username:* \`${username}\`
🔧 *Protocol:* ${protocol.toUpperCase()}
🖥️ *Server:* ${server}
⏰ *Kadaluarsa:* ${expiryDate}
⌛ *Sisa waktu:* *1 hari*

⚠️ Perpanjang SEKARANG untuk menghindari penonaktifan akun!`;
    }
}

/**
 * Format expired notification message
 * @param {Object} account
 * @returns {string}
 */
function formatExpiredMessage(account) {
    const { username, protocol, server, expired_at } = account;
    const expiryDate = new Date(expired_at).toLocaleString('id-ID', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
    });

    return `❌ *Akun Telah Kadaluarsa*

Akun VPN Anda telah habis masa aktifnya:

👤 *Username:* \`${username}\`
🔧 *Protocol:* ${protocol.toUpperCase()}
🖥️ *Server:* ${server}
⏰ *Kadaluarsa:* ${expiryDate}

🗑️ Akun akan *OTOMATIS TERHAPUS* dari database dalam *3 hari*.

💡 Perpanjang sekarang jika Anda masih memerlukan akun ini.`;
}

/**
 * Check and notify accounts expiring in X days
 * @param {Object} bot - Telegraf bot instance
 * @param {number} days - 3 or 1
 * @returns {Promise<number>} - Number of notifications sent
 */
async function checkExpiringAccounts(bot, days) {
    try {
        const accounts = await accountRepo.getAccountsExpiringIn(days);

        if (!accounts || accounts.length === 0) {
            logger.info(`ℹ️  No accounts expiring in ${days} day(s)`);
            return 0;
        }

        logger.info(`✉️  Found ${accounts.length} account(s) expiring in ${days} day(s)`);

        let sentCount = 0;
        const notificationType = days === 3 ? '3d' : '1d';

        for (const account of accounts) {
            try {
                const message = formatExpirationMessage(account, days);
                await bot.telegram.sendMessage(account.owner_user_id, message, {
                    parse_mode: 'Markdown'
                });

                await accountRepo.markNotificationSent(account.id, notificationType);
                sentCount++;

                logger.info(`✅ Sent ${days}-day warning to user ${account.owner_user_id} for account ${account.username}`);
            } catch (err) {
                logger.error(`❌ Failed to send ${days}-day warning for account ${account.username}:`, err.message);
            }
        }

        logger.info(`📊 Expiration warnings (${days}d): ${sentCount}/${accounts.length} sent`);
        return sentCount;
    } catch (err) {
        logger.error(`❌ Error checking expiring accounts (${days}d):`, err);
        return 0;
    }
}

/**
 * Check and notify recently expired accounts
 * @param {Object} bot - Telegraf bot instance
 * @returns {Promise<number>} - Number of notifications sent
 */
async function checkExpiredAccounts(bot) {
    try {
        const accounts = await accountRepo.getRecentlyExpiredAccounts();

        if (!accounts || accounts.length === 0) {
            logger.info('ℹ️  No recently expired accounts to notify');
            return 0;
        }

        logger.info(`✉️  Found ${accounts.length} recently expired account(s)`);

        let sentCount = 0;

        for (const account of accounts) {
            try {
                const message = formatExpiredMessage(account);
                await bot.telegram.sendMessage(account.owner_user_id, message, {
                    parse_mode: 'Markdown'
                });

                await accountRepo.markNotificationSent(account.id, 'expired');
                sentCount++;

                logger.info(`✅ Sent expiration notice to user ${account.owner_user_id} for account ${account.username}`);
            } catch (err) {
                logger.error(`❌ Failed to send expiration notice for account ${account.username}:`, err.message);
            }
        }

        logger.info(`📊 Expiration notices: ${sentCount}/${accounts.length} sent`);
        return sentCount;
    } catch (err) {
        logger.error('❌ Error checking expired accounts:', err);
        return 0;
    }
}

/**
 * Delete accounts expired for 3+ days
 * @param {Object} bot - Telegraf bot instance
 * @param {Array<number>} adminIds - Admin user IDs for notification
 * @returns {Promise<number>} - Number of accounts deleted
 */
async function deleteExpiredAccounts(bot, adminIds) {
    try {
        const accounts = await accountRepo.getExpiredAccountsPendingDeletion();

        if (!accounts || accounts.length === 0) {
            logger.info('ℹ️  No expired accounts to delete');
            return 0;
        }

        logger.info(`🗑️  Found ${accounts.length} account(s) pending deletion (expired 3+ days)`);

        const accountIds = accounts.map(acc => acc.id);
        const result = await accountRepo.deleteExpiredAccounts(accountIds);

        const deletedCount = result.changes || accountIds.length;

        logger.info(`✅ Deleted ${deletedCount} expired account(s) from database`);

        // Send summary to admins
        if (deletedCount > 0 && adminIds && adminIds.length > 0) {
            await sendDeletionSummaryToAdmins(bot, adminIds, deletedCount, accounts);
        }

        return deletedCount;
    } catch (err) {
        logger.error('❌ Error deleting expired accounts:', err);
        return 0;
    }
}

/**
 * Send deletion summary to admins
 * @param {Object} bot - Telegraf bot instance
 * @param {Array<number>} adminIds - Admin user IDs
 * @param {number} count - Number of deleted accounts
 * @param {Array} accounts - Deleted accounts details
 */
async function sendDeletionSummaryToAdmins(bot, adminIds, count, accounts) {
    const timestamp = new Date().toLocaleString('id-ID', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
    });

    let message = `🗑️ *Daily Auto-Deletion Report*\n\n`;
    message += `${count} akun yang sudah expired selama 3+ hari telah dihapus dari database.\n\n`;
    message += `🕐 *Waktu:* ${timestamp}\n\n`;

    if (accounts.length <= 10) {
        message += `*Detail akun yang dihapus:*\n`;
        accounts.forEach((acc, idx) => {
            message += `${idx + 1}. \`${acc.username}\` (${acc.protocol.toUpperCase()}) - Owner: ${acc.owner_user_id}\n`;
        });
    } else {
        message += `_Terlalu banyak untuk ditampilkan detail (${count} akun)_`;
    }

    for (const adminId of adminIds) {
        try {
            await bot.telegram.sendMessage(adminId, message, {
                parse_mode: 'Markdown'
            });
            logger.info(`✅ Sent deletion summary to admin ${adminId}`);
        } catch (err) {
            logger.error(`❌ Failed to send deletion summary to admin ${adminId}:`, err.message);
        }
    }
}

module.exports = {
    calculateDaysUntilExpiry,
    formatExpirationMessage,
    formatExpiredMessage,
    checkExpiringAccounts,
    checkExpiredAccounts,
    deleteExpiredAccounts,
    sendDeletionSummaryToAdmins
};
