
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

export const formatDate = (value) => {
  if (!value) return 'N/A';
  try {
    const date = new Date(value);
    if (isNaN(date.getTime())) return 'N/A';
    return date.toLocaleDateString('en-US', { 
      year: 'numeric', 
      month: 'short', 
      day: 'numeric' 
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
