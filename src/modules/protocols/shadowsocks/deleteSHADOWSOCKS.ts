
import type { BotContext, DatabaseUser, DatabaseServer } from "../../../types";
const { Client } = require('ssh2');
const sqlite3 = require('sqlite3').verbose();
const { DB_PATH } = require('../../../config/constants');
const db = new sqlite3.Database(DB_PATH);

/**
 * Delete SHADOWSOCKS account from VPS server
 */
async function deleteShadowsocks(username: string, serverId: number): Promise<string> {
    console.log(`🗑️ Deleting SHADOWSOCKS account: ${username}`);

    if (/\s/.test(username) || /[^a-zA-Z0-9]/.test(username)) {
        return '❌ Username tidak valid.';
    }

    return new Promise((resolve) => {
        db.get('SELECT * FROM Server WHERE id = ?', [serverId], async (err, server) => {
            if (err || !server) {
                console.error('❌ DB Error:', err?.message || 'Server tidak ditemukan');
                return resolve('❌ Server tidak ditemukan.');
            }

            console.log(`📡 Connecting to ${server.domain} for SHADOWSOCKS deletion...`);

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

echo "DEBUG:Deleting SHADOWSOCKS user=$user"

# Check if user exists
if ! grep -q "^### $user " /etc/xray/shadowsocks/config.json 2>/dev/null; then
  echo "ERROR:User not found"
  exit 1
fi

# Remove from config.json
sed -i "/^### $user /d" /etc/xray/shadowsocks/config.json

# Remove from database
sed -i "/^### $user /d" /etc/xray/shadowsocks/.shadowsocks.db

# Remove quota/limit files
rm -f /etc/xray/shadowsocks/$user /etc/xray/shadowsocks/\${user}IP

# Restart service
systemctl restart shadowsocks@config 2>/dev/null || systemctl restart xray@shadowsocks 2>/dev/null

echo "SUCCESS"
echo "Deleted: $user"
`;

                console.log('🔨 Executing SHADOWSOCKS delete command...');

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
                                return resolve('⚠️ Username tidak ditemukan di server (mungkin sudah dihapus).');
                            }
                            return resolve('❌ Gagal menghapus akun SHADOWSOCKS di server.');
                        }

                        if (!output.includes('SUCCESS')) {
                            return resolve('❌ Gagal menghapus akun SHADOWSOCKS.');
                        }

                        console.log('✅ SHADOWSOCKS deleted from server:', username);
                        resolve('SUCCESS');
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
                            resolve('❌ Password root VPS salah.');
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

module.exports = { deleteShadowsocks };
