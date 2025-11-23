/**
 * Configuration Service
 * Handles reading, writing, and validating configuration
 */

import fs from 'fs';
import path from 'path';

const VARS_FILE = path.resolve('./.vars.json');
const VARS_EXAMPLE_FILE = path.resolve('./.vars.json.example');

export interface ConfigData {
  BOT_TOKEN: string;
  USER_ID: number | number[];
  GROUP_ID: string;
  NAMA_STORE?: string;
  PORT?: number | string;
  DATA_QRIS: string;
  MERCHANT_ID: string;
  API_KEY: string;
  ADMIN_USERNAME?: string;
}

class ConfigService {
  /**
   * Check if configuration exists
   */
  isConfigured(): boolean {
    return fs.existsSync(VARS_FILE);
  }

  /**
   * Read current configuration
   */
  readConfig(): ConfigData | null {
    try {
      if (!this.isConfigured()) {
        return null;
      }
      const content = fs.readFileSync(VARS_FILE, 'utf-8');
      return JSON.parse(content);
    } catch (error) {
      console.error('Error reading config:', error);
      return null;
    }
  }

  /**
   * Read example configuration
   */
  readExampleConfig(): Partial<ConfigData> | null {
    try {
      if (!fs.existsSync(VARS_EXAMPLE_FILE)) {
        return null;
      }
      const content = fs.readFileSync(VARS_EXAMPLE_FILE, 'utf-8');
      return JSON.parse(content);
    } catch (error) {
      console.error('Error reading example config:', error);
      return null;
    }
  }

  /**
   * Write configuration to file
   */
  writeConfig(config: ConfigData): boolean {
    try {
      // Validate required fields
      this.validateConfig(config);

      // Write to file with pretty formatting
      fs.writeFileSync(VARS_FILE, JSON.stringify(config, null, 2), 'utf-8');
      return true;
    } catch (error) {
      console.error('Error writing config:', error);
      throw error;
    }
  }

  /**
   * Validate configuration data
   */
  private validateConfig(config: ConfigData): void {
    const requiredFields = [
      'BOT_TOKEN',
      'USER_ID',
      'GROUP_ID',
      'DATA_QRIS',
      'MERCHANT_ID',
      'API_KEY'
    ];

    const missing: string[] = [];
    
    for (const field of requiredFields) {
      if (!config[field as keyof ConfigData]) {
        missing.push(field);
      }
    }

    if (missing.length > 0) {
      throw new Error(`Missing required fields: ${missing.join(', ')}`);
    }

    // Validate USER_ID format
    if (config.USER_ID) {
      if (Array.isArray(config.USER_ID)) {
        if (config.USER_ID.length === 0) {
          throw new Error('USER_ID array cannot be empty');
        }
        for (const id of config.USER_ID) {
          if (typeof id !== 'number' || isNaN(id)) {
            throw new Error('USER_ID must contain valid numbers');
          }
        }
      } else if (typeof config.USER_ID !== 'number' || isNaN(config.USER_ID)) {
        throw new Error('USER_ID must be a number or array of numbers');
      }
    }

    // Validate PORT if provided
    if (config.PORT) {
      const port = typeof config.PORT === 'string' ? parseInt(config.PORT) : config.PORT;
      if (isNaN(port) || port < 1 || port > 65535) {
        throw new Error('PORT must be between 1 and 65535');
      }
    }
  }

  /**
   * Get configuration status and data
   */
  getConfigStatus(): {
    configured: boolean;
    config?: ConfigData;
    example?: Partial<ConfigData>;
  } {
    const configured = this.isConfigured();
    const config = configured ? this.readConfig() : undefined;
    const example = !configured ? this.readExampleConfig() : undefined;

    return {
      configured,
      config: config || undefined,
      example: example || undefined
    };
  }
}

export const configService = new ConfigService();

// CommonJS export for compatibility
module.exports = { configService, ConfigService };
