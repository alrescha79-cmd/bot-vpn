#!/usr/bin/env node

/**
 * Test Account Extraction
 * Tests regex patterns against actual message formats
 */

// Sample VLESS message (from log)
const vlessMessage = `
         🔥 *VLESS PREMIUM ACCOUNT*
         
🔹 *Informasi Akun*
┌─────────────────────
│🏷 *Harga         :* Rp 35,000
│🗓 *Masa Aktif :* 7 Hari
│👤 *Username :* \`mboh\`
│🌐 *Domain     :* \`id.alrescha79.qzz.io\`
│🧾 *UUID         :* \`some-uuid-here\`
│ ╱ *Path             :* \`/whatever/vless\`
└─────────────────────
┌─────────────────────
│🔐 *Port TLS    :* \`443\`
│📡 *Port HTTP :* \`80\`
│🔁 *Network    :* WebSocket
│📦 *Kuota         :* 250 GB
│📱 *IP Limit      :* 2
└─────────────────────
┌─────────────────────
│🕒 *Expired :* \`24/12/2025, 09.50\`
│
│📥 Save       : https://id.alrescha79.qzz.io:81/vless-mboh.txt
└─────────────────────
`;

// Sample SSH message
const sshMessage = `
         🔥 *SSH PREMIUM ACCOUNT*
         
🔹 *Informasi Akun*
┌─────────────────────
│🏷 *Harga           :* Rp 30,000
│🗓 *Masa Aktif   :* 30 Hari
│👤 *Username   :* \`testuser\`
│🔑 *Password     :* \`pass123\`
│🌐 *Domain        :* \`sg1.example.com\`
└─────────────────────
┌─────────────────────
│🕒 *Expired   :* \`24/12/2025, 10.00\`
└─────────────────────
`;

function extractUsername(message) {
  const usernameMatch = message.match(/Username\s*:\*?\s*`([^`]+)`/i) ||
                        message.match(/👤\s*\*?Username\s*:\*?\s*`([^`]+)`/i) ||
                        message.match(/User\s*:\*?\s*`([^`]+)`/i);
  return usernameMatch ? usernameMatch[1].trim() : null;
}

function extractServer(message) {
  const serverMatch = message.match(/Domain\s*:\*?\s*`([^`]+)`/i) ||
                      message.match(/Host\s*:\*?\s*`([^`]+)`/i) ||
                      message.match(/Server\s*:\*?\s*`([^`]+)`/i) ||
                      message.match(/🌐\s*\*?Domain\s*:\*?\s*`([^`]+)`/i) ||
                      message.match(/Domain\s*:\s*([a-z0-9.-]+\.[a-z]{2,})/i);
  return serverMatch ? serverMatch[1].trim() : null;
}

function extractExpiryDate(message) {
  try {
    const expiredMatch = message.match(/Expired\s*:\*?\s*`([^`]+)`/i) ||
                        message.match(/Exp\s*:\*?\s*`([^`]+)`/i) ||
                        message.match(/🕒\s*\*?Expired\s*:\*?\s*`([^`]+)`/i) ||
                        message.match(/Expired\s*:\s*([^\n]+)/i);
    
    if (expiredMatch && expiredMatch[1]) {
      const expString = expiredMatch[1].trim();
      const expDate = new Date(expString);
      if (!isNaN(expDate.getTime())) {
        return expDate.toISOString();
      }
    }
    
    const daysMatch = message.match(/Masa Aktif\s*:\*?\s*(\d+)\s*Hari/i) ||
                      message.match(/🗓\s*\*?Masa Aktif\s*:\*?\s*(\d+)\s*Hari/i);
    if (daysMatch && daysMatch[1]) {
      const days = parseInt(daysMatch[1]);
      const expDate = new Date();
      expDate.setDate(expDate.getDate() + days);
      return expDate.toISOString();
    }
  } catch (error) {
    console.error('Error extracting expiry date:', error);
  }
  
  return null;
}

console.log('🧪 Testing Account Extraction Patterns\n');
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

console.log('📋 Test 1: VLESS Message');
console.log('Username:', extractUsername(vlessMessage) || '❌ NOT FOUND');
console.log('Server:', extractServer(vlessMessage) || '❌ NOT FOUND');
console.log('Expired:', extractExpiryDate(vlessMessage) || '❌ NOT FOUND');
console.log('');

console.log('📋 Test 2: SSH Message');
console.log('Username:', extractUsername(sshMessage) || '❌ NOT FOUND');
console.log('Server:', extractServer(sshMessage) || '❌ NOT FOUND');
console.log('Expired:', extractExpiryDate(sshMessage) || '❌ NOT FOUND');
console.log('');

console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
console.log('✅ Test complete!');
