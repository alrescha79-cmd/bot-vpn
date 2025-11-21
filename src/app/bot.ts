/**
 * Bot Application Entry Point
 * Initializes the Telegraf bot with all configurations and handlers
 * @module app/bot
 */

import { Telegraf } from 'telegraf';
import type { UserFromGetMe } from 'telegraf/types';
const { session } = require('telegraf');
const cron = require('node-cron');
const config = require('../config');
const logger = require('../utils/logger');
const { initializeDatabase, dbRun } = require('../infrastructure/database');
const { cleanupOrphanResellers } = require('../utils/helpers');

export interface BotInstance extends Telegraf {
  botInfo?: UserFromGetMe;
}

/**
 * Initialize and configure the bot
 * @returns {Promise<BotInstance>} Configured Telegraf bot instance
 */
export async function initializeBot(): Promise<BotInstance> {
  logger.info('🤖 Initializing bot...');

  // Initialize database
  await initializeDatabase();
  logger.info('✅ Database initialized');

  // Create bot instance
  const bot = new Telegraf(config.BOT_TOKEN) as BotInstance;

  // Apply session middleware
  bot.use(session());

  logger.info('✅ Bot session middleware applied');

  return bot;
}

/**
 * Setup cron jobs
 * @param {BotInstance} bot - Telegraf bot instance
 */
export function setupCronJobs(bot: BotInstance): void {
  // Reset trial count daily at 00:00
  cron.schedule('0 0 * * *', async () => {
    try {
      await dbRun(`UPDATE users SET trial_count_today = 0, last_trial_date = date('now')`);
      logger.info('✅ Daily trial reset completed');
    } catch (err: any) {
      logger.error('❌ Failed to reset daily trial:', err.message);
    }
  });

  // Daily bot restart at 04:00
  cron.schedule('0 4 * * *', () => {
    logger.warn('🌀 Daily bot restart scheduled (04:00)...');
    const { exec } = require('child_process');
    
    exec('pm2 restart botvpn', async (err: any, stdout: string, stderr: string) => {
      if (err) {
        logger.error('❌ Failed to restart via PM2:', err.message);
      } else {
        logger.info('✅ Bot successfully restarted by daily scheduler');

        const restartMsg = `♻️ Bot restarted automatically (daily schedule).\n🕓 Time: ${new Date().toLocaleString('id-ID')}`;
        try {
          await bot.telegram.sendMessage(config.GROUP_ID || config.adminIds[0], restartMsg);
          logger.info('📢 Restart notification sent');
        } catch (e: any) {
          logger.warn('⚠️ Failed to send restart notification:', e.message);
        }
      }
    });
  });

  // Monthly commission reset on 1st at 01:00
  cron.schedule('0 1 1 * *', async () => {
    try {
      await dbRun(`DELETE FROM reseller_sales`);
      logger.info('✅ reseller_sales reset (monthly)');

      await dbRun(`UPDATE users SET reseller_level = 'silver' WHERE role = 'reseller'`);
      logger.info('✅ Reseller levels reset to silver (monthly)');

      if (config.GROUP_ID) {
        await bot.telegram.sendMessage(
          config.GROUP_ID,
          `🧹 *Monthly Commission Reset:*\n\nAll reseller commissions have been reset and levels returned to *SILVER*.`,
          { parse_mode: 'Markdown' }
        );
      }
    } catch (err: any) {
      logger.error('❌ Failed monthly reset:', err.message);
    }
  });

  logger.info('✅ Cron jobs scheduled');
}

/**
 * Startup cleanup tasks
 */
export async function runStartupTasks(): Promise<void> {
  logger.info('🧹 Running startup cleanup tasks...');
  
  // Cleanup orphan resellers
  await cleanupOrphanResellers();
  
  logger.info('✅ Startup tasks completed');
}

/**
 * Start the bot
 * @param {BotInstance} bot - Telegraf bot instance
 */
export async function startBot(bot: BotInstance): Promise<void> {
  try {
    await bot.launch();
    logger.info('✅ Bot launched successfully');
    logger.info(`🤖 Bot is running as @${bot.botInfo?.username}`);

    // Enable graceful stop
    process.once('SIGINT', () => {
      logger.info('SIGINT received, stopping bot...');
      bot.stop('SIGINT');
    });
    
    process.once('SIGTERM', () => {
      logger.info('SIGTERM received, stopping bot...');
      bot.stop('SIGTERM');
    });
  } catch (err: any) {
    logger.error('❌ Failed to launch bot:', err.message);
    throw err;
  }
}

/**
 * Initialize and start the complete bot application
 * @returns {Promise<BotInstance>} Running bot instance
 */
export async function createBotApplication(): Promise<BotInstance> {
  try {
    // Initialize bot
    const bot = await initializeBot();

    // Run startup tasks
    await runStartupTasks();

    // Setup cron jobs
    setupCronJobs(bot);

    // Return bot instance for handler registration
    return bot;
  } catch (err: any) {
    logger.error('❌ Failed to create bot application:', err.message);
    throw err;
  }
}

module.exports = {
  createBotApplication,
  initializeBot,
  setupCronJobs,
  runStartupTasks,
  startBot
};
