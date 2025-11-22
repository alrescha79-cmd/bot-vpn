
const fs = require('fs');
const path = require('path');
import type { BotContext, DatabaseUser, DatabaseServer } from "../../../types";
const { Client } = require('ssh2');
const sqlite3 = require('sqlite3').verbose();
const db = new sqlite3.Database('./botvpn.db');

async function createvless(username, exp, quota, limitip, serverId, harga = 0, hari = exp) {
  console.log(`⚙️ Creating VLESS for ${username} | Exp: ${exp} | Quota: ${quota} GB | IP Limit: ${limitip}`);

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
          resolve('❌ Timeout koneksi ke server.');
        }
      }, 35000);

      conn.on('ready', () => {
        console.log('✅ SSH Connection established');
        
        // Generate UUID
        const uuid = 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
          const r = Math.random() * 16 | 0, v = c === 'x' ? r : (r & 0x3 | 0x8);
          return v.toString(16);
        });
        
        const expDate = new Date();
        expDate.setDate(expDate.getDate() + parseInt(exp));
        const expFormatted = expDate.toISOString().split('T')[0];
        
        const cmd = `
user="${username}"
uuid="${uuid}"
exp_date="${expFormatted}"
quota=${quota}
ip_limit=${limitip}
domain=$(cat /etc/xray/domain 2>/dev/null || hostname -f)
city=$(cat /etc/xray/city 2>/dev/null || echo "Unknown")
pubkey=$(cat /etc/slowdns/server.pub 2>/dev/null || echo "")

mkdir -p /etc/xray/vless

if [ ! -f "/etc/xray/vless/config.json" ]; then
  echo '{"inbounds":[]}' > /etc/xray/vless/config.json
fi

if grep -q "^### \$user " /etc/xray/vless/config.json 2>/dev/null; then
  echo "ERROR:User already exists"
  exit 1
fi

sed -i '/#vless$/a\\### '"\$user \$exp_date"'\\
},{"id": "'"\$uuid"'","email": "'"\$user"'"' /etc/xray/vless/config.json

sed -i '/#vlessgrpc$/a\\### '"\$user \$exp_date"'\\
},{"id": "'"\$uuid"'","email": "'"\$user"'"' /etc/xray/vless/config.json

cat > /var/www/html/vless-\$user.txt <<EOF
TLS Link : vless://\${uuid}@\${domain}:443?encryption=none&security=tls&sni=\${domain}&type=ws&host=\${domain}&path=%2Fwhatever%2Fvless#\${user}
Non-TLS Link : vless://\${uuid}@\${domain}:80?encryption=none&security=none&type=ws&host=\${domain}&path=%2Fwhatever%2Fvless#\${user}
GRPC Link : vless://\${uuid}@\${domain}:443?encryption=none&security=tls&type=grpc&serviceName=vless-grpc&sni=\${domain}#\${user}
EOF

if [ "\$quota" != "0" ]; then
  quota_bytes=\$((quota * 1024 * 1024 * 1024))
  echo "\$quota_bytes" > /etc/xray/vless/\${user}
  echo "\$ip_limit" > /etc/xray/vless/\${user}IP
fi

db_file="/etc/xray/vless/.vless.db"
mkdir -p /etc/xray/vless
touch \$db_file
grep -v "^### \${user} " "\$db_file" > "\$db_file.tmp" 2>/dev/null || true
mv "\$db_file.tmp" "\$db_file" 2>/dev/null || true
echo "### \${user} \${exp_date} \${uuid}" >> "\$db_file"

systemctl restart vless@config 2>/dev/null || systemctl restart xray@vless 2>/dev/null

vless_tls="vless://\${uuid}@\${domain}:443?encryption=none&security=tls&sni=\${domain}&type=ws&host=\${domain}&path=%2Fwhatever%2Fvless#\${user}"
vless_non="vless://\${uuid}@\${domain}:80?encryption=none&security=none&type=ws&host=\${domain}&path=%2Fwhatever%2Fvless#\${user}"
vless_grpc="vless://\${uuid}@\${domain}:443?encryption=none&security=tls&type=grpc&serviceName=vless-grpc&sni=\${domain}#\${user}"

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
  "vless_tls_link": "\$vless_tls",
  "vless_nontls_link": "\$vless_non",
  "vless_grpc_link": "\$vless_grpc"
}
EOFDATA
`;
        
        console.log('🔨 Executing VLESS creation command...');
        
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
              if (output.includes('ERROR:User already exists')) {
                return resolve('❌ Username sudah digunakan. Gunakan username lain.');
              }
              return resolve('❌ Gagal membuat akun VLESS di server.');
            }

            try {
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
         🔥 *VLESS PREMIUM ACCOUNT*
         
🔹 *Informasi Akun*
┌─────────────────────
│🏷 *Harga         :* Rp ${harga.toLocaleString('id-ID')}
│🗓 *Masa Aktif :* ${hari} Hari
│👤 *Username :* \`${data.username}\`
│🌐 *Domain     :* \`${data.domain}\`
│🧾 *UUID         :* \`${data.uuid}\`
│ ╱ *Path             :* \`/whatever/vless\`
└─────────────────────
┌─────────────────────
│🔐 *Port TLS    :* \`443\`
│📡 *Port HTTP :* \`80\`
│🔁 *Network    :* WebSocket
│📦 *Kuota         :* ${data.quota === '0 GB' ? 'Unlimited' : data.quota}
│📱 *IP Limit      :* ${data.ip_limit === '0' ? 'Unlimited' : data.ip_limit}
└─────────────────────
┌─────────────────────
│🕒 *Expired :* \`${expDate.toLocaleString('id-ID', { dateStyle: 'medium', timeStyle: 'short' })}\`
│
│📥 Save       : https://${data.domain}:81/vless-${data.username}.txt
└─────────────────────

🔗 *VLESS TLS:*
\`\`\`
${data.vless_tls_link}
\`\`\`
🔗 *VLESS NON-TLS:*
\`\`\`
${data.vless_nontls_link}
\`\`\`
🔗 *VLESS GRPC:*
\`\`\`
${data.vless_grpc_link}
\`\`\`

✨ By : *${namaStore}* ✨
`.trim();

              console.log('✅ VLESS created for', username);
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

module.exports = { createvless };
