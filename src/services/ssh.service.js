/**
 * SSH Service
 * SSH connection management and command execution
 */

const { Client } = require('ssh2');
const { SSH_TIMEOUT_MS } = require('../config/constants');
const logger = require('../utils/logger');

class SSHService {
  /**
   * Execute command on remote server via SSH
   * @param {Object} serverConfig - Server configuration
   * @param {string} command - Command to execute
   * @param {number} timeout - Timeout in milliseconds
   * @returns {Promise<string>}
   */
  static executeCommand(serverConfig, command, timeout = SSH_TIMEOUT_MS) {
    return new Promise((resolve, reject) => {
      const conn = new Client();
      let resolved = false;

      // Set timeout
      const timeoutId = setTimeout(() => {
        if (!resolved) {
          resolved = true;
          conn.end();
          reject(new Error('SSH connection timeout'));
        }
      }, timeout);

      conn.on('ready', () => {
        conn.exec(command, (err, stream) => {
          if (err) {
            clearTimeout(timeoutId);
            if (!resolved) {
              resolved = true;
              conn.end();
              reject(err);
            }
            return;
          }

          let output = '';
          let errorOutput = '';

          stream.on('data', (data) => {
            output += data.toString();
          });

          stream.stderr.on('data', (data) => {
            errorOutput += data.toString();
          });

          stream.on('close', (code) => {
            clearTimeout(timeoutId);
            if (!resolved) {
              resolved = true;
              conn.end();

              if (code !== 0 && errorOutput) {
                reject(new Error(`Command failed: ${errorOutput}`));
              } else {
                resolve(output);
              }
            }
          });
        });
      });

      conn.on('error', (err) => {
        clearTimeout(timeoutId);
        if (!resolved) {
          resolved = true;
          logger.error(`SSH connection error: ${err.message}`);
          reject(err);
        }
      });

      conn.connect({
        host: serverConfig.host || serverConfig.domain,
        username: serverConfig.username || 'root',
        password: serverConfig.password || serverConfig.auth,
        port: serverConfig.port || 22,
        readyTimeout: timeout
      });
    });
  }

  /**
   * Execute command and parse JSON output
   * @param {Object} serverConfig - Server configuration
   * @param {string} command - Command to execute
   * @returns {Promise<Object>}
   */
  static async executeCommandWithJSON(serverConfig, command) {
    try {
      const output = await this.executeCommand(serverConfig, command);
      
      // Try to extract JSON from output
      const jsonMatch = output.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        return JSON.parse(jsonMatch[0]);
      }

      // If no JSON found, return raw output
      return { output };
    } catch (error) {
      logger.error(`SSH command execution failed: ${error.message}`);
      throw error;
    }
  }

  /**
   * Test SSH connection
   * @param {Object} serverConfig - Server configuration
   * @returns {Promise<boolean>}
   */
  static async testConnection(serverConfig) {
    try {
      await this.executeCommand(serverConfig, 'echo "test"', 10000);
      return true;
    } catch (error) {
      logger.error(`SSH connection test failed: ${error.message}`);
      return false;
    }
  }

  /**
   * Get server information
   * @param {Object} serverConfig - Server configuration
   * @returns {Promise<Object>}
   */
  static async getServerInfo(serverConfig) {
    try {
      const output = await this.executeCommand(
        serverConfig,
        'uname -a && free -m && df -h'
      );

      return {
        success: true,
        info: output
      };
    } catch (error) {
      logger.error(`Failed to get server info: ${error.message}`);
      throw error;
    }
  }
}

module.exports = SSHService;
