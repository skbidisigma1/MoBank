/**
 * MoBucks Currency Formatter
 * Formats currency values with the custom MoBucks icon
 */

/**
 * Formats a number as MoBucks with the custom icon
 * @param {number} amount - The amount to format
 * @param {Object} options - Formatting options
 * @param {boolean} options.showSign - Whether to show +/- sign (default: false)
 * @param {string} options.iconSize - Icon size class: 'small', 'large', 'xlarge', or default
 * @param {boolean} options.absolute - Whether to use absolute value (default: false)
 * @returns {string} HTML string with the formatted currency
 */
function formatMoBucks(amount, options = {}) {
  const {
    showSign = false,
    iconSize = '',
    absolute = false
  } = options;
  
  const numAmount = Number(amount || 0);
  const absAmount = Math.abs(numAmount);
  const formattedAmount = absAmount.toLocaleString();
  
  let sign = '';
  if (showSign && numAmount !== 0) {
    sign = numAmount > 0 ? '+' : '-';
  } else if (!absolute && numAmount < 0) {
    sign = '-';
  }
  
  const iconClass = iconSize ? `mobucks-icon mobucks-icon--${iconSize}` : 'mobucks-icon';
  
  return `${sign}<span class="${iconClass}"></span>${absolute ? absAmount.toLocaleString() : formattedAmount}`;
}

/**
 * Formats a number as plain MoBucks text (for backend messages)
 * @param {number} amount - The amount to format
 * @returns {string} Plain text formatted currency
 */
function formatMoBucksPlain(amount) {
  const numAmount = Number(amount || 0);
  const absAmount = Math.abs(numAmount);
  const sign = numAmount < 0 ? '-' : '';
  return `${sign}$${absAmount.toLocaleString()}`;
}

/**
 * Gets the pluralized form of MoBuck/MoBucks
 * @param {number} amount - The amount
 * @returns {string} 'MoBuck' or 'MoBucks'
 */
function pluralizeMoBucks(amount) {
  return Math.abs(amount) === 1 ? 'MoBuck' : 'MoBucks';
}

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { formatMoBucks, formatMoBucksPlain, pluralizeMoBucks };
}
