
import type { BotContext, DatabaseUser, DatabaseServer } from "../../../types";
const { Client } = require('ssh2');
const sqlite3 = require('sqlite3').verbose();
const { DB_PATH } = require('../../../config/constants');
const db = new sqlite3.Database(DB_PATH);

async function renewvless(username, exp, quota, limitip, serverId, harga = 0, hari = exp) {
  console.log(`⚙️ Renewing VLESS for ${username} | Exp: ${exp} | Quota: ${quota} GB | IP Limit: ${limitip}`);

  if (/\s/.test(username) || /[^a-zA-Z0-9]/.test(username)) {
    return '❌ Username tidak valid.';
  }

  return new Promise((resolve) => {
    db.get('SELECT * FROM Server WHERE id = ?', [serverId], async (err, server) => {
      if (err || !server) {
        console.error('❌ DB Error:', err?.message || 'Server tidak ditemukan');
        return resolve('❌ Server tidak ditemukan.');
      }

      console.log(`📡 Connecting to ${server.domain} for VLESS renewal...`);

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

# Check if user exists and get current expiry
if ! grep -q "^### \$user " /etc/xray/vless/config.json 2>/dev/null; then
  echo "ERROR:User not found"
  exit 1
fi

# Get current expiry date from config
current_exp=\$(grep "^### \$user " /etc/xray/vless/config.json | awk '{print \$3}')
echo "DEBUG:Current expiry: \$current_exp"

# Calculate new expiry: current_exp + exp_days
if [ -z "\$current_exp" ]; then
  exp_date=\$(date -d "+\${exp_days} days" +%Y-%m-%d)
else
  current_timestamp=\$(date -d "\$current_exp" +%s 2>/dev/null || echo 0)
  today_timestamp=\$(date +%s)
  
  if [ \$current_timestamp -lt \$today_timestamp ]; then
    exp_date=\$(date -d "+\${exp_days} days" +%Y-%m-%d)
  else
    exp_date=\$(date -d "\$current_exp +\${exp_days} days" +%Y-%m-%d)
  fi
fi

echo "DEBUG:New expiry will be: \$exp_date"

# Update expiry date in config
sed -i "/^### \$user /c\### \$user \$exp_date" /etc/xray/vless/config.json

# Update quota and IP limit
if [ "\$quota" != "0" ]; then
  quota_bytes=\$((quota * 1024 * 1024 * 1024))
  echo "\$quota_bytes" > /etc/xray/vless/\${user}
  echo "\$ip_limit" > /etc/xray/vless/\${user}IP
fi

# Update database file
db_file="/etc/xray/vless/.vless.db"
if [ -f "\$db_file" ]; then
  grep -v "^### \${user} " "\$db_file" > "\$db_file.tmp" 2>/dev/null || true
  mv "\$db_file.tmp" "\$db_file" 2>/dev/null || true
  uuid=\$(grep "^### \$user " /etc/xray/vless/config.json | awk '{print \$NF}')
  echo "### \${user} \${exp_date} \${uuid}" >> "\$db_file"
fi

# Restart service
systemctl restart vless@config 2>/dev/null || systemctl restart xray@vless 2>/dev/null

echo "SUCCESS"
echo "Expired: \$exp_date"
echo "Quota: \${quota} GB"
echo "IP Limit: \$ip_limit"
`;

        console.log('🔨 Executing VLESS renewal command...');

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
              return resolve('❌ Gagal memperpanjang akun VLESS di server.');
            }

            if (!output.includes('SUCCESS')) {
              return resolve('❌ Gagal memperpanjang akun VLESS.');
            }

            const expMatch = output.match(/Expired: ([^\n]+)/);
            const quotaMatch = output.match(/Quota: ([^\n]+)/);
            const ipMatch = output.match(/IP Limit: ([^\n]+)/);

            const expiredStr = expMatch ? new Date(expMatch[1]).toLocaleString('id-ID', { dateStyle: 'medium', timeStyle: 'short' }) : 'N/A';
            const quotaStr = quotaMatch ? quotaMatch[1] : `${quota} GB`;
            const ipStr = ipMatch ? ipMatch[1] : limitip;

            const msg = `
♻️ *RENEW VLESS PREMIUM* ♻️

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

            console.log('✅ VLESS renewed for', username);
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

module.exports = { renewvless };