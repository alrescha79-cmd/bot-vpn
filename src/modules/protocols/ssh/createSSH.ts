
import type { BotContext, DatabaseUser, DatabaseServer } from "../../../types";
const { Client } = require('ssh2');
const sqlite3 = require('sqlite3').verbose();
const { DB_PATH } = require('../../../config/constants');
const db = new sqlite3.Database(DB_PATH);

async function createssh(username, password, exp, iplimit, serverId, harga = 0, hari = exp) {
  console.log(`⚙️ Creating SSH for ${username} | Exp: ${exp} | IP Limit: ${iplimit}`);

  if (/\s/.test(username) || /[^a-zA-Z0-9]/.test(username)) {
    return '❌ Username tidak valid.';
  }

  return new Promise((resolve) => {
    db.get('SELECT * FROM Server WHERE id = ?', [serverId], async (err, server) => {
      if (err || !server) {
        console.error('❌ DB Error:', err?.message || 'Server not found');
        return resolve('❌ Server tidak ditemukan.');
      }

      console.log(`📡 Connecting to ${server.domain} with user root...`);

      const conn = new Client();
      let resolved = false; // Flag untuk prevent double resolve
      
      // Global timeout
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
        
        // Hitung expired date
        const expDate = new Date();
        expDate.setDate(expDate.getDate() + parseInt(exp));
        const expFormatted = expDate.toISOString().split('T')[0]; // YYYY-MM-DD
        
        // Command with proper user existence check
        const cmd = `
# Check if user already exists
if id "${username}" &>/dev/null; then
  echo "ERROR:User already exists"
  exit 1
fi

# Create user
useradd -M -N -s /bin/false -e ${expFormatted} ${username} || exit 1

# Set password
echo "${username}:${password}" | chpasswd || exit 1

# Save to database
mkdir -p /etc/ssh
echo "### ${username} ${expFormatted} ${iplimit}" >> /etc/ssh/.ssh.db

echo "SUCCESS"
`;
        
        console.log('🔨 Executing command...');
        
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
            
            if (resolved) return; // Sudah di-resolve
            resolved = true;
            
            console.log(`📝 Command finished with code: ${code}`);
            console.log(`📄 Output: ${output.trim()}`);
            
            if (code !== 0) {
              console.error('❌ Command failed with exit code:', code);
              if (output.includes('ERROR:User already exists')) {
                return resolve('❌ Username sudah digunakan. Gunakan username lain.');
              }
              return resolve('❌ Gagal membuat akun SSH di server (exit code ' + code + ').');
            }

            if (!output.includes('SUCCESS')) {
              console.error('❌ No SUCCESS marker in output');
              return resolve('❌ Gagal membuat akun SSH. Command tidak berhasil.');
            }
            
            // Success! Generate response
            const expDateDisplay = new Date();
            expDateDisplay.setDate(expDateDisplay.getDate() + parseInt(exp));
            
            const varsPath = require('path').join(__dirname, '../../../../.vars.json');
            const vars = JSON.parse(require('fs').readFileSync(varsPath, 'utf8'));
            const namaStore = vars.NAMA_STORE || 'Default Store';
            
            const msg = `
         🔥 *SSH PREMIUM ACCOUNT*
         
🔹 *Informasi Akun*
┌─────────────────────
│🏷 *Harga           :* Rp ${harga.toLocaleString('id-ID')}
│🗓 *Masa Aktif   :* ${hari} Hari
│👤 *Username   :* \`${username}\`
│🔑 *Password     :* \`${password}\`
│🌐 *Domain        :* \`${server.domain}\`
└─────────────────────
┌─────────────────────
│🔐 *Port TLS     :* \`443\`
│🌍 *Port HTTP  :* \`80\`
│🛡 *Port SSH    :* \`22\`
│🌐 *SSH WS      :* \`80\`
│🔐 *SSL WS       :* \`443\`
│🧱 *Dropbear   :* \`109, 443\`
│🧭 *DNS             :* \`53, 443, 22\`
│📥 *OVPN           :* \`1194, 2200, 443\`
│📱 *IP Limit        :* ${iplimit === 0 || iplimit === '0' ? 'Unlimited' : iplimit + ' IP'}
└─────────────────────
┌─────────────────────
│🕒 *Expired   :* \`${expDateDisplay.toLocaleString('id-ID', { dateStyle: 'medium', timeStyle: 'short' })}\`
│
│📥 Save         : https://${server.domain}:81/ssh-${username}.txt
│📦 OVPN       : https://${server.domain}:81/allovpn.zip
└─────────────────────

✨ By : *${namaStore}* ✨


            `.trim();

            resolve(msg);
          })
          .on('data', (data) => {
            output += data.toString();
          })
          .stderr.on('data', (data) => {
            const stderr = data.toString();
            console.warn('⚠️ STDERR:', stderr);
            // Don't treat stderr as error - useradd outputs warnings to stderr
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
        username: 'root',
        password: server.auth,
        readyTimeout: 30000,
        keepaliveInterval: 10000
      });
    });
  });
}

module.exports = { createssh };