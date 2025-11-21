/**
 * Markdown Utilities
 * Helper functions for formatting Telegram messages
 */

/**
 * Escape special characters for Markdown
 * @param {string|number} text - Text to escape
 * @returns {string}
 */
export function escapeMarkdown(text: string | number): string {
  return String(text).replace(/[_*[\]()~`>#+=|{}.!\\-]/g, '\\$&');
}

/**
 * Escape special characters for MarkdownV2
 * @param {string|number} text - Text to escape
 * @returns {string}
 */
export function escapeMarkdownV2(text: string | number): string {
  return String(text).replace(/[_*[\]()~`>#+=|{}.!\\-]/g, '\\$&');
}

/**
 * Format currency in IDR
 * @param {number} amount - Amount in Rupiah
 * @returns {string}
 */
export function formatCurrency(amount: number): string {
  return `Rp${amount.toLocaleString('id-ID')}`;
}

/**
 * Format date to Indonesian locale
 * @param {Date|string} date - Date object or string
 * @returns {string}
 */
export function formatDate(date: Date | string): string {
  const d = date instanceof Date ? date : new Date(date);
  return d.toLocaleString('id-ID', {
    dateStyle: 'medium',
    timeStyle: 'short'
  });
}

/**
 * Create bold text in Markdown
 * @param {string} text - Text to make bold
 * @returns {string}
 */
export function bold(text: string): string {
  return `*${text}*`;
}

/**
 * Create italic text in Markdown
 * @param {string} text - Text to make italic
 * @returns {string}
 */
export function italic(text: string): string {
  return `_${text}_`;
}

/**
 * Create code block in Markdown
 * @param {string} text - Text to format as code
 * @returns {string}
 */
export function code(text: string): string {
  return `\`${text}\``;
}

/**
 * Create monospace text
 * @param {string} text - Text to format as monospace
 * @returns {string}
 */
export function monospace(text: string): string {
  return `\`\`\`\n${text}\n\`\`\``;
}

module.exports = {
  escapeMarkdown,
  escapeMarkdownV2,
  formatCurrency,
  formatDate,
  bold,
  italic,
  code,
  monospace
};
