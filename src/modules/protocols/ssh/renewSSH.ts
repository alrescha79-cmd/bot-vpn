
import type { BotContext, DatabaseUser, DatabaseServer } from "../../../types";
const { Client } = require('ssh2');
const sqlite3 = require('sqlite3').verbose();
const { DB_PATH } = require('../../../config/constants');
const db = new sqlite3.Database(DB_PATH);

async function renewssh(username, exp, limitip, serverId, harga = 0, hari = exp) {
  console.log(`⚙️ Renewing SSH for ${username} | Exp: ${exp} | IP Limit: ${limitip}`);

  if (/\s/.test(username) || /[^a-zA-Z0-9]/.test(username)) {
    return '❌ Username tidak valid. Gunakan hanya huruf dan angka tanpa spasi.';
  }

  return new Promise((resolve) => {
    db.get('SELECT * FROM Server WHERE id = ?', [serverId], async (err, server) => {
      if (err || !server) {
        console.error('❌ DB Error:', err?.message || 'Server tidak ditemukan');
        return resolve('❌ Server tidak ditemukan.');
      }

      console.log(`📡 Connecting to ${server.domain} for SSH renewal...`);

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

        const cmd = `
user="${username}"
exp_days=${exp}
ip_limit=${limitip}

echo "DEBUG:Starting SSH renewal for user=$user, exp_days=$exp_days"

# Check if user exists
if ! id "$user" &>/dev/null; then
  echo "ERROR:User not found"
  exit 1
fi

# Get current expiry date from chage
old_exp=$(chage -l "$user" 2>/dev/null | grep "Account expires" | cut -d: -f2 | xargs)
echo "DEBUG:Old expiry: $old_exp"

# Calculate new expiration date
if [ -z "$old_exp" ] || [ "$old_exp" = "never" ]; then
  new_exp=$(date -d "+\${exp_days} days" +"%Y-%m-%d")
  echo "DEBUG:No old expiry, using today as base"
else
  # Convert to standard format and add days
  old_date=$(date -d "$old_exp" +"%Y-%m-%d" 2>/dev/null)
  if [ -z "$old_date" ]; then
    new_exp=$(date -d "+\${exp_days} days" +"%Y-%m-%d")
    echo "DEBUG:Failed to parse old expiry, using today"
  else
    new_exp=$(date -d "$old_date +\${exp_days} days" +"%Y-%m-%d")
    echo "DEBUG:Extended from $old_date"
  fi
fi
echo "DEBUG:Calculated new_exp: $new_exp"

# Update account expiry
chage -E "$new_exp" "$user"

# Update IP limit file
mkdir -p /etc/ssh/limit
echo "$ip_limit" > /etc/ssh/limit/$user 2>/dev/null || true

# Update database if exists
if [ -f "/etc/ssh/.ssh.db" ]; then
  sed -i "/^### $user /d" /etc/ssh/.ssh.db 2>/dev/null || true
  echo "### $user $new_exp $ip_limit" >> /etc/ssh/.ssh.db
fi

echo "SUCCESS"
echo "Old Expiry: $old_exp"
echo "New Expiry: $new_exp"
echo "IP Limit: $ip_limit"
`;

        console.log('🔨 Executing SSH renewal command...');

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
              return resolve('❌ Gagal memperpanjang akun SSH di server.');
            }

            if (!output.includes('SUCCESS')) {
              return resolve('❌ Gagal memperpanjang akun SSH.');
            }

            const oldExpMatch = output.match(/Old Expiry: ([^\n]+)/);
            const expMatch = output.match(/New Expiry: ([^\n]+)/);
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
            const oldExpiredStr = oldExpiry !== 'N/A' && oldExpiry !== '' && oldExpiry !== 'never' ? new Date(oldExpiry).toLocaleString('id-ID', { dateStyle: 'medium', timeStyle: 'short' }) : oldExpiry;
            const ipStr = ipMatch ? ipMatch[1] : limitip;

            const msg = `
♻️ *RENEW SSH PREMIUM* ♻️

🔹 *Informasi Perpanjangan*
┌─────────────────────
│🏷 *Harga           :* Rp ${harga.toLocaleString('id-ID')}
│🗓 *Perpanjang :* ${hari} Hari
│👤 *Username   :* \`${username}\`
│📱 *Batas IP       :* \`${ipStr}\`
│📆 *Exp Lama    :* \`${oldExpiredStr}\`
│🕒 *Exp Baru     :* \`${expiredStr}\`
└─────────────────────
✅ Akun berhasil diperpanjang.
[RAW_EXPIRY:${newExpiry}]
`.trim();

            console.log('✅ SSH renewed for', username);
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

module.exports = { renewssh };