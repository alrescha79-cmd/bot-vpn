"use strict";
/**
 * Configuration loader
 * Loads and exports configuration from .vars.json
 */
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
// Load configuration from .vars.json
const varsPath = path_1.default.resolve('./.vars.json');
const vars = JSON.parse(fs_1.default.readFileSync(varsPath, 'utf8'));
const config = {
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
