#!/usr/bin/env node

/**
 * Clean Build Script
 * Ensures dist folder is clean and production-ready
 * - Removes old dist/
 * - Compiles TypeScript
 * - Copies only necessary assets (HTML, etc)
 * - Does NOT copy: .vars.json, *.db, *.sqlite, data/
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

console.log('🧹 Cleaning build artifacts...');

// Remove old dist folder
if (fs.existsSync('dist')) {
  fs.rmSync('dist', { recursive: true, force: true });
  console.log('✅ Removed old dist/');
}

console.log('🔨 Compiling TypeScript...');

// Compile TypeScript
try {
  execSync('tsc', { stdio: 'inherit' });
  console.log('✅ TypeScript compilation complete');
} catch (error) {
  console.error('❌ TypeScript compilation failed');
  process.exit(1);
}

console.log('📦 Copying frontend assets...');

// Create frontend directory in dist
const frontendSrc = path.join('src', 'frontend');
const frontendDist = path.join('dist', 'frontend');

if (fs.existsSync(frontendSrc)) {
  fs.mkdirSync(frontendDist, { recursive: true });
  
  // Copy HTML files
  const files = fs.readdirSync(frontendSrc);
  files.forEach(file => {
    if (file.endsWith('.html') || file.endsWith('.css') || file.endsWith('.js')) {
      fs.copyFileSync(
        path.join(frontendSrc, file),
        path.join(frontendDist, file)
      );
      console.log(`  ✅ Copied ${file}`);
    }
  });
}

console.log('');
console.log('═══════════════════════════════════════════════════════════');
console.log('✅ BUILD COMPLETE - PRODUCTION READY');
console.log('═══════════════════════════════════════════════════════════');
console.log('');
console.log('📂 Build output: ./dist/');
console.log('');
console.log('⚠️  IMPORTANT FOR DEPLOYMENT:');
console.log('   • .vars.json is NOT included in dist/');
console.log('   • Database files are NOT included in dist/');
console.log('   • You must configure via web interface on first run');
console.log('   • Database will be created automatically in ./data/');
console.log('');
console.log('═══════════════════════════════════════════════════════════');
console.log('');
