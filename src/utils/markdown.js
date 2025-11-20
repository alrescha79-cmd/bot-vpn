/**
 * Markdown Utilities
 * Helper functions for formatting Telegram messages
 */

/**
 * Escape special characters for Markdown
 * @param {string|number} text - Text to escape
 * @returns {string}
 */
function escapeMarkdown(text) {
  return String(text).replace(/[_*[\]()~`>#+=|{}.!\\-]/g, '\\$&');
}

/**
 * Escape special characters for MarkdownV2
 * @param {string|number} text - Text to escape
 * @returns {string}
 */
function escapeMarkdownV2(text) {
  return String(text).replace(/[_*[\]()~`>#+=|{}.!\\-]/g, '\\$&');
}

/**
 * Format currency in IDR
 * @param {number} amount - Amount in Rupiah
 * @returns {string}
 */
function formatCurrency(amount) {
  return `Rp${amount.toLocaleString('id-ID')}`;
}

/**
 * Format date to Indonesian locale
 * @param {Date|string} date - Date object or string
 * @returns {string}
 */
function formatDate(date) {
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
function bold(text) {
  return `*${text}*`;
}

/**
 * Create italic text in Markdown
 * @param {string} text - Text to make italic
 * @returns {string}
 */
function italic(text) {
  return `_${text}_`;
}

/**
 * Create code block in Markdown
 * @param {string} text - Text to format as code
 * @returns {string}
 */
function code(text) {
  return `\`${text}\``;
}

/**
 * Create monospace text
 * @param {string} text - Text to format as monospace
 * @returns {string}
 */
function monospace(text) {
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
