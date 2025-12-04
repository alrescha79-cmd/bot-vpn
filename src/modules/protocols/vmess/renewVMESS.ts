
import type { BotContext, DatabaseUser, DatabaseServer } from "../../../types";
const { Client } = require('ssh2');
const sqlite3 = require('sqlite3').verbose();
const { DB_PATH } = require('../../../config/constants');
const db = new sqlite3.Database(DB_PATH);

async function renewvmess(username, exp, quota, limitip, serverId, harga = 0, hari = exp) {
  console.log(`⚙️ Renewing VMESS for ${username} | Exp: ${exp} | Quota: ${quota} GB | IP Limit: ${limitip}`);

  if (/\s/.test(username) || /[^a-zA-Z0-9]/.test(username)) {
    return '❌ Username tidak valid.';
  }

  return new Promise((resolve) => {
    db.get('SELECT * FROM Server WHERE id = ?', [serverId], async (err, server) => {
      if (err || !server) {
        console.error('❌ DB Error:', err?.message || 'Server tidak ditemukan');
        return resolve('❌ Server tidak ditemukan.');
      }

      console.log(`📡 Connecting to ${server.domain} for VMESS renewal...`);

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
quota=${quota}
ip_limit=${limitip}

# Check if user exists
if ! grep -q "^### \$user " /etc/xray/vmess/config.json 2>/dev/null; then
  echo "ERROR:User not found"
  exit 1
fi

# Get current expiry date from config
current_line=\$(grep "^### \$user " /etc/xray/vmess/config.json)
echo "DEBUG:Current line: \$current_line"

current_exp=\$(echo "\$current_line" | awk '{print \$3}')
echo "DEBUG:Current exp: \$current_exp"

# ALWAYS extend from current expiry, tidak peduli sudah expired atau belum
if [ -z "\$current_exp" ]; then
  echo "ERROR:No expiry date found"
  new_exp=\$(date -d "+\${exp_days} days" +%Y-%m-%d)
  echo "DEBUG:Using today as fallback: \$new_exp"
else
  # Extend dari current expiry
  new_exp=\$(date -d "\$current_exp +\${exp_days} days" +%Y-%m-%d 2>/dev/null)
  
  if [ -z "\$new_exp" ]; then
    echo "ERROR:Failed to calculate new date"
    new_exp=\$(date -d "+\${exp_days} days" +%Y-%m-%d)
  else
    echo "DEBUG:Extended \$current_exp + \${exp_days} days = \$new_exp"
  fi
fi

echo "SUCCESS_CALC"
echo "Old Expiry: \$current_exp"
echo "New Expiry: \$new_exp"

# Update expiry in config file
sed -i "s/^### \$user .*\$/### \$user \$new_exp/" /etc/xray/vmess/config.json

# Verify update
new_line=\$(grep "^### \$user " /etc/xray/vmess/config.json)
echo "DEBUG:After update: \$new_line"

# Update quota and IP limit
if [ "\$quota" != "0" ]; then
  quota_bytes=\$((quota * 1024 * 1024 * 1024))
  echo "\$quota_bytes" > /etc/xray/vmess/\${user}
  echo "\$ip_limit" > /etc/xray/vmess/\${user}IP
fi

# Update database file
db_file="/etc/xray/vmess/.vmess.db"
if [ -f "\$db_file" ]; then
  grep -v "^### \${user} " "\$db_file" > "\$db_file.tmp" 2>/dev/null || true
  mv "\$db_file.tmp" "\$db_file" 2>/dev/null || true
  uuid=\$(echo "\$new_line" | awk '{print \$NF}')
  echo "### \${user} \${new_exp} \${uuid}" >> "\$db_file"
fi

# Restart service
systemctl restart vmess@config 2>/dev/null || systemctl restart xray@vmess 2>/dev/null

echo "SUCCESS"
echo "Expired: \$new_exp"
echo "Quota: \${quota} GB"
echo "IP Limit: \$ip_limit"
`;

        console.log('🔨 Executing VMESS renewal command...');

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

            if (code !== 0) {
              console.error('❌ Command failed with exit code:', code);
              if (output.includes('ERROR:User not found')) {
                return resolve('❌ Username tidak ditemukan di server.');
              }
              return resolve('❌ Gagal memperpanjang akun VMESS di server.');
            }

            if (!output.includes('SUCCESS')) {
              return resolve('❌ Gagal memperpanjang akun VMESS.');
            }

            const expMatch = output.match(/Expired: ([^\n]+)/);
            const quotaMatch = output.match(/Quota: ([^\n]+)/);
            const ipMatch = output.match(/IP Limit: ([^\n]+)/);

            const expiredStr = expMatch ? new Date(expMatch[1]).toLocaleString('id-ID', { dateStyle: 'medium', timeStyle: 'short' }) : 'N/A';
            const quotaStr = quotaMatch ? quotaMatch[1] : `${quota} GB`;
            const ipStr = ipMatch ? ipMatch[1] : limitip;

            const msg = `
♻️ *RENEW VMESS PREMIUM* ♻️

🔹 *Informasi Perpanjangan*
┌─────────────────────
│🏷 *Harga           :* Rp ${harga.toLocaleString('id-ID')}
│🗓 *Perpanjang :* ${hari} Hari
│👤 *Username   :* \`${username}\`
│📦 *Kuota           :* \`${quotaStr}\`
│📱 *Batas IP       :* \`${ipStr}\`
│🕒 *Expired        :* \`${expiredStr}\`
└─────────────────────
✅ Akun berhasil diperpanjang.
`.trim();

            console.log('✅ VMESS renewed for', username);
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

module.exports = { renewvmess };