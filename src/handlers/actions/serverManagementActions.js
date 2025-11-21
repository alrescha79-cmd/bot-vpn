/**
 * @fileoverview Server Management Actions Handler
 * Handles server-related actions (add, detail, list, delete, reset, edit)
 * 
 * Architecture:
 * - Server CRUD operations
 * - Server detail viewing
 * - Database backup/restore
 * - Server list management
 */

const { dbGetAsync } = require('../../database/connection');
const logger = require('../../utils/logger');

/**
 * Register add server action
 */
function registerAddServerAction(bot) {
  bot.action('addserver', async (ctx) => {
    try {
      logger.info('📥 Proses tambah server dimulai');
      await ctx.answerCbQuery();
      await ctx.reply('🌐 *Silakan masukkan domain/ip server:*', { parse_mode: 'Markdown' });
      
      if (!global.userState) global.userState = {};
      global.userState[ctx.chat.id] = { step: 'addserver' };
    } catch (error) {
      logger.error('❌ Kesalahan saat memulai proses tambah server:', error);
      await ctx.reply('❌ *GAGAL! Terjadi kesalahan saat memproses permintaan Anda. Silakan coba lagi nanti.*', { parse_mode: 'Markdown' });
    }
  });
}

/**
 * Register detail server action
 */
function registerDetailServerAction(bot) {
  bot.action('detailserver', async (ctx) => {
    try {
      logger.info('📋 Proses detail server dimulai');
      await ctx.answerCbQuery();

      const servers = await new Promise((resolve, reject) => {
        global.db.all('SELECT * FROM Server', [], (err, servers) => {
          if (err) {
            logger.error('⚠️ Kesalahan saat mengambil detail server:', err.message);
            return reject('⚠️ *PERHATIAN! Terjadi kesalahan saat mengambil detail server.*');
          }
          resolve(servers);
        });
      });

      if (servers.length === 0) {
        logger.info('⚠️ Tidak ada server yang tersedia');
        return ctx.reply('⚠️ *PERHATIAN! Tidak ada server yang tersedia saat ini.*', { parse_mode: 'Markdown' });
      }

      const buttons = [];
      for (let i = 0; i < servers.length; i += 2) {
        const row = [];
        row.push({
          text: `${servers[i].nama_server}`,
          callback_data: `server_detail_${servers[i].id}`
        });
        if (i + 1 < servers.length) {
          row.push({
            text: `${servers[i + 1].nama_server}`,
            callback_data: `server_detail_${servers[i + 1].id}`
          });
        }
        buttons.push(row);
      }

      await ctx.reply('📋 *Silakan pilih server untuk melihat detail:*', {
        reply_markup: { inline_keyboard: buttons },
        parse_mode: 'Markdown'
      });
    } catch (error) {
      logger.error('⚠️ Kesalahan saat mengambil detail server:', error);
      await ctx.reply('⚠️ *Terjadi kesalahan saat mengambil detail server.*', { parse_mode: 'Markdown' });
    }
  });
}

/**
 * Register list server action
 */
function registerListServerAction(bot) {
  bot.action('listserver', async (ctx) => {
    try {
      logger.info('📜 Proses daftar server dimulai');
      await ctx.answerCbQuery();

      const servers = await new Promise((resolve, reject) => {
        global.db.all('SELECT * FROM Server', [], (err, servers) => {
          if (err) {
            logger.error('⚠️ Kesalahan saat mengambil daftar server:', err.message);
            return reject('⚠️ *PERHATIAN! Terjadi kesalahan saat mengambil daftar server.*');
          }
          resolve(servers);
        });
      });

      if (servers.length === 0) {
        logger.info('⚠️ Tidak ada server yang tersedia');
        return ctx.reply('⚠️ *PERHATIAN! Tidak ada server yang tersedia saat ini.*', { parse_mode: 'Markdown' });
      }

      let serverList = '📜 *Daftar Server* 📜\n\n';
      servers.forEach((server, index) => {
        serverList += `🔹 ${index + 1}. ${server.domain}\n`;
      });

      serverList += `\nTotal Jumlah Server: ${servers.length}`;

      await ctx.reply(serverList, { parse_mode: 'Markdown' });
    } catch (error) {
      logger.error('⚠️ Kesalahan saat mengambil daftar server:', error);
      await ctx.reply('⚠️ *Terjadi kesalahan saat mengambil daftar server.*', { parse_mode: 'Markdown' });
    }
  });
}

/**
 * Register delete server action
 */
function registerDeleteServerAction(bot) {
  bot.action('deleteserver', async (ctx) => {
    try {
      logger.info('🗑️ Proses hapus server dimulai');
      await ctx.answerCbQuery();

      global.db.all('SELECT * FROM Server', [], (err, servers) => {
        if (err) {
          logger.error('⚠️ Kesalahan saat mengambil daftar server:', err.message);
          return ctx.reply('⚠️ *PERHATIAN! Terjadi kesalahan saat mengambil daftar server.*', { parse_mode: 'Markdown' });
        }

        if (servers.length === 0) {
          logger.info('⚠️ Tidak ada server yang tersedia');
          return ctx.reply('⚠️ *PERHATIAN! Tidak ada server yang tersedia saat ini.*', { parse_mode: 'Markdown' });
        }

        const keyboard = servers.map(server => {
          return [{ text: server.nama_server, callback_data: `confirm_delete_server_${server.id}` }];
        });
        keyboard.push([{ text: '🔙 Kembali ke Menu Utama', callback_data: 'kembali_ke_menu' }]);

        ctx.reply('🗑️ *Pilih server yang ingin dihapus:*', {
          reply_markup: {
            inline_keyboard: keyboard
          },
          parse_mode: 'Markdown'
        });
      });
    } catch (error) {
      logger.error('❌ Kesalahan saat memulai proses hapus server:', error);
      await ctx.reply('❌ *GAGAL! Terjadi kesalahan saat memproses permintaan Anda. Silakan coba lagi nanti.*', { parse_mode: 'Markdown' });
    }
  });
}

/**
 * Register reset database action
 */
function registerResetDBAction(bot) {
  bot.action('resetdb', async (ctx) => {
    try {
      await ctx.answerCbQuery();
      await ctx.reply('🚨 *PERHATIAN! Anda akan menghapus semua server yang tersedia. Apakah Anda yakin?*', {
        reply_markup: {
          inline_keyboard: [
            [{ text: '✅ Ya', callback_data: 'confirm_resetdb' }],
            [{ text: '❌ Tidak', callback_data: 'cancel_resetdb' }]
          ]
        },
        parse_mode: 'Markdown'
      });
    } catch (error) {
      logger.error('❌ Error saat memulai proses reset database:', error);
      await ctx.reply(`❌ *${error}*`, { parse_mode: 'Markdown' });
    }
  });
}

/**
 * Register confirm reset database action
 */
function registerConfirmResetDBAction(bot) {
  bot.action('confirm_resetdb', async (ctx) => {
    try {
      await ctx.answerCbQuery();
      await new Promise((resolve, reject) => {
        global.db.run('DELETE FROM Server', (err) => {
          if (err) {
            logger.error('❌ Error saat mereset tabel Server:', err.message);
            return reject('❗️ *PERHATIAN! Terjadi KESALAHAN SERIUS saat mereset database. Harap segera hubungi administrator!*');
          }
          resolve();
        });
      });
      await ctx.reply('🚨 *PERHATIAN! Database telah DIRESET SEPENUHNYA. Semua server telah DIHAPUS TOTAL.*', { parse_mode: 'Markdown' });
    } catch (error) {
      logger.error('❌ Error saat mereset database:', error);
      await ctx.reply(`❌ *${error}*`, { parse_mode: 'Markdown' });
    }
  });
}

/**
 * Register cancel reset database action
 */
function registerCancelResetDBAction(bot) {
  bot.action('cancel_resetdb', async (ctx) => {
    try {
      await ctx.answerCbQuery();
      await ctx.reply('❌ *Proses reset database dibatalkan.*', { parse_mode: 'Markdown' });
    } catch (error) {
      logger.error('❌ Error saat membatalkan reset database:', error);
      await ctx.reply(`❌ *${error}*`, { parse_mode: 'Markdown' });
    }
  });
}

/**
 * Register edit server menu actions
 */
function registerEditServerMenuActions(bot) {
  // Edit server auth
  bot.action('editserver_auth', async (ctx) => {
    try {
      logger.info('Edit server auth process started');
      await ctx.answerCbQuery();

      const servers = await new Promise((resolve, reject) => {
        global.db.all('SELECT id, nama_server FROM Server', [], (err, servers) => {
          if (err) {
            logger.error('❌ Kesalahan saat mengambil daftar server:', err.message);
            return reject('⚠️ *PERHATIAN! Terjadi kesalahan saat mengambil daftar server.*');
          }
          resolve(servers);
        });
      });

      if (servers.length === 0) {
        return ctx.reply('⚠️ *PERHATIAN! Tidak ada server yang tersedia untuk diedit.*', { parse_mode: 'Markdown' });
      }

      let serverList = '🔐 *Daftar Server:*\n\n';
      servers.forEach(server => {
        serverList += `📍 ID: *${server.id}* - ${server.nama_server}\n`;
      });
      serverList += '\n💡 *Silakan ketik ID server yang ingin diedit auth-nya:*';

      if (!global.userState) global.userState = {};
      global.userState[ctx.chat.id] = { step: 'select_server_for_edit_auth' };

      await ctx.reply(serverList, { parse_mode: 'Markdown' });
    } catch (error) {
      logger.error('❌ Kesalahan saat memulai proses edit auth server:', error);
      await ctx.reply(`❌ *${error}*`, { parse_mode: 'Markdown' });
    }
  });

  // Edit server domain
  bot.action('editserver_domain', async (ctx) => {
    try {
      logger.info('Edit server domain process started');
      await ctx.answerCbQuery();

      const servers = await new Promise((resolve, reject) => {
        global.db.all('SELECT id, nama_server FROM Server', [], (err, servers) => {
          if (err) {
            logger.error('❌ Kesalahan saat mengambil daftar server:', err.message);
            return reject('⚠️ *PERHATIAN! Terjadi kesalahan saat mengambil daftar server.*');
          }
          resolve(servers);
        });
      });

      if (servers.length === 0) {
        return ctx.reply('⚠️ *PERHATIAN! Tidak ada server yang tersedia untuk diedit.*', { parse_mode: 'Markdown' });
      }

      let serverList = '🌐 *Daftar Server:*\n\n';
      servers.forEach(server => {
        serverList += `📍 ID: *${server.id}* - ${server.nama_server}\n`;
      });
      serverList += '\n💡 *Silakan ketik ID server yang ingin diedit domain-nya:*';

      if (!global.userState) global.userState = {};
      global.userState[ctx.chat.id] = { step: 'select_server_for_edit_domain' };

      await ctx.reply(serverList, { parse_mode: 'Markdown' });
    } catch (error) {
      logger.error('❌ Kesalahan saat memulai proses edit domain server:', error);
      await ctx.reply(`❌ *${error}*`, { parse_mode: 'Markdown' });
    }
  });

  // Edit server nama
  bot.action('nama_server_edit', async (ctx) => {
    try {
      logger.info('Edit server nama process started');
      await ctx.answerCbQuery();

      const servers = await new Promise((resolve, reject) => {
        global.db.all('SELECT id, nama_server FROM Server', [], (err, servers) => {
          if (err) {
            logger.error('❌ Kesalahan saat mengambil daftar server:', err.message);
            return reject('⚠️ *PERHATIAN! Terjadi kesalahan saat mengambil daftar server.*');
          }
          resolve(servers);
        });
      });

      if (servers.length === 0) {
        return ctx.reply('⚠️ *PERHATIAN! Tidak ada server yang tersedia untuk diedit.*', { parse_mode: 'Markdown' });
      }

      let serverList = '🏷️ *Daftar Server:*\n\n';
      servers.forEach(server => {
        serverList += `📍 ID: *${server.id}* - ${server.nama_server}\n`;
      });
      serverList += '\n💡 *Silakan ketik ID server yang ingin diedit namanya:*';

      if (!global.userState) global.userState = {};
      global.userState[ctx.chat.id] = { step: 'select_server_for_edit_nama' };

      await ctx.reply(serverList, { parse_mode: 'Markdown' });
    } catch (error) {
      logger.error('❌ Kesalahan saat memulai proses edit nama server:', error);
      await ctx.reply(`❌ *${error}*`, { parse_mode: 'Markdown' });
    }
  });

  // Edit server harga (with buttons)
  bot.action('editserver_harga', async (ctx) => {
    try {
      logger.info('Edit server harga process started');
      await ctx.answerCbQuery();

      const servers = await new Promise((resolve, reject) => {
        global.db.all('SELECT id, nama_server FROM Server', [], (err, servers) => {
          if (err) {
            logger.error('❌ Kesalahan saat mengambil daftar server:', err.message);
            return reject('⚠️ *PERHATIAN! Terjadi kesalahan saat mengambil daftar server.*');
          }
          resolve(servers);
        });
      });

      if (servers.length === 0) {
        return ctx.reply('⚠️ *PERHATIAN! Tidak ada server yang tersedia untuk diedit.*', { parse_mode: 'Markdown' });
      }

      const buttons = servers.map(server => ({
        text: server.nama_server,
        callback_data: `edit_harga_${server.id}`
      }));

      const inlineKeyboard = [];
      for (let i = 0; i < buttons.length; i += 2) {
        inlineKeyboard.push(buttons.slice(i, i + 2));
      }

      await ctx.reply('💰 *Silakan pilih server untuk mengedit harga:*', {
        reply_markup: { inline_keyboard: inlineKeyboard },
        parse_mode: 'Markdown'
      });
    } catch (error) {
      logger.error('❌ Kesalahan saat memulai proses edit harga server:', error);
      await ctx.reply(`❌ *${error}*`, { parse_mode: 'Markdown' });
    }
  });

  // Similar patterns for other edit actions
  const editActions = [
    { action: 'editserver_limit_ip', step: 'editserver_limit_ip', title: '📊 Limit IP', callback_prefix: 'edit_limit_ip_' },
    { action: 'editserver_batas_create_akun', step: 'editserver_batas_create_akun', title: '📊 Batas Create Akun', callback_prefix: 'edit_batas_create_akun_' },
    { action: 'editserver_total_create_akun', step: 'editserver_total_create_akun', title: '📊 Total Create Akun', callback_prefix: 'edit_total_create_akun_' },
    { action: 'editserver_quota', step: 'editserver_quota', title: '📊 Quota', callback_prefix: 'edit_quota_' }
  ];

  editActions.forEach(({ action, step, title, callback_prefix }) => {
    bot.action(action, async (ctx) => {
      try {
        logger.info(`${action} process started`);
        await ctx.answerCbQuery();

        const servers = await new Promise((resolve, reject) => {
          global.db.all('SELECT id, nama_server FROM Server', [], (err, servers) => {
            if (err) {
              logger.error('❌ Kesalahan saat mengambil daftar server:', err.message);
              return reject('⚠️ *PERHATIAN! Terjadi kesalahan saat mengambil daftar server.*');
            }
            resolve(servers);
          });
        });

        if (servers.length === 0) {
          return ctx.reply('⚠️ *PERHATIAN! Tidak ada server yang tersedia untuk diedit.*', { parse_mode: 'Markdown' });
        }

        const buttons = servers.map(server => ({
          text: server.nama_server,
          callback_data: `${callback_prefix}${server.id}`
        }));

        const inlineKeyboard = [];
        for (let i = 0; i < buttons.length; i += 2) {
          inlineKeyboard.push(buttons.slice(i, i + 2));
        }

        await ctx.reply(`${title} *Silakan pilih server untuk mengedit:*`, {
          reply_markup: { inline_keyboard: inlineKeyboard },
          parse_mode: 'Markdown'
        });
      } catch (error) {
        logger.error(`❌ Kesalahan saat memulai proses ${action}:`, error);
        await ctx.reply(`❌ *${error}*`, { parse_mode: 'Markdown' });
      }
    });
  });
}

/**
 * Register all server management actions
 */
function registerAllServerManagementActions(bot) {
  registerAddServerAction(bot);
  registerDetailServerAction(bot);
  registerListServerAction(bot);
  registerDeleteServerAction(bot);
  registerResetDBAction(bot);
  registerConfirmResetDBAction(bot);
  registerCancelResetDBAction(bot);
  registerEditServerMenuActions(bot);

  logger.info('✅ Server management actions registered (15+ actions)');
}

module.exports = {
  registerAllServerManagementActions,
  registerAddServerAction,
  registerDetailServerAction,
  registerListServerAction,
  registerDeleteServerAction,
  registerResetDBAction,
  registerConfirmResetDBAction,
  registerCancelResetDBAction,
  registerEditServerMenuActions
};
