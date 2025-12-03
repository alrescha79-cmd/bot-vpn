/**
 * Admin Synchronization Utility
 * Automatically syncs admin users from .vars.json to database
 * @module utils/syncAdmins
 */

import { dbGet, dbRun } from '../infrastructure/database';
import config from '../config';
const logger = require('./logger');

/**
 * Sync admin users from config to database
 * Ensures all admin IDs in .vars.json have admin role in database
 * @returns {Promise<void>}
 */
export async function syncAdminsFromConfig(): Promise<void> {
    try {
        logger.info('🔄 Syncing admin users from config to database...');

        // Get admin IDs from config (normalize to array)
        const adminIds = Array.isArray(config.USER_ID)
            ? config.USER_ID
            : [config.USER_ID];

        if (adminIds.length === 0 || (adminIds.length === 1 && adminIds[0] === 0)) {
            logger.warn('⚠️ No admin IDs found in config, skipping admin sync');
            return;
        }

        let created = 0;
        let updated = 0;
        let skipped = 0;

        // Process each admin ID
        for (const adminId of adminIds) {
            try {
                // Check if user exists
                const user = await dbGet(
                    'SELECT user_id, role FROM users WHERE user_id = ?',
                    [adminId]
                );

                if (!user) {
                    // User doesn't exist, create with admin role
                    await dbRun(
                        `INSERT INTO users (user_id, username, first_name, saldo, role, has_trial) 
             VALUES (?, ?, ?, 0, 'admin', 0)`,
                        [adminId, 'admin', 'Admin']
                    );
                    logger.info(`✅ Created admin user: ${adminId}`);
                    created++;
                } else if (user.role !== 'admin') {
                    // User exists but not admin, update role
                    await dbRun(
                        'UPDATE users SET role = ? WHERE user_id = ?',
                        ['admin', adminId]
                    );
                    logger.info(`✅ Updated user ${adminId} to admin role`);
                    updated++;
                } else {
                    // User already admin, skip
                    logger.info(`ℹ️  User ${adminId} already has admin role`);
                    skipped++;
                }
            } catch (err: any) {
                logger.error(`❌ Failed to sync admin ${adminId}:`, err.message);
                // Continue with other admins even if one fails
            }
        }

        logger.info(
            `✅ Admin sync completed: ${created} created, ${updated} updated, ${skipped} skipped`
        );
    } catch (err: any) {
        logger.error('❌ Error syncing admins from config:', err.message);
        // Don't throw - allow bot to continue even if sync fails
    }
}

module.exports = {
    syncAdminsFromConfig
};
