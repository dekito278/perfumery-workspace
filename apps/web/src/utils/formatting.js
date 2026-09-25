
export const formatName = (value) => {
  if (value === null || value === undefined) return '';
  return String(value).trim();
};

export const formatCode = (value) => {
  if (value === null || value === undefined) return '';
  return String(value).trim().toUpperCase();
};

export const formatQuantity = (value, decimals = null) => {
  if (value === null || value === undefined) return '0';
  const numValue = Number(value);
  if (isNaN(numValue)) return '0';
  
  // Smart decimal handling if decimals not specified
  if (decimals === null) {
    if (numValue < 1) {
      // Values less than 1: show 3 decimals (0.001)
      return numValue.toFixed(3).replace(/\.?0+$/, '');
    } else if (numValue < 100) {
      // Values 1-100: show 2 decimals (1.00)
      return numValue.toFixed(2).replace(/\.?0+$/, '');
    } else if (numValue < 1000) {
      // Values 100-1000: show 1 decimal (100.0)
      return numValue.toFixed(1).replace(/\.?0+$/, '');
    } else {
      // Values >= 1000: show 0 decimals (1000)
      return numValue.toFixed(0);
    }
  }
  
  if (decimals === 0) {
    return numValue.toFixed(0);
  }

  // Use specified decimals and remove trailing zeros
  return numValue.toFixed(decimals).replace(/\.?0+$/, '');
};

export const formatGramAmount = (value) => {
  if (value === null || value === undefined) return '0 g';
  const numValue = Number(value);
  if (isNaN(numValue)) return '0 g';
  
  // Use smart decimal handling
  const formatted = formatQuantity(numValue);
  return `${formatted} g`;
};

export const formatAmountWithUnit = (value, unit = '') => {
  const formatted = formatQuantity(value);
  const normalizedUnit = formatUnit(unit);
  return normalizedUnit ? `${formatted} ${normalizedUnit}` : formatted;
};

export const formatPercentage = (value, decimals = 1) => {
  if (value === null || value === undefined) return '0.0%';
  const numValue = Number(value);
  if (isNaN(numValue)) return '0.0%';
  return `${numValue.toFixed(decimals)}%`;
};

export const formatCurrency = (value) => {
  if (value === null || value === undefined) return 'Rp 0';
  const numValue = Number(value);
  if (isNaN(numValue)) return 'Rp 0';
  
  // Check if the value has meaningful decimals
  const hasDecimals = numValue % 1 !== 0;
  
  if (hasDecimals) {
    // Format with decimals for values like cost per unit
    const formatted = numValue.toLocaleString('id-ID', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    });
    return `Rp ${formatted}`;
  } else {
    // Format without decimals for whole amounts
    const formatted = numValue.toLocaleString('id-ID', {
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    });
    return `Rp ${formatted}`;
  }
};

/**
 * A date, in the language of whoever is reading it.
 *
 * The locale is an ARGUMENT with an Indonesian default, not a lookup: this formatter has thirty-odd
 * callers and almost all of them are Studio, which is Indonesian on purpose and must not be translated.
 * The handful that face a buyer pass t('fmt.dateLocale') instead, so an English reader gets their own
 * month names.
 *
 * It mattered most where nobody was looking: the public tracking page. Someone in Berlin following a
 * parcel read "22 Mei 2026" on an otherwise English page — a date in a language they may not have, on
 * the one screen whose entire job is telling them when something arrives.
 */
export const formatDate = (value, locale = 'id-ID') => {
  if (!value) return 'N/A';
  try {
    const date = new Date(value);
    if (isNaN(date.getTime())) return 'N/A';
    // A STRING or nothing. MobileArticlesPage was already calling formatDate(value, t) — someone had
    // tried to make this locale-aware and the extra argument was being dropped on the floor, so the call
    // read as correct and did nothing. Turning that argument into a real one would have handed
    // toLocaleDateString a function and blanked the page.
    return date.toLocaleDateString(typeof locale === 'string' && locale ? locale : 'id-ID', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  } catch {
    return 'N/A';
  }
};

export const formatUnit = (value) => {
  if (value === null || value === undefined) return '';
  return String(value).toLowerCase();
};

export const formatStatus = (value) => {
  if (value === null || value === undefined) return '';
  return String(value)
    .split('_')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(' ');
};

export const formatNullable = (value, fallback = 'N/A') => {
  if (value === null || value === undefined || value === '') return fallback;
  return String(value);
};
