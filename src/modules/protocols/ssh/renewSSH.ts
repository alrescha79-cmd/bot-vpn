
import type { BotContext, DatabaseUser, DatabaseServer } from "../../../types";
const axios = require('axios');
const sqlite3 = require('sqlite3').verbose();
const { DB_PATH } = require('../../../config/constants');
const db = new sqlite3.Database(DB_PATH);

async function renewssh(username, exp, limitip, serverId, harga = 0, hari = exp) {
  if (/\s/.test(username) || /[^a-zA-Z0-9]/.test(username)) {
    return '❌ Username tidak valid. Gunakan hanya huruf dan angka tanpa spasi.';
  }

  return new Promise((resolve) => {
    db.get('SELECT * FROM Server WHERE id = ?', [serverId], (err, server) => {
      if (err || !server) return resolve('❌ Server tidak ditemukan.');

      const url = `http://${server.domain}:5888/renewssh?user=${username}&exp=${exp}&iplimit=${limitip}`;
      axios.get(url)
        .then(res => {
          if (res.data.status === "success") {
            const data = res.data.data;
            
            // Parse the expired date string and add timestamp
            const expDate = new Date(data.exp);
            const expiredStr = expDate.toLocaleString('id-ID', { dateStyle: 'medium', timeStyle: 'short' });
            
            return resolve(`
♻️ *RENEW SSH PREMIUM* ♻️

🔹 *Informasi Perpanjangan*
┌─────────────────────
│🏷 *Harga           :* Rp ${harga.toLocaleString('id-ID')}
│🗓 *Perpanjang :* ${hari} Hari
│👤 *Username   :* \`${username}\`
│📱 *Batas IP       :* \`${data.limitip} IP\`
│🕒 *Expired        :* \`${expiredStr}\`
└─────────────────────
✅ Akun berhasil diperpanjang.
✨ Terima kasih telah menggunakan layanan kami!
`);
          } else {
            return resolve(`❌ Gagal: ${res.data.message}`);
          }
        })
        .catch(() => resolve('❌ Gagal menghubungi server.'));
    });
  });
}

module.exports = { renewssh };