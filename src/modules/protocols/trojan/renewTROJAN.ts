
import type { BotContext, DatabaseUser, DatabaseServer } from "../../../types";
const { Client } = require('ssh2');
const sqlite3 = require('sqlite3').verbose();
const { DB_PATH } = require('../../../config/constants');
const db = new sqlite3.Database(DB_PATH);

async function renewtrojan(username, exp, quota, limitip, serverId, harga = 0, hari = exp) {
  console.log(`⚙️ Renewing TROJAN for ${username} | Exp: ${exp} | Quota: ${quota} GB | IP Limit: ${limitip}`);

  if (/\s/.test(username) || /[^a-zA-Z0-9]/.test(username)) {
    return '❌ Username tidak valid.';
  }

  return new Promise((resolve) => {
    db.get('SELECT * FROM Server WHERE id = ?', [serverId], async (err, server) => {
      if (err || !server) {
        console.error('❌ DB Error:', err?.message || 'Server tidak ditemukan');
        return resolve('❌ Server tidak ditemukan.');
      }

      console.log(`📡 Connecting to ${server.domain} for TROJAN renewal...`);

      const conn = new Client();
      let resolved = false;

      const globalTimeout = setTimeout(() => {
        if (!resolved) {
          resolved = true;
          console.error('❌ Global timeout after 35 seconds');
          conn.end();
          resolve('❌ Timeout koneksi ke server.');
        }
      }, 35000);

      conn.on('ready', () => {
        console.log('✅ SSH Connection established');

        // Using exact same format as VPS script: renewtrojan
        const cmd = `
user="${username}"
exp_days=${exp}
quota=${quota}
ip_limit=${limitip}

echo "DEBUG:Starting renewal for user=$user, exp_days=$exp_days"

# Check if user exists
if ! grep -q "^### $user " /etc/xray/trojan/config.json 2>/dev/null; then
  echo "ERROR:User not found"
  exit 1
fi

# Read expiration date from database (same as VPS script)
old_exp=$(grep -E "^### $user " /etc/xray/trojan/.trojan.db | cut -d ' ' -f 3)
echo "DEBUG:Old expiry from db: $old_exp"

if [ -z "$old_exp" ]; then
  echo "DEBUG:No expiry in db, trying config"
  old_exp=$(grep "^### $user " /etc/xray/trojan/config.json | awk '{print $3}')
  echo "DEBUG:Old expiry from config: $old_exp"
fi

# Calculate new expiration date (EXACT same format as VPS script)
new_exp=$(date -d "$old_exp +\${exp_days} days" +"%Y-%m-%d")
echo "DEBUG:Calculated new_exp: $new_exp"

# Get UUID from database
uuid=$(grep -E "^### $user " /etc/xray/trojan/.trojan.db | cut -d ' ' -f 4)
echo "DEBUG:UUID: $uuid"

# Update quota and IP limit
if [ "$quota" != "0" ]; then
  quota_bytes=$((quota * 1024 * 1024 * 1024))
  echo "$quota_bytes" > /etc/xray/trojan/\${user}
  echo "$ip_limit" > /etc/xray/trojan/\${user}IP
else
  rm -f /etc/xray/trojan/\${user} /etc/xray/trojan/\${user}IP
fi

# Update config.json (same as VPS script)
sed -i "/^### $user/c\\### $user $new_exp" /etc/xray/trojan/config.json

# Update database (same as VPS script)
sed -i "/^### $user/c\\### $user $new_exp $uuid" /etc/xray/trojan/.trojan.db

# Restart service
systemctl restart trojan@config 2>/dev/null || systemctl restart xray@trojan 2>/dev/null

echo "SUCCESS"
echo "Old Expiry: $old_exp"
echo "New Expiry: $new_exp"
echo "Quota: $quota GB"
echo "IP Limit: $ip_limit"
`;

        console.log('🔨 Executing TROJAN renewal command...');

        let output = '';

        conn.exec(cmd, (err, stream) => {
          if (err) {
            clearTimeout(globalTimeout);
            if (!resolved) {
              resolved = true;
              console.error('❌ Exec error:', err.message);
              conn.end();
              return resolve('❌ Gagal eksekusi command SSH.');
            }
            return;
          }

          stream.on('close', (code, signal) => {
            clearTimeout(globalTimeout);
            conn.end();

            if (resolved) return;
            resolved = true;

            console.log(`📝 Command finished with code: ${code}`);
            console.log(`📄 Output: ${output.trim()}`);

            if (code !== 0) {
              console.error('❌ Command failed with exit code:', code);
              if (output.includes('ERROR:User not found')) {
                return resolve('❌ Username tidak ditemukan di server.');
              }
              return resolve('❌ Gagal memperpanjang akun TROJAN di server.');
            }

            if (!output.includes('SUCCESS')) {
              return resolve('❌ Gagal memperpanjang akun TROJAN.');
            }

            const oldExpMatch = output.match(/Old Expiry: ([^\n]+)/);
            const expMatch = output.match(/New Expiry: ([^\n]+)/);
            const quotaMatch = output.match(/Quota: ([^\n]+)/);
            const ipMatch = output.match(/IP Limit: ([^\n]+)/);

            const oldExpiry = oldExpMatch ? oldExpMatch[1].trim() : 'N/A';
            const newExpiry = expMatch ? expMatch[1].trim() : 'N/A';

            console.log('📅 ========== RENEWAL DATE DEBUG ==========');
            console.log(`📅 Username: ${username}`);
            console.log(`📅 OLD Expiry: ${oldExpiry}`);
            console.log(`📅 NEW Expiry: ${newExpiry}`);
            console.log(`📅 Duration added: ${hari} days`);
            console.log('📅 ==========================================');

            const expiredStr = newExpiry !== 'N/A' ? new Date(newExpiry).toLocaleString('id-ID', { dateStyle: 'medium', timeStyle: 'short' }) : 'N/A';
            const oldExpiredStr = oldExpiry !== 'N/A' && oldExpiry !== '' ? new Date(oldExpiry).toLocaleString('id-ID', { dateStyle: 'medium', timeStyle: 'short' }) : 'N/A';
            const quotaStr = quotaMatch ? quotaMatch[1] : `${quota} GB`;
            const ipStr = ipMatch ? ipMatch[1] : limitip;

            const msg = `
♻️ *RENEW TROJAN PREMIUM* ♻️

🔹 *Informasi Perpanjangan*
┌─────────────────────
│🏷 *Harga           :* Rp ${harga.toLocaleString('id-ID')}
│🗓 *Perpanjang :* ${hari} Hari
│👤 *Username   :* \`${username}\`
│📦 *Kuota           :* \`${quotaStr}\`
│📱 *Batas IP       :* \`${ipStr}\`
│📆 *Exp Lama    :* \`${oldExpiredStr}\`
│🕒 *Exp Baru     :* \`${expiredStr}\`
└─────────────────────
✅ Akun berhasil diperpanjang.
[RAW_EXPIRY:${newExpiry}]
`.trim();

            console.log('✅ TROJAN renewed for', username);
            resolve(msg);
          })
            .on('data', (data) => {
              output += data.toString();
            })
            .stderr.on('data', (data) => {
              console.warn('⚠️ STDERR:', data.toString());
            });
        });
      })
        .on('error', (err) => {
          clearTimeout(globalTimeout);
          if (!resolved) {
            resolved = true;
            console.error('❌ SSH Connection Error:', err.message);

            if (err.code === 'ENOTFOUND') {
              resolve('❌ Server tidak ditemukan. Cek domain/IP server.');
            } else if (err.level === 'client-authentication') {
              resolve('❌ Password root VPS salah. Update password di database.');
            } else if (err.code === 'ETIMEDOUT' || err.code === 'ECONNREFUSED') {
              resolve('❌ Tidak bisa koneksi ke server. Cek apakah server online.');
            } else {
              resolve(`❌ Gagal koneksi SSH: ${err.message}`);
            }
          }
        })
        .connect({
          host: server.domain,
          port: 22,
          username: 'root',
          password: server.auth,
          readyTimeout: 30000,
          keepaliveInterval: 10000
        });
    });
  });
}

module.exports = { renewtrojan };