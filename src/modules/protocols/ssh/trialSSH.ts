
import type { BotContext, DatabaseUser, DatabaseServer } from "../../../types";
const { Client } = require('ssh2');
const sqlite3 = require('sqlite3').verbose();
const { DB_PATH } = require('../../../config/constants');
const db = new sqlite3.Database(DB_PATH);

async function trialssh(serverId) {
  console.log(`⚙️ Creating SSH Trial for server ${serverId}`);

  return new Promise((resolve) => {
    db.get('SELECT * FROM Server WHERE id = ?', [serverId], async (err, server) => {
      if (err || !server) {
        console.error('❌ DB Error:', err?.message || 'Server not found');
        return resolve({ status: 'error', message: 'Server tidak ditemukan.' });
      }

      console.log(`📡 Connecting to ${server.domain} with user root...`);

      const conn = new Client();
      let resolved = false;
      
      const globalTimeout = setTimeout(() => {
        if (!resolved) {
          resolved = true;
          console.error('❌ Global timeout after 45 seconds');
          conn.end();
          resolve({ status: 'error', message: 'Timeout - Server terlalu lama merespon.' });
        }
      }, 45000);

      conn.on('ready', () => {
        console.log('✅ SSH Connection established');
        
        const cmd = `
set -e
user="trial\$(date +%s | tail -c 5)"
password="\$user"
duration=60
domain=\$(cat /etc/xray/domain 2>/dev/null || hostname -f)
ip=\$(hostname -I | awk '{print \$1}')
ns_domain=\$(cat /etc/xray/dns 2>/dev/null || echo "")
city=\$(cat /etc/xray/city 2>/dev/null || echo "Unknown")
pubkey=\$(cat /etc/slowdns/server.pub 2>/dev/null || echo "")
exp=\$(date -d "+\$duration minutes" +"%Y-%m-%d %H:%M:%S")

# Create trial user
useradd -M -N -s /bin/false "\$user" 2>/dev/null || exit 1
echo "\$user:\$password" | chpasswd || exit 1

# Auto delete after 1 hour
(nohup bash -c "sleep 3600; userdel -f \$user 2>/dev/null" >/dev/null 2>&1 &)

cat <<EOFDATA
{
  "status": "success",
  "username": "\$user",
  "password": "\$password",
  "ip": "\$ip",
  "domain": "\$domain",
  "ns_domain": "\$ns_domain",
  "city": "\$city",
  "public_key": "\$pubkey",
  "expiration": "\$exp"
}
EOFDATA
`;
        
        console.log('🔨 Executing trial SSH command...');
        
        let output = '';
        
        conn.exec(cmd, { timeout: 40000 }, (err, stream) => {
          if (err) {
            clearTimeout(globalTimeout);
            if (!resolved) {
              resolved = true;
              console.error('❌ Exec error:', err.message);
              conn.end();
              return resolve({ status: 'error', message: 'Gagal eksekusi command SSH.' });
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
              return resolve({ status: 'error', message: `Gagal membuat trial SSH (exit code ${code}).` });
            }

            try {
              // Parse JSON output
              const jsonStart = output.indexOf('{');
              const jsonEnd = output.lastIndexOf('}');
              if (jsonStart === -1 || jsonEnd === -1) {
                throw new Error('No JSON found in output');
              }
              const jsonStr = output.substring(jsonStart, jsonEnd + 1);
              const result = JSON.parse(jsonStr);
              
              // Add ports info
              result.ports = {
                openssh: "22, 80, 443",
                udp_ssh: "1-65535",
                dns: "443, 53, 22",
                dropbear: "443, 109",
                ssh_ws: "80, 8080",
                ssh_ssl_ws: "443",
                ssl_tls: "443",
                ovpn_ssl: "443",
                ovpn_tcp: "1194",
                ovpn_udp: "2200"
              };
              result.openvpn_link = `https://${result.domain}:81/allovpn.zip`;
              result.save_link = `https://${result.domain}:81/ssh-${result.username}.txt`;
              result.wss_payload = `GET wss://bugmu.com/ HTTP/1.1[crlf]Host: ${result.domain}[crlf]Upgrade: websocket[crlf][crlf]`;
              
              console.log('✅ SSH Trial created:', result.username);
              resolve(result);
            } catch (e) {
              console.error('❌ Failed to parse JSON:', e.message);
              resolve({ status: 'error', message: 'Gagal parsing output dari server.' });
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
            resolve({ status: 'error', message: 'Server tidak ditemukan. Cek domain/IP server.' });
          } else if (err.level === 'client-authentication') {
            resolve({ status: 'error', message: 'Password root VPS salah. Update di database.' });
          } else if (err.code === 'ETIMEDOUT' || err.code === 'ECONNREFUSED') {
            resolve({ status: 'error', message: 'Tidak bisa koneksi ke server. Cek apakah server online.' });
          } else {
            resolve({ status: 'error', message: `Gagal koneksi SSH: ${err.message}` });
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

module.exports = { trialssh };
