"use strict";
/**
 * @fileoverview Server Edit Helpers
 * Helper functions for server field editing with validation
 *
 * Architecture:
 * - Field-specific edit handlers
 * - Input validation
 * - Database update operations
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.handleEditField = handleEditField;
exports.handleEditBatasCreateAkun = handleEditBatasCreateAkun;
exports.handleEditTotalCreateAkun = handleEditTotalCreateAkun;
exports.handleEditiplimit = handleEditiplimit;
exports.handleEditQuota = handleEditQuota;
exports.handleEditAuth = handleEditAuth;
exports.handleEditDomain = handleEditDomain;
exports.handleEditHarga = handleEditHarga;
exports.handleEditNama = handleEditNama;
exports.handleAddSaldo = handleAddSaldo;
exports.updateServerField = updateServerField;
exports.updateUserSaldo = updateUserSaldo;
const logger = require('./logger');
const { keyboard_nomor } = require('./keyboard');
const { dbRunAsync } = require('../database/connection');
/**
 * Handle edit field with numeric keyboard
 * @param {TelegrafContext} ctx - Telegraf context
 * @param {UserStateData} userStateData - User state data
 * @param {string} data - Button data
 * @param {string} field - Field name in state
 * @param {string} fieldName - Display name
 * @param {string} query - SQL update query
 */
async function handleEditField(ctx, userStateData, data, field, fieldName, query) {
    let currentValue = userStateData[field] || '';
    if (data === 'delete') {
        currentValue = currentValue.slice(0, -1);
    }
    else if (data === 'confirm') {
        if (currentValue.length === 0) {
            return await ctx.answerCbQuery(`⚠️ *${fieldName} tidak boleh kosong!*`, { show_alert: true });
        }
        try {
            await updateServerField(userStateData.serverId, currentValue, query);
            ctx.reply(`✅ *${fieldName} server berhasil diupdate.*\n\n` +
                `📄 *Detail Server:*\n` +
                `- ${fieldName.charAt(0).toUpperCase() + fieldName.slice(1)}: *${currentValue}*`, { parse_mode: 'Markdown' });
            logger.info(`✅ Server ${userStateData.serverId} ${fieldName} updated to: ${currentValue}`);
        }
        catch (err) {
            logger.error(`❌ Error updating ${fieldName}:`, err);
            ctx.reply(`❌ *Terjadi kesalahan saat mengupdate ${fieldName} server.*`, { parse_mode: 'Markdown' });
        }
        delete global.userState[ctx.chat.id];
        return;
    }
    else {
        if (!/^[a-zA-Z0-9.-]+$/.test(data)) {
            return await ctx.answerCbQuery(`⚠️ *${fieldName} tidak valid!*`, { show_alert: true });
        }
        if (currentValue.length < 253) {
            currentValue += data;
        }
        else {
            return await ctx.answerCbQuery(`⚠️ *${fieldName} maksimal adalah 253 karakter!*`, { show_alert: true });
        }
    }
    userStateData[field] = currentValue;
    const newMessage = `📊 *Silakan masukkan ${fieldName} server baru:*\n\n${fieldName.charAt(0).toUpperCase() + fieldName.slice(1)} saat ini: *${currentValue}*`;
    if (ctx.callbackQuery && newMessage !== ctx.callbackQuery.message.text) {
        await ctx.editMessageText(newMessage, {
            reply_markup: { inline_keyboard: keyboard_nomor() },
            parse_mode: 'Markdown'
        });
    }
}
/**
 * Handle edit batas create akun
 */
async function handleEditBatasCreateAkun(ctx, userStateData, data) {
    await handleEditField(ctx, userStateData, data, 'batasCreateAkun', 'batas create akun', 'UPDATE Server SET batas_create_akun = ? WHERE id = ?');
}
/**
 * Handle edit total create akun
 */
async function handleEditTotalCreateAkun(ctx, userStateData, data) {
    await handleEditField(ctx, userStateData, data, 'totalCreateAkun', 'total create akun', 'UPDATE Server SET total_create_akun = ? WHERE id = ?');
}
/**
 * Handle edit IP limit
 */
async function handleEditiplimit(ctx, userStateData, data) {
    await handleEditField(ctx, userStateData, data, 'iplimit', 'limit IP', 'UPDATE Server SET iplimit = ? WHERE id = ?');
}
/**
 * Handle edit quota
 */
async function handleEditQuota(ctx, userStateData, data) {
    await handleEditField(ctx, userStateData, data, 'quota', 'quota', 'UPDATE Server SET quota = ? WHERE id = ?');
}
/**
 * Handle edit server auth
 */
async function handleEditAuth(ctx, userStateData, newAuth) {
    if (!newAuth || newAuth.trim().length === 0) {
        return ctx.reply('⚠️ *Auth server tidak boleh kosong!*', { parse_mode: 'Markdown' });
    }
    try {
        await dbRunAsync('UPDATE Server SET auth = ? WHERE id = ?', [newAuth.trim(), userStateData.serverId]);
        ctx.reply(`✅ *Auth server berhasil diupdate.*\n\n` +
            `📄 *Detail Server:*\n` +
            `- Auth: *${newAuth.trim()}*`, { parse_mode: 'Markdown' });
        logger.info(`✅ Server ID ${userStateData.serverId} auth updated to: ${newAuth.trim()}`);
    }
    catch (err) {
        logger.error('❌ Error updating auth:', err);
        ctx.reply('❌ *Terjadi kesalahan saat mengupdate auth server.*', { parse_mode: 'Markdown' });
    }
    delete global.userState[ctx.chat.id];
}
/**
 * Handle edit server domain
 */
async function handleEditDomain(ctx, userStateData, newDomain) {
    if (!newDomain || newDomain.trim().length === 0) {
        return ctx.reply('⚠️ *Domain server tidak boleh kosong!*', { parse_mode: 'Markdown' });
    }
    // Basic domain validation
    const domainPattern = /^[a-zA-Z0-9]([a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(\.[a-zA-Z0-9]([a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*$/;
    if (!domainPattern.test(newDomain.trim())) {
        return ctx.reply('⚠️ *Format domain tidak valid! Contoh: example.com atau 192.168.1.1*', { parse_mode: 'Markdown' });
    }
    try {
        await dbRunAsync('UPDATE Server SET domain = ? WHERE id = ?', [newDomain.trim(), userStateData.serverId]);
        ctx.reply(`✅ *Domain server berhasil diupdate.*\n\n` +
            `📄 *Detail Server:*\n` +
            `- Domain: *${newDomain.trim()}*`, { parse_mode: 'Markdown' });
        logger.info(`✅ Server ID ${userStateData.serverId} domain updated to: ${newDomain.trim()}`);
    }
    catch (err) {
        logger.error('❌ Error updating domain:', err);
        ctx.reply('❌ *Terjadi kesalahan saat mengupdate domain server.*', { parse_mode: 'Markdown' });
    }
    delete global.userState[ctx.chat.id];
}
/**
 * Handle edit server harga (price)
 */
async function handleEditHarga(ctx, userStateData, data) {
    let currentAmount = userStateData.amount || '';
    if (data === 'delete') {
        currentAmount = currentAmount.slice(0, -1);
    }
    else if (data === 'confirm') {
        if (currentAmount.length === 0) {
            return await ctx.answerCbQuery('⚠️ *Jumlah tidak boleh kosong!*', { show_alert: true });
        }
        const hargaBaru = parseFloat(currentAmount);
        if (isNaN(hargaBaru) || hargaBaru <= 0) {
            return ctx.reply('❌ *Harga tidak valid. Masukkan angka yang valid.*', { parse_mode: 'Markdown' });
        }
        try {
            await updateServerField(userStateData.serverId, hargaBaru, 'UPDATE Server SET harga = ? WHERE id = ?');
            ctx.reply(`✅ *Harga server berhasil diupdate.*\n\n` +
                `📄 *Detail Server:*\n` +
                `- Harga Baru: *Rp ${hargaBaru}*`, { parse_mode: 'Markdown' });
            logger.info(`✅ Server ${userStateData.serverId} harga updated to: ${hargaBaru}`);
        }
        catch (err) {
            logger.error('❌ Error updating harga:', err);
            ctx.reply('❌ *Terjadi kesalahan saat mengupdate harga server.*', { parse_mode: 'Markdown' });
        }
        delete global.userState[ctx.chat.id];
        return;
    }
    else {
        if (!/^\d+$/.test(data)) {
            return await ctx.answerCbQuery('⚠️ *Hanya angka yang diperbolehkan!*', { show_alert: true });
        }
        if (currentAmount.length < 12) {
            currentAmount += data;
        }
        else {
            return await ctx.answerCbQuery('⚠️ *Jumlah maksimal adalah 12 digit!*', { show_alert: true });
        }
    }
    userStateData.amount = currentAmount;
    const newMessage = `💰 *Silakan masukkan harga server baru:*\n\nJumlah saat ini: *Rp ${currentAmount}*`;
    if (ctx.callbackQuery && newMessage !== ctx.callbackQuery.message.text) {
        await ctx.editMessageText(newMessage, {
            reply_markup: { inline_keyboard: keyboard_nomor() },
            parse_mode: 'Markdown'
        });
    }
}
/**
 * Handle edit server nama (name)
 */
async function handleEditNama(ctx, userStateData, newName) {
    if (!newName || newName.trim().length === 0) {
        return ctx.reply('⚠️ *Nama server tidak boleh kosong!*', { parse_mode: 'Markdown' });
    }
    try {
        await dbRunAsync('UPDATE Server SET nama_server = ? WHERE id = ?', [newName.trim(), userStateData.serverId]);
        ctx.reply(`✅ *Nama server berhasil diupdate.*\n\n` +
            `📄 *Detail Server:*\n` +
            `- Nama: *${newName.trim()}*`, { parse_mode: 'Markdown' });
        logger.info(`✅ Server ID ${userStateData.serverId} nama updated to: ${newName.trim()}`);
    }
    catch (err) {
        logger.error('❌ Error updating nama:', err);
        ctx.reply('❌ *Terjadi kesalahan saat mengupdate nama server.*', { parse_mode: 'Markdown' });
    }
    delete global.userState[ctx.chat.id];
}
/**
 * Handle add saldo user with numeric keyboard
 */
async function handleAddSaldo(ctx, userStateData, data) {
    let currentSaldo = userStateData.saldo || '';
    if (data === 'delete') {
        currentSaldo = currentSaldo.slice(0, -1);
    }
    else if (data === 'confirm') {
        if (currentSaldo.length === 0) {
            return await ctx.answerCbQuery('⚠️ *Jumlah saldo tidak boleh kosong!*', { show_alert: true });
        }
        try {
            await updateUserSaldo(userStateData.userId, currentSaldo);
            ctx.reply(`✅ *Saldo user berhasil ditambahkan.*\n\n` +
                `📄 *Detail Saldo:*\n` +
                `- Jumlah Saldo: *Rp ${currentSaldo}*`, { parse_mode: 'Markdown' });
            logger.info(`✅ User ${userStateData.userId} saldo added: ${currentSaldo}`);
        }
        catch (err) {
            logger.error('❌ Error adding saldo:', err);
            ctx.reply('❌ *Terjadi kesalahan saat menambahkan saldo user.*', { parse_mode: 'Markdown' });
        }
        delete global.userState[ctx.chat.id];
        return;
    }
    else {
        if (!/^[0-9]+$/.test(data)) {
            return await ctx.answerCbQuery('⚠️ *Jumlah saldo tidak valid!*', { show_alert: true });
        }
        if (currentSaldo.length < 10) {
            currentSaldo += data;
        }
        else {
            return await ctx.answerCbQuery('⚠️ *Jumlah saldo maksimal adalah 10 karakter!*', { show_alert: true });
        }
    }
    userStateData.saldo = currentSaldo;
    const newMessage = `📊 *Silakan masukkan jumlah saldo yang ingin ditambahkan:*\n\nJumlah saldo saat ini: *${currentSaldo}*`;
    if (ctx.callbackQuery && newMessage !== ctx.callbackQuery.message.text) {
        await ctx.editMessageText(newMessage, {
            reply_markup: { inline_keyboard: keyboard_nomor() },
            parse_mode: 'Markdown'
        });
    }
}
/**
 * Update server field in database
 * @param {number} serverId - Server ID
 * @param {any} value - New value
 * @param {string} query - SQL query
 */
async function updateServerField(serverId, value, query) {
    try {
        await dbRunAsync(query, [value, serverId]);
        logger.info(`✅ Server ${serverId} field updated successfully`);
    }
    catch (err) {
        logger.error(`❌ Error updating server field:`, err);
        throw err;
    }
}
/**
 * Update user saldo in database
 * @param {number} userId - User ID
 * @param {string} saldo - Saldo amount to add
 */
async function updateUserSaldo(userId, saldo) {
    try {
        await dbRunAsync('UPDATE Users SET saldo = saldo + ? WHERE id = ?', [saldo, userId]);
        logger.info(`✅ User ${userId} saldo updated: +${saldo}`);
    }
    catch (err) {
        logger.error(`❌ Error updating user saldo:`, err);
        throw err;
    }
}
module.exports = {
    handleEditField,
    handleEditBatasCreateAkun,
    handleEditTotalCreateAkun,
    handleEditiplimit,
    handleEditQuota,
    handleEditAuth,
    handleEditDomain,
    handleEditHarga,
    handleEditNama,
    handleAddSaldo,
    updateServerField,
    updateUserSaldo
};
