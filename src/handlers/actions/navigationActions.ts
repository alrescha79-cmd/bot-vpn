
import type { BotContext, DatabaseUser, DatabaseServer } from "../../types";
/**
 * Navigation Actions Handler
 * Handles navigation, menu callbacks, and utility actions
 * @module handlers/actions/navigationActions
 */

const { Markup } = require('telegraf');
const { dbGetAsync } = require('../../database/connection');
const { sendMainMenu } = require('../helpers/menuHelper');
const logger = require('../../utils/logger');

/**
 * Handle send_main_menu action
 */
function registerSendMainMenuAction(bot) {
  bot.action('send_main_menu', async (ctx) => {
    try {
      await sendMainMenu(ctx);
    } catch (err) {
      logger.error('❌ Error sending main menu:', err.message);
      await ctx.reply('❌ Gagal menampilkan menu utama.');
    }
  });
}

/**
 * Handle akunku action (replaces cek_saldo)
 */
function registerAkunkuAction(bot) {
  bot.action(['akunku', 'cek_saldo'], async (ctx) => {
    const userId = ctx.from.id;

    try {
      const user = await dbGetAsync('SELECT saldo, role FROM users WHERE user_id = ?', [userId]);

      if (!user) {
        return ctx.reply('❌ Anda belum terdaftar. Ketik /start untuk memulai.');
      }

      // Get user's accounts
      const { getAccountsGroupedByServer, getAllAccounts } = require('../../repositories/accountRepository');
      let accountsGrouped = {};

      try {
        if (user.role === 'admin' || user.role === 'owner') {
          // Admin sees all accounts, but we still need to group them
          const allAccounts = await getAllAccounts('active');
          // Group manually
          allAccounts.forEach(acc => {
            const serverName = acc.server || 'Unknown Server';
            if (!accountsGrouped[serverName]) {
              accountsGrouped[serverName] = [];
            }
            accountsGrouped[serverName].push(acc);
          });
        } else {
          accountsGrouped = await getAccountsGroupedByServer(userId, 'active');
        }
      } catch (accountErr) {
        // Table accounts might not exist yet - show fallback
        logger.warn('⚠️ Could not fetch accounts (table may not exist yet):', accountErr);
        accountsGrouped = {};
      }

      const saldoFormatted = `Rp${user.saldo.toLocaleString('id-ID')}`;
      const roleEmoji = user.role === 'admin' ? '👑' : user.role === 'reseller' ? '💼' : '👤';

      // Count total accounts
      let totalAccounts = 0;
      Object.values(accountsGrouped).forEach((accounts: any[]) => {
        totalAccounts += accounts.length;
      });

      let accountList = '';
      if (totalAccounts > 0) {
        accountList = '\n\n📋 *Akun Aktif:*\n';

        const serverNames = Object.keys(accountsGrouped).sort();
        let displayedCount = 0;
        const maxDisplay = 10;

        for (const serverName of serverNames) {
          const accounts = accountsGrouped[serverName];
          if (displayedCount >= maxDisplay) break;

          accountList += `\n🌐 *${serverName}*\n`;

          for (const acc of accounts) {
            if (displayedCount >= maxDisplay) break;

            const expDate = acc.expired_at ? new Date(acc.expired_at) : null;
            const now = new Date();
            const isExpired = expDate && expDate < now;
            const statusIcon = isExpired ? '⚠️ Expired' : '✅ Aktif';
            const expDateStr = expDate ? expDate.toLocaleDateString('id-ID') : 'N/A';

            accountList += `  • \`${acc.username}\` (${acc.protocol}) - ${statusIcon}\n    Exp: ${expDateStr}\n`;
            displayedCount++;
          }
        }

        if (totalAccounts > maxDisplay) {
          accountList += `\n_...dan ${totalAccounts - maxDisplay} akun lainnya_`;
        }
      } else {
        accountList = '\n\n📭 Belum ada akun aktif.';
      }

      await ctx.editMessageText(
        `👤 *Akun Saya*\n\n` +
        `💰 Sisa saldo: *${saldoFormatted}*` +
        accountList,
        {
          parse_mode: 'Markdown',
          ...Markup.inlineKeyboard([
            [Markup.button.callback('📋 Detail Akun', 'akunku_detail')],
            [Markup.button.callback('🗑 Hapus Akun', 'akunku_delete')],
            [Markup.button.callback('💳 Top Up', 'topup_saldo')],
            [Markup.button.callback('🔙 Menu Utama', 'send_main_menu')]
          ])
        }
      );
    } catch (err) {
      logger.error('❌ Error fetching akunku data:', err);
      await ctx.reply('❌ Gagal mengambil data akun. ' + (err?.message || 'Unknown error'));
    }
  });
}

/**
 * Handle detail account action
 */
function registerAkunkuDetailAction(bot) {
  bot.action('akunku_detail', async (ctx) => {
    const userId = ctx.from.id;

    try {
      const user = await dbGetAsync('SELECT role FROM users WHERE user_id = ?', [userId]);
      if (!user) {
        return ctx.reply('❌ Anda belum terdaftar.');
      }

      // Get user's accounts
      const { getAccountsGroupedByServer, getAllAccounts } = require('../../repositories/accountRepository');
      let accountsGrouped: any = {};

      try {
        if (user.role === 'admin' || user.role === 'owner') {
          // Admin sees all accounts, group them
          const allAccounts = await getAllAccounts('active');
          allAccounts.forEach((acc: any) => {
            const serverName = acc.server || 'Unknown Server';
            if (!accountsGrouped[serverName]) {
              accountsGrouped[serverName] = [];
            }
            accountsGrouped[serverName].push(acc);
          });
        } else {
          accountsGrouped = await getAccountsGroupedByServer(userId, 'active');
        }
      } catch (accountErr) {
        logger.warn('⚠️ Failed to fetch accounts (table might not exist yet):', accountErr);
        accountsGrouped = {};
      }

      // Count total accounts
      let totalAccounts = 0;
      Object.values(accountsGrouped).forEach((accounts: any[]) => {
        totalAccounts += accounts.length;
      });

      if (totalAccounts === 0) {
        return ctx.editMessageText(
          '📭 Tidak ada akun untuk ditampilkan.',
          {
            parse_mode: 'Markdown',
            ...Markup.inlineKeyboard([
              [Markup.button.callback('🔙 Kembali', 'akunku')]
            ])
          }
        );
      }

      // Create buttons grouped by server
      const buttons: any[] = [];
      const serverNames = Object.keys(accountsGrouped).sort();
      let addedCount = 0;
      const maxButtons = 20;

      for (const serverName of serverNames) {
        const accounts = accountsGrouped[serverName];

        // Add server header as a disabled button (using callback that does nothing)
        buttons.push([
          Markup.button.callback(`🌐 ${serverName}`, `server_header_${serverName.replace(/\s+/g, '_')}`)
        ]);

        for (const acc of accounts) {
          if (addedCount >= maxButtons) break;

          buttons.push([Markup.button.callback(`  ${acc.username} (${acc.protocol})`, `akunku_view_${acc.id}`)]);
          addedCount++;
        }

        if (addedCount >= maxButtons) break;
      }

      buttons.push([Markup.button.callback('🔙 Kembali', 'akunku')]);

      await ctx.editMessageText(
        '📋 *Pilih akun untuk melihat detail:*\n\n' +
        '_(Akun dikelompokkan per server)_',
        {
          parse_mode: 'Markdown',
          ...Markup.inlineKeyboard(buttons)
        }
      );
    } catch (err) {
      logger.error('❌ Error in akunku detail:', err);
      await ctx.reply('❌ Gagal menampilkan detail akun. ' + (err?.message || 'Unknown error'));
    }
  });
}

/**
 * Handle view specific account
 */
function registerAkunkuViewAccountAction(bot) {
  bot.action(/^akunku_view_(.+)$/, async (ctx) => {
    const accountId = ctx.match[1];
    const userId = ctx.from.id;

    try {
      const { getAccountById } = require('../../repositories/accountRepository');
      const user = await dbGetAsync('SELECT role FROM users WHERE user_id = ?', [userId]);
      const account = await getAccountById(accountId);

      if (!account) {
        return ctx.reply('❌ Akun tidak ditemukan.');
      }

      // Check permission
      if (user.role !== 'admin' && user.role !== 'owner' && account.owner_user_id !== userId) {
        return ctx.reply('⛔ Anda tidak memiliki akses ke akun ini.');
      }

      const expDate = account.expired_at ? new Date(account.expired_at).toLocaleString('id-ID') : 'N/A';
      const createdDate = account.created_at ? new Date(account.created_at).toLocaleString('id-ID') : 'N/A';

      // Escape markdown special characters in raw_response to prevent parse errors
      // Also truncate if too long (Telegram has limits)
      let rawResponse = 'N/A';
      if (account.raw_response) {
        // First, escape any unbalanced backticks and special markdown chars
        let response = account.raw_response;

        // For very long responses (like 3IN1), truncate and provide summary
        const maxLength = 1500;
        if (response.length > maxLength) {
          // Count the number of links in the response
          const vmessLinks = (response.match(/vmess:\/\//g) || []).length;
          const vlessLinks = (response.match(/vless:\/\//g) || []).length;
          const trojanLinks = (response.match(/trojan:\/\//g) || []).length;

          rawResponse = `[Respons terlalu panjang - ${response.length} karakter]\n\n`;
          rawResponse += `📊 Ringkasan:\n`;
          if (vmessLinks > 0) rawResponse += `• VMESS Links: ${vmessLinks}\n`;
          if (vlessLinks > 0) rawResponse += `• VLESS Links: ${vlessLinks}\n`;
          if (trojanLinks > 0) rawResponse += `• TROJAN Links: ${trojanLinks}\n`;
          rawResponse += `\nGunakan link "Save" di pesan create untuk melihat detail lengkap.`;
        } else {
          rawResponse = response;
        }
      }

      // Build detail text without code block wrapper for raw_response
      // to avoid nested backtick issues
      const detailText = `
✅ *Detail Akun*

📌 *Username:* \`${account.username}\`
🔐 *Protokol:* ${account.protocol.toUpperCase()}
🌐 *Server:* ${account.server}
⏳ *Dibuat:* ${createdDate}
📅 *Expired:* ${expDate}
📊 *Status:* ${account.status === 'active' ? '✅ Aktif' : '❌ Expired'}

━━━━━━━━━━━━━━━━━━━━━━
📋 *Raw Response:*

${rawResponse}
      `.trim();

      await ctx.editMessageText(detailText, {
        parse_mode: 'Markdown',
        ...Markup.inlineKeyboard([
          [Markup.button.callback('🔄 Perpanjang Akun', `renew_account_${account.id}`)],
          [Markup.button.callback('🔙 Kembali', 'akunku_detail')]
        ])
      });
    } catch (err) {
      logger.error('❌ Error viewing account:', err);
      await ctx.reply('❌ Gagal menampilkan detail akun. ' + (err?.message || 'Unknown error'));
    }
  });
}

/**
 * Handle delete account action
 */
function registerAkunkuDeleteAction(bot) {
  bot.action('akunku_delete', async (ctx) => {
    const userId = ctx.from.id;

    try {
      const user = await dbGetAsync('SELECT role FROM users WHERE user_id = ?', [userId]);
      if (!user) {
        return ctx.reply('❌ Anda belum terdaftar.');
      }

      // Get user's accounts
      const { getAccountsGroupedByServer, getAllAccounts } = require('../../repositories/accountRepository');
      let accountsGrouped: any = {};

      try {
        if (user.role === 'admin' || user.role === 'owner') {
          const allAccounts = await getAllAccounts('active');
          allAccounts.forEach((acc: any) => {
            const serverName = acc.server || 'Unknown Server';
            if (!accountsGrouped[serverName]) {
              accountsGrouped[serverName] = [];
            }
            accountsGrouped[serverName].push(acc);
          });
        } else {
          accountsGrouped = await getAccountsGroupedByServer(userId, 'active');
        }
      } catch (accountErr) {
        logger.warn('⚠️ Failed to fetch accounts:', accountErr);
        accountsGrouped = {};
      }

      // Count total accounts
      let totalAccounts = 0;
      Object.values(accountsGrouped).forEach((accounts: any[]) => {
        totalAccounts += accounts.length;
      });

      if (totalAccounts === 0) {
        return ctx.editMessageText(
          '📭 Tidak ada akun untuk dihapus.',
          {
            parse_mode: 'Markdown',
            ...Markup.inlineKeyboard([
              [Markup.button.callback('🔙 Kembali', 'akunku')]
            ])
          }
        );
      }

      // Create message with grouped accounts
      let message = '🗑 *Hapus Akun*\n\n';
      message += '⚠️ Pilih akun yang ingin dihapus:\n\n';

      const buttons: any[] = [];
      const serverNames = Object.keys(accountsGrouped).sort();
      let addedCount = 0;
      const maxButtons = 20;

      for (const serverName of serverNames) {
        const accounts = accountsGrouped[serverName];

        // Add server header
        message += `🌐 *${serverName}*\n`;

        for (const acc of accounts) {
          if (addedCount >= maxButtons) break;

          const expDate = acc.expired_at ? new Date(acc.expired_at) : null;
          const now = new Date();
          const isExpired = expDate && expDate < now;
          const statusIcon = isExpired ? '⚠️ Expired' : '✅ Aktif';
          const expDateStr = expDate ? expDate.toLocaleDateString('id-ID') : 'N/A';

          message += `  • \`${acc.username}\` (${acc.protocol}) - ${statusIcon}\n    Exp: ${expDateStr}\n`;

          buttons.push([
            Markup.button.callback(
              `  ${acc.username} (${acc.protocol}) - ${statusIcon}`,
              `ask_delete_acc_${acc.id}`
            )
          ]);
          addedCount++;
        }

        message += '\n';
        if (addedCount >= maxButtons) break;
      }

      buttons.push([Markup.button.callback('🔙 Kembali', 'akunku')]);

      await ctx.editMessageText(message, {
        parse_mode: 'Markdown',
        ...Markup.inlineKeyboard(buttons)
      });
    } catch (err) {
      logger.error('❌ Error in akunku delete:', err);
      await ctx.reply('❌ Gagal menampilkan daftar akun. ' + (err?.message || 'Unknown error'));
    }
  });
}

/**
 * Handle confirm delete account
 */
function registerAkunkuConfirmDeleteAction(bot) {
  // Step 1: Prompt confirmation
  bot.action(/^ask_delete_acc_(.+)$/, async (ctx) => {
    const accountId = ctx.match[1];
    const userId = ctx.from.id;

    try {
      const { getAccountById } = require('../../repositories/accountRepository');
      const account = await getAccountById(accountId);

      if (!account) {
        return ctx.reply('❌ Akun tidak ditemukan.');
      }

      await ctx.answerCbQuery();
      const confirmMessage = 
        `⚠️ *KONFIRMASI HAPUS AKUN*\n\n` +
        `👤 *Username:* \`${account.username}\`\n` +
        `🏪 *Protokol:* \`${account.protocol.toUpperCase()}\`\n` +
        `🌐 *Server:* \`${account.server}\`\n\n` +
        `🚨 *Apakah Anda yakin ingin menghapus akun ini?*\n` +
        `_Akun akan langsung dihapus dari VPS dan sistem database._`;

      await ctx.editMessageText(confirmMessage, {
        parse_mode: 'Markdown',
        ...Markup.inlineKeyboard([
          [Markup.button.callback('🗑️ Ya, Hapus Sekarang', `delete_confirm_${accountId}`)],
          [Markup.button.callback('❌ Batal', 'akunku_delete')]
        ])
      });
    } catch (err: any) {
      logger.error('❌ Error in ask_delete_acc:', err);
      await ctx.reply('❌ Gagal memproses konfirmasi hapus akun: ' + (err?.message || ''));
    }
  });

  // Step 2: Execute deletion
  bot.action(/^delete_confirm_(.+)$/, async (ctx) => {
    const accountId = ctx.match[1];
    const userId = ctx.from.id;

    try {
      const { getAccountById, deleteAccountById } = require('../../repositories/accountRepository');
      const user = await dbGetAsync('SELECT role FROM users WHERE user_id = ?', [userId]);
      const account = await getAccountById(accountId);

      if (!account) {
        return ctx.reply('❌ Akun tidak ditemukan.');
      }

      await ctx.answerCbQuery();
      await ctx.editMessageText('⏳ *Sedang menghapus akun dari server...* Mohon tunggu.', { parse_mode: 'Markdown' });

      // Get server ID from domain
      const server = await dbGetAsync('SELECT id FROM Server WHERE domain = ?', [account.server]);
      let vpsDeleteResult = 'SKIPPED';

      if (server) {
        // Import delete modules
        const deleteVMESS = require('../../modules/protocols/vmess/deleteVMESS');
        const deleteVLESS = require('../../modules/protocols/vless/deleteVLESS');
        const deleteTROJAN = require('../../modules/protocols/trojan/deleteTROJAN');
        const deleteSSH = require('../../modules/protocols/ssh/deleteSSH');
        const deleteSHADOWSOCKS = require('../../modules/protocols/shadowsocks/deleteSHADOWSOCKS');

        // Delete from VPS based on protocol
        const protocol = account.protocol.toUpperCase();
        logger.info(`🗑️ Deleting ${account.username} (${protocol}) from VPS...`);

        try {
          if (protocol === 'VMESS') {
            vpsDeleteResult = await deleteVMESS.deleteVmess(account.username, server.id);
          } else if (protocol === 'VLESS') {
            vpsDeleteResult = await deleteVLESS.deleteVless(account.username, server.id);
          } else if (protocol === 'TROJAN') {
            vpsDeleteResult = await deleteTROJAN.deleteTrojan(account.username, server.id);
          } else if (protocol === 'SSH') {
            vpsDeleteResult = await deleteSSH.deleteSsh(account.username, server.id);
          } else if (protocol === 'SHADOWSOCKS') {
            vpsDeleteResult = await deleteSHADOWSOCKS.deleteShadowsocks(account.username, server.id);
          } else if (protocol === '3IN1') {
            // Delete from all 3 protocols
            const vmessResult = await deleteVMESS.deleteVmess(account.username, server.id);
            const vlessResult = await deleteVLESS.deleteVless(account.username, server.id);
            const trojanResult = await deleteTROJAN.deleteTrojan(account.username, server.id);
            vpsDeleteResult = (vmessResult === 'SUCCESS' || vlessResult === 'SUCCESS' || trojanResult === 'SUCCESS') ? 'SUCCESS' : 'PARTIAL';
          }
          logger.info(`🗑️ VPS delete result: ${vpsDeleteResult}`);
        } catch (vpsErr) {
          logger.error('❌ VPS delete error:', vpsErr);
          vpsDeleteResult = `ERROR: ${vpsErr.message}`;
        }
      } else {
        logger.warn(`⚠️ Server not found for domain: ${account.server}`);
      }

      // Delete from local database
      await deleteAccountById(accountId, userId, user.role);

      // Also delete from akun_aktif table
      const { dbRunAsync } = require('../../database/connection');
      await dbRunAsync('DELETE FROM akun_aktif WHERE username = ? AND UPPER(jenis) = UPPER(?)', [account.username, account.protocol]);

      // Decrement total_create_akun on server
      if (server && server.id) {
        await dbRunAsync(
          'UPDATE Server SET total_create_akun = total_create_akun - 1 WHERE id = ? AND total_create_akun > 0',
          [server.id]
        );
      }

      const vpsStatus = vpsDeleteResult === 'SUCCESS'
        ? '✅ Berhasil dihapus dari server VPS'
        : vpsDeleteResult.startsWith('⚠️')
          ? vpsDeleteResult
          : vpsDeleteResult === 'SKIPPED'
            ? '⚠️ Server tidak ditemukan, hanya dihapus dari database'
            : `⚠️ ${vpsDeleteResult}`;

      await ctx.editMessageText(
        `🗑️ *AKUN BERHASIL DIHAPUS*\n\n` +
        `Username: \`${account.username}\`\n` +
        `Protokol: ${account.protocol}\n\n` +
        `📡 *Status VPS:*\n${vpsStatus}\n` +
        `📂 *Database:* ✅ Terhapus`,
        {
          parse_mode: 'Markdown',
          ...Markup.inlineKeyboard([
            [Markup.button.callback('🔙 Menu Akunku', 'akunku')]
          ])
        }
      );
    } catch (err) {
      logger.error('❌ Error deleting account:', err);
      await ctx.reply('❌ Gagal menghapus akun: ' + (err?.message || 'Unknown error'));
    }
  });
}

/**
 * Handle cek_saldo action (legacy - redirects to akunku)
 */
function registerCekSaldoAction(bot) {
  // Legacy handler - maintained for backward compatibility
  // Now handled by registerAkunkuAction above
}

/**
 * Handle topup_saldo action
 */
function registerTopupSaldoAction(bot) {
  bot.action('topup_saldo', async (ctx) => {
    const message = `
💳 *Top Up Saldo*

Untuk melakukan top up, silakan transfer ke rekening berikut:

📱 *QRIS*
Scan QR code yang akan digenerate setelah Anda input jumlah.

💰 *Minimal Top Up:* Rp10.000

Masukkan jumlah top up yang diinginkan:
    `.trim();

    await ctx.editMessageText(message, {
      parse_mode: 'Markdown',
      ...Markup.inlineKeyboard([
        [
          Markup.button.callback('10K', 'topup_10000'),
          Markup.button.callback('20K', 'topup_20000')
        ],
        [
          Markup.button.callback('50K', 'topup_50000'),
          Markup.button.callback('100K', 'topup_100000')
        ],
        [
          Markup.button.callback('200K', 'topup_200000'),
          Markup.button.callback('500K', 'topup_500000')
        ],
        [Markup.button.callback('✏️ Input Manual', 'topup_manual')],
        [Markup.button.callback('🔙 Kembali', 'send_main_menu')]
      ])
    });
  });
}

/**
 * Handle topup amount selection (preset amounts)
 */
function registerTopupAmountActions(bot) {
  const { initializeDepositState } = require('../../services/depositService');
  const { keyboard_nomor } = require('../../utils/keyboard');

  // Handle preset amounts
  const amounts = {
    'topup_10000': 10000,
    'topup_20000': 20000,
    'topup_50000': 50000,
    'topup_100000': 100000,
    'topup_200000': 200000,
    'topup_500000': 500000
  };

  Object.entries(amounts).forEach(([action, amount]) => {
    bot.action(action, async (ctx) => {
      try {
        const userId = String(ctx.from.id);

        // Initialize deposit state with the selected amount
        initializeDepositState(userId);
        global.depositState[userId].amount = String(amount);
        global.depositState[userId].action = 'confirm_amount';

        const message = `
💰 *Konfirmasi Top Up*

Jumlah: *Rp ${amount.toLocaleString('id-ID')}*

Silakan konfirmasi jumlah top up Anda.
        `.trim();

        await ctx.editMessageText(message, {
          parse_mode: 'Markdown',
          ...Markup.inlineKeyboard([
            [
              Markup.button.callback('✅ Konfirmasi', 'topup_confirm'),
              Markup.button.callback('❌ Batal', 'topup_saldo')
            ]
          ])
        });

        logger.info(`User ${userId} selected topup amount: ${amount}`);
      } catch (error) {
        logger.error('Error handling topup amount selection:', error);
        await ctx.answerCbQuery('❌ Terjadi kesalahan. Silakan coba lagi.', { show_alert: true });
      }
    });
  });

  // Handle manual input
  bot.action('topup_manual', async (ctx) => {
    try {
      const userId = String(ctx.from.id);

      // Initialize deposit state for manual input
      initializeDepositState(userId);

      const message = `💰 *Silakan masukkan jumlah nominal saldo yang Anda ingin tambahkan ke akun Anda:*\n\nJumlah saat ini: *Rp 0*`;

      await ctx.editMessageText(message, {
        parse_mode: 'Markdown',
        reply_markup: { inline_keyboard: keyboard_nomor() }
      });

      logger.info(`User ${userId} chose manual topup input`);
    } catch (error) {
      logger.error('Error handling manual topup:', error);
      await ctx.answerCbQuery('❌ Terjadi kesalahan. Silakan coba lagi.', { show_alert: true });
    }
  });

  // Handle topup confirmation
  bot.action('topup_confirm', async (ctx) => {
    try {
      const userId = String(ctx.from.id);
      const depositState = global.depositState?.[userId];

      if (!depositState || !depositState.amount) {
        await ctx.answerCbQuery('❌ Data tidak valid. Silakan ulangi.', { show_alert: true });
        return;
      }

      const amount = depositState.amount;
      const { processDeposit } = require('../../services/depositService');

      await processDeposit(ctx, amount);

      logger.info(`User ${userId} confirmed topup: ${amount}`);
    } catch (error) {
      logger.error('Error confirming topup:', error);
      await ctx.answerCbQuery('❌ Terjadi kesalahan. Silakan coba lagi.', { show_alert: true });
    }
  });
}

/**
 * Handle pagination navigation
 * Format: navigate_{direction}_{context}_{offset}
 */
function registerPaginationActions(bot) {
  bot.action(/navigate_(next|prev)_(\w+)_(\d+)/, async (ctx) => {
    const [, direction, context, offset] = ctx.match;
    const newOffset = direction === 'next'
      ? parseInt(offset) + 10
      : Math.max(0, parseInt(offset) - 10);

    logger.info(`Pagination: ${context} ${direction} to offset ${newOffset}`);

    // TODO: Implement pagination logic based on context
    await ctx.answerCbQuery(`Navigating ${direction}...`);
  });
}

/**
 * Handle back button actions
 */
function registerBackActions(bot) {
  // Generic back actions
  const backMappings = {
    'back_to_admin': 'menu_adminreseller',
    'back_to_reseller': 'menu_reseller',
    'back_to_main': 'send_main_menu',
    'back_to_services': 'service_create'
  };

  Object.entries(backMappings).forEach(([action, target]) => {
    bot.action(action, async (ctx) => {
      await ctx.answerCbQuery();
      // Trigger the target action
      ctx.match = [target];
      await bot.handleUpdate({ ...ctx.update, callback_query: { ...ctx.callbackQuery, data: target } });
    });
  });
}

/**
 * Handle cancel actions
 */
function registerCancelActions(bot) {
  // Exclude cancel_payment_* because it's handled in callbackRouter
  bot.action(/cancel_(?!payment_)(.+)/, async (ctx) => {
    const [, operation] = ctx.match;

    // Clear any active userState
    if (global.userState && global.userState[ctx.chat.id]) {
      delete global.userState[ctx.chat.id];
    }

    await ctx.answerCbQuery('❌ Dibatalkan');

    try {
      // Try editMessageText first (for text messages)
      await ctx.editMessageText(
        '❌ Operasi dibatalkan.',
        {
          parse_mode: 'Markdown',
          ...Markup.inlineKeyboard([
            [Markup.button.callback('🔙 Menu Utama', 'send_main_menu')]
          ])
        }
      );
    } catch (error: any) {
      // Fallback to editMessageCaption (for photo messages)
      if (error.description?.includes('no text in the message')) {
        try {
          await ctx.editMessageCaption(
            '❌ Operasi dibatalkan.',
            {
              parse_mode: 'Markdown',
              reply_markup: {
                inline_keyboard: [
                  [{ text: '🔙 Menu Utama', callback_data: 'send_main_menu' }]
                ]
              }
            }
          );
        } catch (captionError) {
          logger.error('Error editing message caption:', captionError);
        }
      } else {
        logger.error('Error editing message:', error);
      }
    }

    logger.info(`Operation cancelled: ${operation} by user ${ctx.from.id}`);
  });
}

/**
 * Handle confirm actions (generic)
 * NOTE: This is a fallback handler - specific confirm actions should be handled in their respective modules
 * and registered BEFORE this generic handler to avoid conflicts.
 */
function registerConfirmActions(bot) {
  // Generic handler - will only catch confirm_* that aren't already handled
  // Specific handlers like confirm_delete_server_* should be registered in serverEditActions
  bot.action(/confirm_(?!delete_server_|resetdb)(.+)/, async (ctx) => {
    const operation = ctx.match[0].replace('confirm_', '');

    await ctx.answerCbQuery('⏳ Memproses...');
    logger.info(`Generic confirm action triggered: ${operation} by user ${ctx.from.id}`);

    // This is a fallback - specific confirmations should be handled in their respective action files
    await ctx.reply('⚠️ Konfirmasi tidak dikenali. Silakan coba lagi.');
  });
}

/**
 * Handle server header clicks (no-op, just answer callback)
 */
function registerServerHeaderAction(bot) {
  bot.action(/^server_header_(.+)$/, async (ctx) => {
    await ctx.answerCbQuery('ℹ️ Ini adalah header server');
  });
}

/**
 * Register all navigation actions
 * @param {Object} bot - Telegraf bot instance
 */
function registerNavigationActions(bot) {
  registerSendMainMenuAction(bot);
  registerAkunkuAction(bot);
  registerAkunkuDetailAction(bot);
  registerAkunkuViewAccountAction(bot);
  registerAkunkuDeleteAction(bot);
  registerAkunkuConfirmDeleteAction(bot);
  registerCekSaldoAction(bot);
  registerTopupSaldoAction(bot);
  registerTopupAmountActions(bot);
  registerPaginationActions(bot);
  registerBackActions(bot);
  registerCancelActions(bot);
  registerConfirmActions(bot);
  registerServerHeaderAction(bot);

  logger.info('✅ Navigation actions registered');
}

module.exports = {
  registerNavigationActions,
  registerSendMainMenuAction,
  registerAkunkuAction,
  registerAkunkuDetailAction,
  registerAkunkuViewAccountAction,
  registerAkunkuDeleteAction,
  registerAkunkuConfirmDeleteAction,
  registerCekSaldoAction,
  registerTopupSaldoAction,
  registerTopupAmountActions,
  registerPaginationActions,
  registerBackActions,
  registerCancelActions,
  registerConfirmActions
};
