
import type { BotContext, DatabaseUser, DatabaseServer } from "../../../types";
const { Client } = require('ssh2');
const sqlite3 = require('sqlite3').verbose();
const { DB_PATH } = require('../../../config/constants');
const db = new sqlite3.Database(DB_PATH);

/**
 * Delete VMESS account from VPS server
 */
async function deleteVmess(username: string, serverId: number): Promise<string> {
    console.log(`🗑️ Deleting VMESS account: ${username}`);

    if (/\s/.test(username) || /[^a-zA-Z0-9]/.test(username)) {
        return '❌ Username tidak valid.';
    }

    return new Promise((resolve) => {
        db.get('SELECT * FROM Server WHERE id = ?', [serverId], async (err, server) => {
            if (err || !server) {
                console.error('❌ DB Error:', err?.message || 'Server tidak ditemukan');
                return resolve('❌ Server tidak ditemukan.');
            }

            console.log(`📡 Connecting to ${server.domain} for VMESS deletion...`);

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

echo "DEBUG:Deleting VMESS user=$user"

# Setup config file
if [ -f "/etc/xray/config.json" ]; then
  CONFIG_FILE="/etc/xray/config.json"
elif [ -f "/etc/xray/vmess/config.json" ]; then
  CONFIG_FILE="/etc/xray/vmess/config.json"
else
  CONFIG_FILE="/etc/xray/vmess/config.json"
fi

DB_FILE="/etc/xray/vmess/.vmess.db"

# Get UUID before deletion if db exists
uuid=""
if [ -f "\$DB_FILE" ]; then
  uuid=\$(grep -E "^### \$user " "\$DB_FILE" 2>/dev/null | awk '{print \$4}' | head -n1)
fi
if [ -z "\$uuid" ] && [ -f "\$CONFIG_FILE" ]; then
  uuid=\$(grep -B1 "\"email\": \"\$user\"" "\$CONFIG_FILE" 2>/dev/null | grep -oE '[0-9a-fA-F-]{36}' | head -n1)
fi
echo "DEBUG:UUID: \$uuid"

# Remove from config file
if [ -f "\$CONFIG_FILE" ]; then
  sed -i "/^### \$user /d" "\$CONFIG_FILE" 2>/dev/null || true
  if [ -n "\$uuid" ]; then
    sed -i "/\$uuid/d" "\$CONFIG_FILE" 2>/dev/null || true
  fi
  sed -i "/\"email\": \"\$user\"/d" "\$CONFIG_FILE" 2>/dev/null || true
fi

# Remove from database
if [ -f "\$DB_FILE" ]; then
  sed -i "/^### \$user /d" "\$DB_FILE" 2>/dev/null || true
fi

# Remove quota/limit and html files
rm -f /etc/xray/vmess/\$user /etc/xray/vmess/\${user}IP /var/www/html/vmess-\$user.txt 2>/dev/null || true

# Restart service
systemctl restart xray 2>/dev/null || systemctl restart vmess@config 2>/dev/null || systemctl restart xray@vmess 2>/dev/null || true

echo "SUCCESS"
echo "Deleted: \$user"
`;

                console.log('🔨 Executing VMESS delete command...');

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
                            return resolve('❌ Gagal menghapus akun VMESS di server.');
                        }

                        if (!output.includes('SUCCESS')) {
                            return resolve('❌ Gagal menghapus akun VMESS.');
                        }

                        console.log('✅ VMESS deleted from server:', username);
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
                    port: server.port || 22,
                    username: server.user_ssh || 'root',
                    password: server.auth,
                    readyTimeout: 30000,
                    keepaliveInterval: 10000
                });
        });
    });
}

module.exports = { deleteVmess };
