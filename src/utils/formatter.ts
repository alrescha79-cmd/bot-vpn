/**
 * Formatter Utilities
 * Format data for display
 * @module utils/formatter
 */

const { escapeMarkdownV2 } = require('./markdown');

export interface Server {
  id?: number;
  nama_server: string;
  harga: number;
  quota: number;
  iplimit: number;
  lokasi?: string;
  isp?: string;
  total_create_akun: number;
  batas_create_akun: number;
  domain?: string;
  auth?: string;
}

export interface InvoiceData {
  mention: string;
  actionLabel: string;
  label: string;
  serverNama: string;
  ipLimit: number;
  username: string;
  type: string;
  hargaFinal: number;
  durasiHari: number;
  komisi?: number;
  isReseller: boolean;
  waktuSekarang: string;
}

export interface ResellerStatsData {
  level: string;
  totalAkun: number;
  totalKomisi: number;
  recentSales: RecentSale[];
}

export interface RecentSale {
  akun_type: string;
  username: string;
  komisi: number;
  created_at: string;
}

export interface Reseller {
  reseller_id: string;
  username?: string;
  total_komisi?: number;
  total_create?: number;
}

export interface User {
  user_id: string;
  username?: string;
  role: string;
  saldo: number;
}

export interface TelegrafContext {
  from: {
    username?: string;
    first_name: string;
  };
}

/**
 * Format server info for display
 * @param {Server} server - Server object
 * @param {string} flagEmoji - Flag emoji
 * @returns {string}
 */
export function formatServerInfo(server: Server, flagEmoji: string = '🌐'): string {
  const harga30 = server.harga * 30;
  const isFull = server.total_create_akun >= server.batas_create_akun;
  const status = isFull ? '❌ PENUH' : '✅ Tersedia';

  return `
━━━━━━━━━━━━━━━━━━━━━━
${flagEmoji} *Server:* ${server.nama_server}
💵 Rp${server.harga.toLocaleString('id-ID')} / hari
💳 Rp${harga30.toLocaleString('id-ID')} / bulan
📊 Kuota: *${server.quota} GB*
🔢 IP Max: *${server.iplimit}*
📍 Lokasi: *${server.lokasi || '-'}*
🏢 ISP: *${server.isp || '-'}*
📈 Akun: *${server.total_create_akun}/${server.batas_create_akun}*
🧭 Status: *${status}*
━━━━━━━━━━━━━━━━━━━━━━`.trim();
}

/**
 * Format invoice message
 * @param {InvoiceData} data - Invoice data
 * @returns {string}
 */
export function formatInvoice(data: InvoiceData): string {
  const {
    mention,
    actionLabel,
    label,
    serverNama,
    ipLimit,
    username,
    type,
    hargaFinal,
    durasiHari,
    komisi,
    isReseller,
    waktuSekarang
  } = data;

  return `
━━━━━━━━━━━━━━━━━━━━━━━        
🚀 𝗦𝗨𝗖𝗖𝗘𝗦𝗦𝗙𝗨𝗟 𝗧𝗥𝗔𝗡𝗦𝗔𝗖𝗧𝗜𝗢𝗡
━━━━━━━━━━━━━━━━━━━━━━━
👤 𝗨𝘀𝗲𝗿: ${mention}
${actionLabel}: ${label}
🌐 𝗦𝗲𝗿𝘃𝗲𝗿: ${serverNama} | ${ipLimit} IP
🔖 𝗨𝘀𝗲𝗿𝗻𝗮𝗺𝗲: ${username}
🏪 𝗣𝗿𝗼𝘁𝗼𝗰𝗼𝗹: ${type.toUpperCase()}
💴 𝗛𝗮𝗿𝗴𝗮: Rp${hargaFinal.toLocaleString('id-ID')}
⏳ 𝗗𝘂𝗿𝗮𝘀𝗶: ${durasiHari} hari
${isReseller ? `📊 𝗞𝗼𝗺𝗶𝘀𝗶: Rp${komisi?.toLocaleString('id-ID') || 0}\n` : ''}🕒 𝗪𝗮𝗸𝘁𝘂: ${waktuSekarang}
━━━━━━━━━━━━━━━━━━━━━━━`.trim();
}

/**
 * Format reseller stats
 * @param {ResellerStatsData} data - Reseller data
 * @returns {string}
 */
export function formatResellerStats(data: ResellerStatsData): string {
  const { level, totalAkun, totalKomisi, recentSales } = data;

  const list = recentSales.map((r, i) =>
    `🔹 ${r.akun_type.toUpperCase()} - ${r.username} (+Rp${r.komisi}) 🕒 ${r.created_at}`
  ).join('\n') || '_Belum ada transaksi_';

  return `💰 *Statistik Komisi Reseller*\n\n` +
    `🎖️ Level: ${level}\n` +
    `🧑‍💻 Total Akun Terjual: ${totalAkun}\n` +
    `💸 Total Komisi: Rp${totalKomisi.toLocaleString('id-ID')}\n\n` +
    `📜 *Transaksi Terbaru:*\n${list}`;
}

/**
 * Format top resellers list
 * @param {Reseller[]} resellers
 * @returns {string}
 */
export function formatTopResellers(resellers: Reseller[]): string {
  const medals = ['🥇', '🥈', '🥉'];
  
  return resellers.map((r, i) => {
    const mention = r.username
      ? `@${escapeMarkdownV2(r.username)}`
      : `ID\\_${escapeMarkdownV2(r.reseller_id)}`;
    const komisi = escapeMarkdownV2((r.total_komisi || 0).toLocaleString('id-ID'));
    const totalAkun = escapeMarkdownV2(r.total_create || 0);
    const medal = medals[i] || '🎖️';
    
    return `${medal} ${mention} \\- ${totalAkun} akun \\(Rp${komisi}\\)`;
  }).join('\n');
}

/**
 * Format user mention
 * @param {TelegrafContext} ctx - Context object
 * @returns {string}
 */
export function formatUserMention(ctx: TelegrafContext): string {
  return ctx.from.username ? `@${ctx.from.username}` : ctx.from.first_name;
}

/**
 * Format role label
 * @param {string} role
 * @param {string} resellerLevel
 * @returns {string}
 */
export function formatRoleLabel(role: string, resellerLevel: string = 'silver'): string {
  if (role === 'admin') return '👑 Admin';
  if (role === 'reseller') return `🏆 Reseller (${resellerLevel.toUpperCase()})`;
  return 'User';
}

/**
 * Format server list for admin
 * @param {Server[]} servers
 * @returns {string}
 */
export function formatServerList(servers: Server[]): string {
  return servers.map((row, i) => {
    return `${i + 1}. ${row.nama_server}\n` +
      `🌐 Domain: ${row.domain}\n` +
      `🔐 Auth: ${row.auth}\n` +
      `💾 Quota: ${row.quota} GB\n` +
      `🌍 IP Limit: ${row.iplimit}\n` +
      `📦 Harga: Rp${row.harga.toLocaleString('id-ID')}\n` +
      `🧮 Total Buat: ${row.total_create_akun}`;
  }).join('\n──────────────\n');
}

/**
 * Format user list for admin
 * @param {User[]} users
 * @returns {string}
 */
export function formatUserList(users: User[]): string {
  return users.map((row, i) => {
    const mention = row.username
      ? `@${escapeMarkdownV2(row.username)}`
      : `ID: \`${escapeMarkdownV2(row.user_id)}\``;

    return `🔹 ${mention}\n*Role*: ${escapeMarkdownV2(row.role)}\n*Saldo*: Rp${escapeMarkdownV2(row.saldo.toLocaleString('id-ID'))}`;
  }).join('\n\n');
}

module.exports = {
  formatServerInfo,
  formatInvoice,
  formatResellerStats,
  formatTopResellers,
  formatUserMention,
  formatRoleLabel,
  formatServerList,
  formatUserList
};
