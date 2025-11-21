
import type { BotContext, DatabaseUser, DatabaseServer } from "../../types";
/**
 * @fileoverview Database Backup & Restore Actions Handler
 * Handles database backup, restore, and file management operations
 * 
 * Architecture:
 * - Database backup creation and download
 * - Database restore from backup files
 * - Backup file management (view, delete)
 * - File system operations
 */

const fs = require('fs');
const path = require('path');
const logger = require('../../utils/logger');

const adminIds = process.env.ADMIN_IDS ? process.env.ADMIN_IDS.split(',').map(id => parseInt(id.trim())) : [];

/**
 * Register admin backup database action
 */
function registerAdminBackupDBAction(bot) {
  bot.action('admin_backup_db', async (ctx) => {
    try {
      const userId = ctx.from.id;
      
      // Admin authorization check
      if (!adminIds.includes(userId)) {
        logger.warn(`⚠️ Unauthorized backup attempt by user ${userId}`);
        return ctx.answerCbQuery('⚠️ Anda tidak memiliki akses untuk melakukan backup database!', { show_alert: true });
      }

      await ctx.answerCbQuery();
      
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const backupFileName = `backup_${timestamp}.db`;
      const backupPath = path.join(__dirname, '../../..', 'backups', backupFileName);
      const dbPath = path.join(__dirname, '../../..', 'database.db');

      // Create backups directory if not exists
      const backupsDir = path.join(__dirname, '../../..', 'backups');
      if (!fs.existsSync(backupsDir)) {
        fs.mkdirSync(backupsDir, { recursive: true });
      }

      // Copy database file to backup
      fs.copyFileSync(dbPath, backupPath);
      
      logger.info(`✅ Database backup created: ${backupFileName}`);
      
      // Send backup file to admin
      await ctx.replyWithDocument({
        source: backupPath,
        filename: backupFileName
      }, {
        caption: `✅ *Backup Database Berhasil*\n\n📅 Waktu: ${new Date().toLocaleString('id-ID')}\n📦 File: \`${backupFileName}\``,
        parse_mode: 'Markdown'
      });

      await ctx.reply('✅ *Backup database berhasil dibuat dan dikirim!*', { parse_mode: 'Markdown' });
    } catch (error) {
      logger.error('❌ Error saat backup database:', error);
      await ctx.reply('❌ *Gagal membuat backup database. Silakan coba lagi.*', { parse_mode: 'Markdown' });
    }
  });
}

/**
 * Register admin restore database action
 */
function registerAdminRestoreDBAction(bot) {
  bot.action('admin_restore_db', async (ctx) => {
    try {
      const userId = ctx.from.id;
      
      // Admin authorization check
      if (!adminIds.includes(userId)) {
        logger.warn(`⚠️ Unauthorized restore attempt by user ${userId}`);
        return ctx.answerCbQuery('⚠️ Anda tidak memiliki akses untuk restore database!', { show_alert: true });
      }

      await ctx.answerCbQuery();

      const backupsDir = path.join(__dirname, '../../..', 'backups');
      
      // Check if backups directory exists
      if (!fs.existsSync(backupsDir)) {
        logger.info('⚠️ Backup directory not found');
        return ctx.reply('⚠️ *Tidak ada file backup yang tersedia.*', { parse_mode: 'Markdown' });
      }

      // Get all backup files
      const backupFiles = fs.readdirSync(backupsDir).filter(file => file.endsWith('.db'));

      if (backupFiles.length === 0) {
        logger.info('⚠️ No backup files found');
        return ctx.reply('⚠️ *Tidak ada file backup yang tersedia.*', { parse_mode: 'Markdown' });
      }

      // Create inline keyboard with backup files
      const buttons = backupFiles.map(file => {
        const stats = fs.statSync(path.join(backupsDir, file));
        const fileSize = (stats.size / 1024).toFixed(2); // KB
        const fileDate = stats.mtime.toLocaleString('id-ID');
        
        return [
          { text: `📦 ${file} (${fileSize} KB)`, callback_data: `restore_file::${file}` },
          { text: '🗑️ Hapus', callback_data: `delete_file::${file}` }
        ];
      });

      buttons.push([{ text: '🔙 Kembali', callback_data: 'admin_menu' }]);

      await ctx.reply('📋 *Daftar File Backup:*\n\n💡 Pilih file untuk restore atau hapus:', {
        reply_markup: { inline_keyboard: buttons },
        parse_mode: 'Markdown'
      });
    } catch (error) {
      logger.error('❌ Error saat menampilkan backup files:', error);
      await ctx.reply('❌ *Gagal menampilkan file backup. Silakan coba lagi.*', { parse_mode: 'Markdown' });
    }
  });
}

/**
 * Register restore file action (with confirmation)
 */
function registerRestoreFileAction(bot) {
  bot.action(/^restore_file::(.+)$/, async (ctx) => {
    try {
      const userId = ctx.from.id;
      
      // Admin authorization check
      if (!adminIds.includes(userId)) {
        logger.warn(`⚠️ Unauthorized restore attempt by user ${userId}`);
        return ctx.answerCbQuery('⚠️ Anda tidak memiliki akses!', { show_alert: true });
      }

      const fileName = ctx.match[1];
      await ctx.answerCbQuery();

      await ctx.reply(`🚨 *PERHATIAN!*\n\n⚠️ Anda akan merestore database dari file:\n📦 \`${fileName}\`\n\n❗️ Semua data saat ini akan *DITIMPA* dengan data dari backup!\n\nApakah Anda yakin?`, {
        reply_markup: {
          inline_keyboard: [
            [{ text: '✅ Ya, Restore Sekarang', callback_data: `confirm_restore::${fileName}` }],
            [{ text: '❌ Batal', callback_data: 'admin_restore_db' }]
          ]
        },
        parse_mode: 'Markdown'
      });
    } catch (error) {
      logger.error('❌ Error saat proses restore file:', error);
      await ctx.reply('❌ *Gagal memproses restore. Silakan coba lagi.*', { parse_mode: 'Markdown' });
    }
  });
}

/**
 * Register confirm restore action
 */
function registerConfirmRestoreAction(bot) {
  bot.action(/^confirm_restore::(.+)$/, async (ctx) => {
    try {
      const userId = ctx.from.id;
      
      // Admin authorization check
      if (!adminIds.includes(userId)) {
        logger.warn(`⚠️ Unauthorized restore attempt by user ${userId}`);
        return ctx.answerCbQuery('⚠️ Anda tidak memiliki akses!', { show_alert: true });
      }

      const fileName = ctx.match[1];
      await ctx.answerCbQuery();

      const backupPath = path.join(__dirname, '../../..', 'backups', fileName);
      const dbPath = path.join(__dirname, '../../..', 'database.db');

      // Check if backup file exists
      if (!fs.existsSync(backupPath)) {
        logger.error(`❌ Backup file not found: ${fileName}`);
        return ctx.reply('❌ *File backup tidak ditemukan!*', { parse_mode: 'Markdown' });
      }

      // Close current database connection
      await new Promise<void>((resolve) => {
        global.db.close(() => {
          logger.info('🔒 Database connection closed for restore');
          resolve();
        });
      });

      // Copy backup file to main database
      fs.copyFileSync(backupPath, dbPath);
      
      logger.info(`✅ Database restored from: ${fileName}`);

      // Reopen database connection
      const sqlite3 = require('sqlite3').verbose();
      global.db = new sqlite3.Database(dbPath, (err) => {
        if (err) {
          logger.error('❌ Error reopening database:', err);
        } else {
          logger.info('✅ Database connection reopened after restore');
        }
      });

      await ctx.reply(`✅ *Database Berhasil Direstore!*\n\n📦 Dari file: \`${fileName}\`\n📅 Waktu: ${new Date().toLocaleString('id-ID')}\n\n⚠️ Bot akan direstart untuk menerapkan perubahan...`, {
        parse_mode: 'Markdown'
      });

      // Restart bot after 3 seconds
      setTimeout(() => {
        logger.info('🔄 Restarting bot after database restore...');
        process.exit(0);
      }, 3000);
    } catch (error) {
      logger.error('❌ Error saat restore database:', error);
      await ctx.reply('❌ *Gagal restore database. Silakan coba lagi atau hubungi developer.*', { parse_mode: 'Markdown' });
    }
  });
}

/**
 * Register delete file action (with confirmation)
 */
function registerDeleteFileAction(bot) {
  bot.action(/^delete_file::(.+)$/, async (ctx) => {
    try {
      const userId = ctx.from.id;
      
      // Admin authorization check
      if (!adminIds.includes(userId)) {
        logger.warn(`⚠️ Unauthorized delete attempt by user ${userId}`);
        return ctx.answerCbQuery('⚠️ Anda tidak memiliki akses!', { show_alert: true });
      }

      const fileName = ctx.match[1];
      await ctx.answerCbQuery();

      await ctx.reply(`🗑️ *Konfirmasi Hapus Backup*\n\n📦 File: \`${fileName}\`\n\n⚠️ File backup akan dihapus permanen!\n\nApakah Anda yakin?`, {
        reply_markup: {
          inline_keyboard: [
            [{ text: '✅ Ya, Hapus File', callback_data: `confirm_delete::${fileName}` }],
            [{ text: '❌ Batal', callback_data: 'admin_restore_db' }]
          ]
        },
        parse_mode: 'Markdown'
      });
    } catch (error) {
      logger.error('❌ Error saat proses delete file:', error);
      await ctx.reply('❌ *Gagal memproses hapus file. Silakan coba lagi.*', { parse_mode: 'Markdown' });
    }
  });
}

/**
 * Register confirm delete action
 */
function registerConfirmDeleteAction(bot) {
  bot.action(/^confirm_delete::(.+)$/, async (ctx) => {
    try {
      const userId = ctx.from.id;
      
      // Admin authorization check
      if (!adminIds.includes(userId)) {
        logger.warn(`⚠️ Unauthorized delete attempt by user ${userId}`);
        return ctx.answerCbQuery('⚠️ Anda tidak memiliki akses!', { show_alert: true });
      }

      const fileName = ctx.match[1];
      await ctx.answerCbQuery();

      const backupPath = path.join(__dirname, '../../..', 'backups', fileName);

      // Check if backup file exists
      if (!fs.existsSync(backupPath)) {
        logger.error(`❌ Backup file not found: ${fileName}`);
        return ctx.reply('❌ *File backup tidak ditemukan!*', { parse_mode: 'Markdown' });
      }

      // Delete backup file
      fs.unlinkSync(backupPath);
      
      logger.info(`✅ Backup file deleted: ${fileName}`);

      await ctx.reply(`✅ *File Backup Berhasil Dihapus!*\n\n📦 File: \`${fileName}\`\n📅 Waktu: ${new Date().toLocaleString('id-ID')}`, {
        parse_mode: 'Markdown'
      });

      // Show remaining backup files
      await registerAdminRestoreDBAction(bot);
      await ctx.reply('🔄 *Memuat ulang daftar backup...*', { parse_mode: 'Markdown' });
    } catch (error) {
      logger.error('❌ Error saat delete backup file:', error);
      await ctx.reply('❌ *Gagal menghapus file backup. Silakan coba lagi.*', { parse_mode: 'Markdown' });
    }
  });
}

/**
 * Register all backup/restore actions
 */
function registerAllBackupRestoreActions(bot) {
  registerAdminBackupDBAction(bot);
  registerAdminRestoreDBAction(bot);
  registerRestoreFileAction(bot);
  registerConfirmRestoreAction(bot);
  registerDeleteFileAction(bot);
  registerConfirmDeleteAction(bot);

  logger.info('✅ Backup/restore actions registered (6 actions)');
}

module.exports = {
  registerAllBackupRestoreActions,
  registerAdminBackupDBAction,
  registerAdminRestoreDBAction,
  registerRestoreFileAction,
  registerConfirmRestoreAction,
  registerDeleteFileAction,
  registerConfirmDeleteAction
};
