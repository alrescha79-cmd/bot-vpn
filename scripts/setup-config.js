#!/usr/bin/env node

/**
 * Interactive Terminal Setup Wizard for Bot VPN
 * Usage: node scripts/setup-config.js
 */

const fs = require('fs');
const path = require('path');
const readline = require('readline');

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

const ask = (query, defaultValue = '') =>
  new Promise((resolve) => {
    const prompt = defaultValue ? `${query} [${defaultValue}]: ` : `${query}: `;
    rl.question(prompt, (answer) => {
      resolve(answer.trim() || defaultValue);
    });
  });

async function run() {
  console.log('\n╔══════════════════════════════════════════════════════════╗');
  console.log('║        🛠️  WIZARD KONFIGURASI BOT VPN TELEGRAM          ║');
  console.log('╚══════════════════════════════════════════════════════════╝\n');

  console.log('📌 1. Konfigurasi Utama Telegram & Admin');
  const BOT_TOKEN = await ask('• Bot Token (dari @BotFather)');
  const USER_ID = await ask('• Telegram User ID Admin (chat id)');
  const ADMIN_USERNAME = await ask('• Username Admin (tanpa @)', 'Admin');
  const GROUP_ID = await ask('• Group ID Notifikasi (opsional)');
  const NAMA_STORE = await ask('• Nama Store / VPN Service', 'Bot VPN Premium');
  const PORT = await ask('• Port Server Webhook / Web Config', '50123');

  console.log('\n💳 2. Payment Gateway (Tekan ENTER untuk lewati yang tidak digunakan)');

  console.log('\n🔵 Tripay Payment Gateway:');
  const TRIPAY_API_KEY = await ask('• Tripay API Key');
  const TRIPAY_PRIVATE_KEY = await ask('• Tripay Private Key');
  const TRIPAY_MERCHANT_CODE = await ask('• Tripay Merchant Code');
  const TRIPAY_ENV = TRIPAY_API_KEY ? await ask('• Environment (production/sandbox)', 'production') : 'production';

  console.log('\n🟢 Duitku Payment Gateway:');
  const DUITKU_MERCHANT_CODE = await ask('• Duitku Merchant Code');
  const DUITKU_API_KEY = await ask('• Duitku API Key');
  const DUITKU_ENV = DUITKU_MERCHANT_CODE ? await ask('• Environment (production/sandbox)', 'production') : 'production';

  console.log('\n🟢 Pakasir Payment Gateway:');
  const PAKASIR_PROJECT = await ask('• Pakasir Project Slug');
  const PAKASIR_API_KEY = await ask('• Pakasir API Key');

  console.log('\n🔶 Midtrans Payment Gateway:');
  const MERCHANT_ID = await ask('• Midtrans Merchant ID');
  const SERVER_KEY = await ask('• Midtrans Server Key');

  console.log('\n📱 Static QRIS String:');
  const DATA_QRIS = await ask('• String Data QRIS (Dana/Shopee/BCA)');

  const config = {
    BOT_TOKEN,
    USER_ID: USER_ID.includes(',') ? USER_ID.split(',').map(x => parseInt(x.trim())) : (parseInt(USER_ID) || USER_ID),
    ADMIN_USERNAME,
    GROUP_ID,
    NAMA_STORE,
    PORT: parseInt(PORT) || 50123,
    TRIPAY_API_KEY,
    TRIPAY_PRIVATE_KEY,
    TRIPAY_MERCHANT_CODE,
    TRIPAY_ENV,
    DUITKU_MERCHANT_CODE,
    DUITKU_API_KEY,
    DUITKU_ENV,
    PAKASIR_PROJECT,
    PAKASIR_API_KEY,
    MERCHANT_ID,
    SERVER_KEY,
    DATA_QRIS
  };

  const targetPath = path.resolve('./.vars.json');
  fs.writeFileSync(targetPath, JSON.stringify(config, null, 2), 'utf8');

  // Also create .env for Docker compatibility
  const envLines = [
    `NODE_ENV=production`,
    `PORT=${PORT}`,
    `BOT_TOKEN=${BOT_TOKEN}`,
    `USER_ID=${USER_ID}`,
    `ADMIN_USERNAME=${ADMIN_USERNAME}`,
    `GROUP_ID=${GROUP_ID}`,
    `NAMA_STORE=${NAMA_STORE}`,
    `TRIPAY_API_KEY=${TRIPAY_API_KEY}`,
    `TRIPAY_PRIVATE_KEY=${TRIPAY_PRIVATE_KEY}`,
    `TRIPAY_MERCHANT_CODE=${TRIPAY_MERCHANT_CODE}`,
    `TRIPAY_ENV=${TRIPAY_ENV}`,
    `DUITKU_MERCHANT_CODE=${DUITKU_MERCHANT_CODE}`,
    `DUITKU_API_KEY=${DUITKU_API_KEY}`,
    `DUITKU_ENV=${DUITKU_ENV}`,
    `PAKASIR_PROJECT=${PAKASIR_PROJECT}`,
    `PAKASIR_API_KEY=${PAKASIR_API_KEY}`,
    `MERCHANT_ID=${MERCHANT_ID}`,
    `SERVER_KEY=${SERVER_KEY}`,
    `DATA_QRIS=${DATA_QRIS}`
  ];
  fs.writeFileSync(path.resolve('./.env'), envLines.join('\n') + '\n', 'utf8');

  console.log('\n✅ Konfigurasi berhasil disimpan ke .vars.json dan .env!');
  console.log('🚀 Anda bisa langsung menjalankan bot dengan `npm start` atau `docker compose up -d`\n');
  rl.close();
}

run().catch((err) => {
  console.error('❌ Error during setup:', err);
  rl.close();
});
