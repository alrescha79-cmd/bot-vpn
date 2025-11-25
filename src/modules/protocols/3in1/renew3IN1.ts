
import type { BotContext, DatabaseUser, DatabaseServer } from "../../../types";
const { Client } = require('ssh2');
const sqlite3 = require('sqlite3').verbose();
const { DB_PATH } = require('../../../config/constants');
const db = new sqlite3.Database(DB_PATH);

async function renew3in1(username, exp, quota, limitip, serverId, harga = 0, hari = exp) {
  if (/\s/.test(username) || /[^a-zA-Z0-9]/.test(username)) {
    return '❌ Username tidak valid.';
  }

  return new Promise((resolve) => {
    db.get('SELECT * FROM Server WHERE id = ?', [serverId], async (err, server) => {
      if (err || !server) {
        return resolve('❌ Server tidak ditemukan.');
      }

      console.log(`📡 Connecting to ${server.domain} for 3IN1 renewal...`);

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
        
        const expDate = new Date();
        expDate.setDate(expDate.getDate() + parseInt(exp));
        const expFormatted = expDate.toISOString().split('T')[0];
        
        const cmd = `
user="${username}"
exp_date="${expFormatted}"
duration=${exp}
quota=${quota}
ip_limit=${limitip}

# Check if user exists in all three protocols
protocols=(vmess vless trojan)
missing_protocols=()

for protocol in "\${protocols[@]}"; do
  if ! grep -q "^### \$user " /etc/xray/\$protocol/config.json 2>/dev/null; then
    missing_protocols+=("\$protocol")
  fi
done

if [ \${#missing_protocols[@]} -gt 0 ]; then
  echo "ERROR:User not found in: \${missing_protocols[*]}"
  exit 1
fi

# Update expiry date for all three protocols
for protocol in "\${protocols[@]}"; do
  # Update in config.json
  sed -i "/^### \$user /c\\### \$user \$exp_date" /etc/xray/\$protocol/config.json
  
  # Update in database
  db_file="/etc/xray/\$protocol/.\${protocol}.db"
  if [ -f "\$db_file" ]; then
    sed -i "/^### \$user /d" "\$db_file"
    uuid=\$(grep -A1 "^### \$user " /etc/xray/\$protocol/config.json | grep -oP '(id|password)": "\\K[^"]+' | head -1)
    echo "### \$user \$exp_date \$uuid" >> "\$db_file"
  fi
  
  # Update quota and IP limit if needed
  if [ "\$quota" != "0" ]; then
    quota_bytes=\$((quota * 1024 * 1024 * 1024))
    echo "\$quota_bytes" > /etc/xray/\$protocol/\${user}
    echo "\$ip_limit" > /etc/xray/\$protocol/\${user}IP
  fi
done

# Restart services
systemctl restart vmess@config vless@config trojan@config 2>/dev/null || systemctl restart xray@vmess xray@vless xray@trojan 2>/dev/null

echo "SUCCESS:\$exp_date"
`;
        
        console.log('🔨 Executing 3IN1 renewal command...');
        
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
                return resolve('❌ Akun tidak ditemukan di salah satu protokol. Pastikan akun 3IN1 sudah dibuat.');
              }
              return resolve('❌ Gagal memperpanjang akun 3IN1 (exit code ' + code + ').');
            }

            if (!output.includes('SUCCESS:')) {
              console.error('❌ No SUCCESS marker in output');
              return resolve('❌ Gagal memperpanjang akun 3IN1.');
            }

            try {
              const expDateStr = output.match(/SUCCESS:([^\s]+)/)?.[1];
              const expDate = new Date(expDateStr);
              const expiredStr = expDate.toLocaleString('id-ID', { dateStyle: 'medium', timeStyle: 'short' });

              const msg = `
♻️ *RENEW 3IN1 PREMIUM* ♻️
*(VMESS + VLESS + TROJAN)*

🔹 *Informasi Perpanjangan*
┌─────────────────────
│🏷 *Harga           :* Rp ${harga.toLocaleString('id-ID')}
│🗓 *Perpanjang :* ${hari} Hari
│👤 *Username   :* \`${username}\`
│📦 *Kuota           :* \`${quota} GB\`
│📱 *Batas IP       :* \`${limitip} IP\`
│🕒 *Expired        :* \`${expiredStr}\`
└─────────────────────

✅ Akun 3IN1 (VMESS + VLESS + TROJAN) berhasil diperpanjang!
              `.trim();

              console.log('✅ 3IN1 renewed for', username);
              resolve(msg);
            } catch (e) {
              console.error('❌ Failed to parse output:', e.message);
              resolve('❌ Gagal parsing output dari server.');
            }
          })
          .on('data', (data) => {
            output += data.toString();
          })
          .stderr.on('data', (data) => {
            const stderr = data.toString();
            console.warn('⚠️ STDERR:', stderr);
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
            resolve('❌ Tidak bisa koneksi ke server.');
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

module.exports = { renew3in1 };
