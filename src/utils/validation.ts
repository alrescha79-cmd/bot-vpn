/**
 * Validation Utilities
 * Input validation functions
 */

const { USERNAME_PATTERN, MIN_USERNAME_LENGTH, MAX_USERNAME_LENGTH } = require('../config/constants');

export interface ValidationResult {
  valid: boolean;
  error?: string;
  value?: number;
}

/**
 * Validate username format
 * @param {string} username - Username to validate
 * @returns {ValidationResult}
 */
export function validateUsername(username: string): ValidationResult {
  if (!username || typeof username !== 'string') {
    return { valid: false, error: 'Username harus berupa teks' };
  }

  if (username.length < MIN_USERNAME_LENGTH) {
    return { valid: false, error: `Username minimal ${MIN_USERNAME_LENGTH} karakter` };
  }

  if (username.length > MAX_USERNAME_LENGTH) {
    return { valid: false, error: `Username maksimal ${MAX_USERNAME_LENGTH} karakter` };
  }

  if (!USERNAME_PATTERN.test(username)) {
    return { valid: false, error: 'Username hanya boleh huruf dan angka (tanpa spasi)' };
  }

  return { valid: true };
}

/**
 * Validate positive number
 * @param {any} value - Value to validate
 * @returns {boolean}
 */
export function isPositiveNumber(value: any): boolean {
  const num = Number(value);
  return !isNaN(num) && num > 0;
}

/**
 * Validate domain format
 * @param {string} domain - Domain to validate
 * @returns {boolean}
 */
export function isValidDomain(domain: string): boolean {
  const domainPattern = /^([a-zA-Z0-9]([a-zA-Z0-9\-]{0,61}[a-zA-Z0-9])?\.)+[a-zA-Z]{2,}$/;
  return domainPattern.test(domain);
}

/**
 * Validate IP address
 * @param {string} ip - IP address to validate
 * @returns {boolean}
 */
export function isValidIP(ip: string): boolean {
  const ipPattern = /^(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$/;
  return ipPattern.test(ip);
}

/**
 * Sanitize input string
 * @param {string} input - Input to sanitize
 * @returns {string}
 */
export function sanitizeInput(input: string): string {
  return String(input).trim().replace(/[<>]/g, '');
}

/**
 * Validate amount range
 * @param {number} amount - Amount to validate
 * @param {number} min - Minimum value
 * @param {number} max - Maximum value
 * @returns {ValidationResult}
 */
export function validateAmount(amount: number, min: number = 0, max: number = Infinity): ValidationResult {
  const num = Number(amount);
  
  if (isNaN(num)) {
    return { valid: false, error: 'Jumlah harus berupa angka' };
  }
  
  if (num < min) {
    return { valid: false, error: `Jumlah minimal Rp${min.toLocaleString('id-ID')}` };
  }
  
  if (num > max) {
    return { valid: false, error: `Jumlah maksimal Rp${max.toLocaleString('id-ID')}` };
  }
  
  return { valid: true, value: num };
}

/**
 * Validate duration (days)
 * @param {any} days - Number of days
 * @returns {ValidationResult}
 */
export function validateDuration(days: any): ValidationResult {
  const num = Number(days);
  
  if (isNaN(num) || num <= 0 || !Number.isInteger(num)) {
    return { valid: false, error: 'Durasi harus berupa angka positif (hari)' };
  }
  
  if (num > 365) {
    return { valid: false, error: 'Durasi maksimal 365 hari' };
  }
  
  return { valid: true, value: num };
}

module.exports = {
  validateUsername,
  isPositiveNumber,
  isValidDomain,
  isValidIP,
  sanitizeInput,
  validateAmount,
  validateDuration
};
