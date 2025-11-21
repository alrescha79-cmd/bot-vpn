/**
 * Configuration loader
 * Loads and exports configuration from .vars.json
 */

import fs from 'fs';
import path from 'path';

export interface VarsConfig {
  BOT_TOKEN: string;
  USER_ID: number | number[];
  ADMIN_USERNAME?: string;
  GROUP_ID: string;
  PORT?: number;
  NAMA_STORE?: string;
  DATA_QRIS: string;
  MERCHANT_ID: string;
  API_KEY: string;
  SSH_USER?: string;
  SSH_PASS?: string;
}

export interface Config {
  // Bot Configuration
  BOT_TOKEN: string;
  
  // Admin Configuration
  USER_ID: number | number[];
  ADMIN_USERNAME: string;
  
  // Group Configuration
  GROUP_ID: string;
  
  // Server Configuration
  PORT: number;
  
  // Store Configuration
  NAMA_STORE: string;
  
  // QRIS Payment Configuration
  DATA_QRIS: string;
  MERCHANT_ID: string;
  API_KEY: string;
  
  // SSH Configuration
  SSH_USER: string;
  SSH_PASS: string;
  
  // Computed values
  adminIds: string[];
  ADMIN_IDS: number[];
}

// Load configuration from .vars.json
const varsPath: string = path.resolve('./.vars.json');
const vars: VarsConfig = JSON.parse(fs.readFileSync(varsPath, 'utf8'));

const config: Config = {
  // Bot Configuration
  BOT_TOKEN: vars.BOT_TOKEN,
  
  // Admin Configuration
  USER_ID: vars.USER_ID,
  ADMIN_USERNAME: vars.ADMIN_USERNAME || 'Alrescha79',
  
  // Group Configuration
  GROUP_ID: vars.GROUP_ID,
  
  // Server Configuration
  PORT: vars.PORT || 50123,
  
  // Store Configuration
  NAMA_STORE: vars.NAMA_STORE || 'Alrescha79 Store',
  
  // QRIS Payment Configuration
  DATA_QRIS: vars.DATA_QRIS,
  MERCHANT_ID: vars.MERCHANT_ID,
  API_KEY: vars.API_KEY,
  
  // SSH Configuration
  SSH_USER: vars.SSH_USER || 'root',
  SSH_PASS: vars.SSH_PASS || '',
  
  // Computed values
  adminIds: Array.isArray(vars.USER_ID) 
    ? vars.USER_ID.map(String) 
    : [String(vars.USER_ID)],
  
  // Additional computed values
  ADMIN_IDS: Array.isArray(vars.USER_ID) 
    ? vars.USER_ID.map(id => Number(id))
    : [Number(vars.USER_ID)],
};

module.exports = config;
