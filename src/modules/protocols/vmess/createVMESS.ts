
import type { BotContext, DatabaseUser, DatabaseServer } from "../../../types";
const { Client } = require('ssh2');
const sqlite3 = require('sqlite3').verbose();
const fs = require('fs');
const path = require('path');
const { DB_PATH } = require('../../../config/constants');
const db = new sqlite3.Database(DB_PATH);

async function createvmess(username, exp, quota, limitip, serverId, harga = 0, hari = exp) {
  console.log(`⚙️ Creating VMESS for ${username} | Exp: ${exp} | Quota: ${quota} GB | IP Limit: ${limitip}`);

  if (/\s/.test(username) || /[^a-zA-Z0-9]/.test(username)) {
    return '❌ Username tidak valid. Gunakan hanya huruf dan angka tanpa spasi.';
  }

  return new Promise((resolve) => {
    db.get('SELECT * FROM Server WHERE id = ?', [serverId], async (err, server) => {
      if (err || !server) {
        console.error('❌ DB Error:', err?.message || 'Server tidak ditemukan');
        return resolve('❌ Server tidak ditemukan.');
      }

      console.log(`📡 Connecting to ${server.domain} with user root...`);

      const conn = new Client();
      let resolved = false;
      
      const globalTimeout = setTimeout(() => {
        if (!resolved) {
          resolved = true;
          console.error('❌ Global timeout after 35 seconds');
          conn.end();
          resolve('❌ Timeout koneksi ke server. Pastikan server online dan password benar.');
        }
      }, 35000);

      conn.on('ready', () => {
        console.log('✅ SSH Connection established');
        
        // Generate UUID
        const uuid = 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
          const r = Math.random() * 16 | 0, v = c === 'x' ? r : (r & 0x3 | 0x8);
          return v.toString(16);
        });
        
        // Hitung expired date
        const expDate = new Date();
        expDate.setDate(expDate.getDate() + parseInt(exp));
        const expFormatted = expDate.toISOString().split('T')[0]; // YYYY-MM-DD
        
        // Command untuk create VMESS (berdasarkan script addvmess)
        const cmd = `
user="${username}"
uuid="${uuid}"
exp_date="${expFormatted}"
duration=${exp}
quota=${quota}
ip_limit=${limitip}
domain=$(cat /etc/xray/domain 2>/dev/null || hostname -f)
city=$(cat /etc/xray/city 2>/dev/null || echo "Unknown")
pubkey=$(cat /etc/slowdns/server.pub 2>/dev/null || echo "")

if [ ! -f "/etc/xray/vmess/config.json" ]; then
  if [ -f "/etc/xray/config.json" ]; then
    CONFIG_FILE="/etc/xray/config.json"
  else
    mkdir -p /etc/xray/vmess
    echo '{"inbounds":[]}' > /etc/xray/vmess/config.json
    CONFIG_FILE="/etc/xray/vmess/config.json"
  fi
else
  CONFIG_FILE="/etc/xray/vmess/config.json"
fi

# Check if user already exists
if grep -q "^### \$user " "\$CONFIG_FILE" 2>/dev/null; then
  echo "ERROR:User already exists"
  exit 1
fi

# Add user to config
sed -i '/#vmess\$/a\\### '"\$user \$exp_date"'\\
},{"id": "'"\$uuid"'","email": "'"\$user"'"' "\$CONFIG_FILE" 2>/dev/null || sed -i '/#vmess/a\\### '"\$user \$exp_date"'\\
},{"id": "'"\$uuid"'","email": "'"\$user"'"' "\$CONFIG_FILE" 2>/dev/null || true

sed -i '/#vmessgrpc\$/a\\### '"\$user \$exp_date"'\\
},{"id": "'"\$uuid"'","email": "'"\$user"'"' "\$CONFIG_FILE" 2>/dev/null || true

# Generate VMESS links in base64 JSON format
vmess_json_tls=\$(cat <<VMESS_EOF | base64 -w 0
{
  "v": "2",
  "ps": "\${user}",
  "add": "\${domain}",
  "port": "443",
  "id": "\${uuid}",
  "aid": "0",
  "net": "ws",
  "path": "/whatever/vmess",
  "type": "none",
  "host": "\${domain}",
  "tls": "tls"
}
VMESS_EOF
)

vmess_json_nontls=\$(cat <<VMESS_EOF | base64 -w 0
{
  "v": "2",
  "ps": "\${user}",
  "add": "\${domain}",
  "port": "80",
  "id": "\${uuid}",
  "aid": "0",
  "net": "ws",
  "path": "/whatever/vmess",
  "type": "none",
  "host": "\${domain}",
  "tls": ""
}
VMESS_EOF
)

vmess_json_grpc=\$(cat <<VMESS_EOF | base64 -w 0
{
  "v": "2",
  "ps": "\${user}",
  "add": "\${domain}",
  "port": "443",
  "id": "\${uuid}",
  "aid": "0",
  "net": "grpc",
  "path": "",
  "type": "gun",
  "host": "\${domain}",
  "tls": "tls",
  "sni": "\${domain}",
  "alpn": "",
  "fp": "",
  "serviceName": "vmess-grpc"
}
VMESS_EOF
)

# Create config file for web
cat > /var/www/html/vmess-\$user.txt <<EOF
TLS Link : vmess://\${vmess_json_tls}
Non-TLS Link : vmess://\${vmess_json_nontls}
GRPC Link : vmess://\${vmess_json_grpc}
EOF

# Save quota and IP limit
if [ "\$quota" != "0" ]; then
  quota_bytes=\$((quota * 1024 * 1024 * 1024))
  echo "\$quota_bytes" > /etc/xray/vmess/\${user}
  echo "\$ip_limit" > /etc/xray/vmess/\${user}IP
fi

# Update database
db_file="/etc/xray/vmess/.vmess.db"
mkdir -p /etc/xray/vmess
touch \$db_file
grep -v "^### \${user} " "\$db_file" > "\$db_file.tmp" 2>/dev/null || true
mv "\$db_file.tmp" "\$db_file" 2>/dev/null || true
echo "### \${user} \${exp_date} \${uuid}" >> "\$db_file"

# Restart service
systemctl restart vmess@config 2>/dev/null || systemctl restart xray@vmess 2>/dev/null

# Output JSON with proper vmess links
vmess_json_tls=\$(cat <<VMESS_EOF | base64 -w 0
{
  "v": "2",
  "ps": "\${user}",
  "add": "\${domain}",
  "port": "443",
  "id": "\${uuid}",
  "aid": "0",
  "net": "ws",
  "path": "/whatever/vmess",
  "type": "none",
  "host": "\${domain}",
  "tls": "tls"
}
VMESS_EOF
)

vmess_json_nontls=\$(cat <<VMESS_EOF | base64 -w 0
{
  "v": "2",
  "ps": "\${user}",
  "add": "\${domain}",
  "port": "80",
  "id": "\${uuid}",
  "aid": "0",
  "net": "ws",
  "path": "/whatever/vmess",
  "type": "none",
  "host": "\${domain}",
  "tls": ""
}
VMESS_EOF
)

vmess_json_grpc=\$(cat <<VMESS_EOF | base64 -w 0
{
  "v": "2",
  "ps": "\${user}",
  "add": "\${domain}",
  "port": "443",
  "id": "\${uuid}",
  "aid": "0",
  "net": "grpc",
  "path": "",
  "type": "gun",
  "host": "\${domain}",
  "tls": "tls",
  "sni": "\${domain}",
  "alpn": "",
  "fp": "",
  "serviceName": "vmess-grpc"
}
VMESS_EOF
)

# Restart service
systemctl restart xray 2>/dev/null || systemctl restart vmess@config 2>/dev/null || systemctl restart xray@vmess 2>/dev/null || true

cat <<EOFDATA
{
  "status": "success",
  "username": "\$user",
  "uuid": "\$uuid",
  "domain": "\$domain",
  "city": "\$city",
  "pubkey": "\$pubkey",
  "expired": "\$exp_date",
  "quota": "\${quota} GB",
  "ip_limit": "\$ip_limit",
  "vmess_tls_link": "vmess://\${vmess_json_tls}",
  "vmess_nontls_link": "vmess://\${vmess_json_nontls}",
  "vmess_grpc_link": "vmess://\${vmess_json_grpc}"
}
EOFDATA
`;
        
        console.log('🔨 Executing VMESS creation command...');
        
        let output = '';
        const { wrapSSHCommand } = require('../../../services/ssh.service');
        const wrappedCmd = wrapSSHCommand(cmd, server.user_ssh || 'root', server.auth);
        
        conn.exec(wrappedCmd, (err, stream) => {
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

          let exitCode = 0;

          stream.on('exit', (code) => {
            if (code !== undefined && code !== null) {
              exitCode = code;
            }
          });

          stream.on('close', (code, signal) => {
            clearTimeout(globalTimeout);
            conn.end();
            
            if (resolved) return;
            resolved = true;
            
            const finalCode = (code !== undefined && code !== null) ? code : exitCode;
            console.log(`📝 Command finished with code: ${finalCode}`);
            console.log(`📄 Output: ${output.trim()}`);
            
            if (finalCode !== 0) {
              console.error('❌ Command failed with exit code:', finalCode);
              if (output.includes('ERROR:User already exists')) {
                return resolve('❌ Username sudah digunakan. Gunakan username lain.');
              }
              return resolve('❌ Gagal membuat akun VMESS di server (exit code ' + finalCode + ').');
            }

            try {
              // Parse JSON output
              const jsonStart = output.indexOf('{');
              const jsonEnd = output.lastIndexOf('}');
              if (jsonStart === -1 || jsonEnd === -1) {
                throw new Error('No JSON found in output');
              }
              const jsonStr = output.substring(jsonStart, jsonEnd + 1);
              const data = JSON.parse(jsonStr);
              
              if (data.status !== 'success') {
                throw new Error('Status not success');
              }

              let namaStore = 'Default Store';
              try {
                const config = require('../../../config').default || require('../../../config');
                namaStore = config.NAMA_STORE || 'Default Store';
              } catch (cfgErr) {
                namaStore = process.env.NAMA_STORE || 'Default Store';
              }
              
              const expDate = new Date();
              expDate.setDate(expDate.getDate() + parseInt(exp));

              const msg = `
         🔥 *VMESS PREMIUM ACCOUNT*
         
🔹 *Informasi Akun*
┌─────────────────────
│🏷 *Harga           :* Rp ${harga.toLocaleString('id-ID')}
│🗓 *Masa Aktif   :* ${hari} Hari
│👤 *Username   :* \`${data.username}\`
│🌐 *Domain        :* \`${data.domain}\`
│🧾 *UUID             :* \`${data.uuid}\`
│ ╱ *Path                 :* \`/whatever/vmess\`
└─────────────────────
┌─────────────────────
│🔐 *Port TLS     :* \`443\`
│📡 *Port HTTP  :* \`80\`
│🔁 *Network     :* WebSocket
│📦 *Quota         :* ${data.quota === '0 GB' ? 'Unlimited' : data.quota}
│📱 *IP Limit       :* ${data.ip_limit === '0' ? 'Unlimited' : data.ip_limit}
└─────────────────────
┌─────────────────────
│🕒 *Expired   :* \`${expDate.toLocaleString('id-ID', { dateStyle: 'medium', timeStyle: 'short' })}\`
│
│📥 Save          : https://${data.domain}:81/vmess-${data.username}.txt
└─────────────────────

🔗 *VMESS TLS:*
\`\`\`
${data.vmess_tls_link}
\`\`\`
🔗 *VMESS NON-TLS:*
\`\`\`
${data.vmess_nontls_link}
\`\`\`
🔗 *VMESS GRPC:*
\`\`\`
${data.vmess_grpc_link}
\`\`\`

✨ By : *${namaStore}* ✨
              `.trim();

              console.log('✅ VMESS created for', username);
              resolve(msg);
            } catch (e) {
              console.error('❌ Failed to parse JSON:', e.message);
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
            resolve('❌ Tidak bisa koneksi ke server. Cek apakah server online dan port 22 terbuka.');
          } else {
            resolve(`❌ Gagal koneksi SSH: ${err.message}`);
          }
        }
      })
      .connect({
        host: server.domain,
        port: server.port || 22,
        username: server.user_ssh || 'root',
        password: server.auth,
        readyTimeout: 30000,
        keepaliveInterval: 10000
      });
    });
  });
}

module.exports = { createvmess };
