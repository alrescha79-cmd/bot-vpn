
import type { BotContext, DatabaseUser, DatabaseServer } from "../../../types";
const { Client } = require('ssh2');
const sqlite3 = require('sqlite3').verbose();
const fs = require('fs');
const path = require('path');
const { DB_PATH } = require('../../../config/constants');
const db = new sqlite3.Database(DB_PATH);

async function create3in1(username, exp, quota, limitip, serverId, harga = 0, hari = exp) {
  console.log(`⚙️ Creating 3IN1 (VMESS+VLESS+TROJAN) for ${username} | Exp: ${exp} | Quota: ${quota} GB | IP Limit: ${limitip}`);

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
          console.error('❌ Global timeout after 45 seconds');
          conn.end();
          resolve('❌ Timeout koneksi ke server. Pastikan server online dan password benar.');
        }
      }, 45000);

      conn.on('ready', () => {
        console.log('✅ SSH Connection established');
        
        // Generate single UUID for all protocols
        const uuid = 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
          const r = Math.random() * 16 | 0, v = c === 'x' ? r : (r & 0x3 | 0x8);
          return v.toString(16);
        });
        
        // Hitung expired date
        const expDate = new Date();
        expDate.setDate(expDate.getDate() + parseInt(exp));
        const expFormatted = expDate.toISOString().split('T')[0]; // YYYY-MM-DD
        
        // Command untuk create 3IN1 (VMESS + VLESS + TROJAN)
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

# Create directories
mkdir -p /etc/xray/{vmess,vless,trojan}

# Initialize config files if not exist
for protocol in vmess vless trojan; do
  if [ ! -f "/etc/xray/\$protocol/config.json" ]; then
    echo '{"inbounds":[]}' > /etc/xray/\$protocol/config.json
  fi
done

# Check if user already exists in any protocol
for protocol in vmess vless trojan; do
  if grep -q "^### \$user " /etc/xray/\$protocol/config.json 2>/dev/null; then
    echo "ERROR:User already exists in \$protocol"
    exit 1
  fi
done

# Add VMESS user
sed -i '/#vmess$/a\\### '"\$user \$exp_date"'\\
},{"id": "'"\$uuid"'","email": "'"\$user"'"' /etc/xray/vmess/config.json

sed -i '/#vmessgrpc$/a\\### '"\$user \$exp_date"'\\
},{"id": "'"\$uuid"'","email": "'"\$user"'"' /etc/xray/vmess/config.json

# Add VLESS user
sed -i '/#vless$/a\\### '"\$user \$exp_date"'\\
},{"id": "'"\$uuid"'","email": "'"\$user"'"' /etc/xray/vless/config.json

sed -i '/#vlessgrpc$/a\\### '"\$user \$exp_date"'\\
},{"id": "'"\$uuid"'","email": "'"\$user"'"' /etc/xray/vless/config.json

# Add TROJAN user
sed -i '/#trojan$/a\\### '"\$user \$exp_date"'\\
},{"password": "'"\$uuid"'","email": "'"\$user"'"' /etc/xray/trojan/config.json

sed -i '/#trojangrpc$/a\\### '"\$user \$exp_date"'\\
},{"password": "'"\$uuid"'","email": "'"\$user"'"' /etc/xray/trojan/config.json

# Save quota and IP limit for all protocols
if [ "\$quota" != "0" ]; then
  quota_bytes=\$((quota * 1024 * 1024 * 1024))
  for protocol in vmess vless trojan; do
    echo "\$quota_bytes" > /etc/xray/\$protocol/\${user}
    echo "\$ip_limit" > /etc/xray/\$protocol/\${user}IP
  done
fi

# Update databases
for protocol in vmess vless trojan; do
  db_file="/etc/xray/\$protocol/.\${protocol}.db"
  mkdir -p /etc/xray/\$protocol
  touch \$db_file
  grep -v "^### \${user} " "\$db_file" > "\$db_file.tmp" 2>/dev/null || true
  mv "\$db_file.tmp" "\$db_file" 2>/dev/null || true
  echo "### \${user} \${exp_date} \${uuid}" >> "\$db_file"
done

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

# Generate VLESS links
vless_tls="vless://\${uuid}@\${domain}:443?encryption=none&security=tls&sni=\${domain}&type=ws&host=\${domain}&path=%2Fwhatever%2Fvless#\${user}"
vless_grpc="vless://\${uuid}@\${domain}:443?encryption=none&security=tls&type=grpc&serviceName=vless-grpc&sni=\${domain}#\${user}"

# Generate TROJAN links
trojan_tls="trojan://\${uuid}@\${domain}:443?path=/trojan-ws&security=tls&host=\${domain}&type=ws&sni=\${domain}#\${user}"
trojan_grpc="trojan://\${uuid}@\${domain}:443?mode=gun&security=tls&type=grpc&serviceName=trojan-grpc&sni=\${domain}#\${user}"

# Create config file for web
cat > /var/www/html/3in1-\$user.txt <<EOF
=== VMESS ===
TLS: vmess://\${vmess_json_tls}
GRPC: vmess://\${vmess_json_grpc}

=== VLESS ===
TLS: \${vless_tls}
GRPC: \${vless_grpc}

=== TROJAN ===
TLS: \${trojan_tls}
GRPC: \${trojan_grpc}
EOF

# Restart services
systemctl restart vmess@config vless@config trojan@config 2>/dev/null || systemctl restart xray@vmess xray@vless xray@trojan 2>/dev/null

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
  "vmess_grpc_link": "vmess://\${vmess_json_grpc}",
  "vless_tls_link": "\${vless_tls}",
  "vless_grpc_link": "\${vless_grpc}",
  "trojan_tls_link": "\${trojan_tls}",
  "trojan_grpc_link": "\${trojan_grpc}"
}
EOFDATA
`;
        
        console.log('🔨 Executing 3IN1 creation command...');
        
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
              if (output.includes('ERROR:User already exists')) {
                return resolve('❌ Username sudah digunakan. Gunakan username lain.');
              }
              return resolve('❌ Gagal membuat akun 3IN1 di server (exit code ' + code + ').');
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

              const varsPath = path.join(__dirname, '../../../../.vars.json');
              const vars = JSON.parse(fs.readFileSync(varsPath, 'utf8'));
              const namaStore = vars.NAMA_STORE || 'Default Store';
              
              const expDate = new Date();
              expDate.setDate(expDate.getDate() + parseInt(exp));

              const msg = `
         🔥 *3 IN 1 PREMIUM ACCOUNT*
         *(VMESS + VLESS + TROJAN)*
         
🔹 *Informasi Akun*
┌─────────────────────
│🏷 *Harga           :* Rp ${harga.toLocaleString('id-ID')}
│🗓 *Masa Aktif   :* ${hari} Hari
│👤 *Username   :* \`${data.username}\`
│🌐 *Domain        :* \`${data.domain}\`
│🧾 *UUID             :* \`${data.uuid}\`
└─────────────────────
┌─────────────────────
│🔐 *Port TLS     :* \`443\`
│📡 *Port HTTP  :* \`80\`
│🔁 *Network     :* WebSocket, gRPC
│📦 *Quota         :* ${data.quota === '0 GB' ? 'Unlimited' : data.quota}
│📱 *IP Limit       :* ${data.ip_limit === '0' ? 'Unlimited' : data.ip_limit}
└─────────────────────
┌─────────────────────
│🕒 *Expired   :* \`${expDate.toLocaleString('id-ID', { dateStyle: 'medium', timeStyle: 'short' })}\`
│
│📥 Save          : https://${data.domain}:81/3in1-${data.username}.txt
└─────────────────────

━━━━━━━━━━━━━━━━━━━━━━
📡 *VMESS LINKS*
━━━━━━━━━━━━━━━━━━━━━━

🔗 *TLS:*
\`\`\`
${data.vmess_tls_link}
\`\`\`

🔗 *GRPC:*
\`\`\`
${data.vmess_grpc_link}
\`\`\`

━━━━━━━━━━━━━━━━━━━━━━
🌐 *VLESS LINKS*
━━━━━━━━━━━━━━━━━━━━━━

🔗 *TLS:*
\`\`\`
${data.vless_tls_link}
\`\`\`

🔗 *GRPC:*
\`\`\`
${data.vless_grpc_link}
\`\`\`

━━━━━━━━━━━━━━━━━━━━━━
🔒 *TROJAN LINKS*
━━━━━━━━━━━━━━━━━━━━━━

🔗 *TLS:*
\`\`\`
${data.trojan_tls_link}
\`\`\`

🔗 *GRPC:*
\`\`\`
${data.trojan_grpc_link}
\`\`\`

✨ By : *${namaStore}* ✨
              `.trim();

              console.log('✅ 3IN1 created for', username);
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
        port: 22,
        username: 'root',
        password: server.auth,
        readyTimeout: 30000,
        keepaliveInterval: 10000
      });
    });
  });
}

module.exports = { create3in1 };
