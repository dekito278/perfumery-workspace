
export const validateRequired = (value, fieldName) => {
  if (value === null || value === undefined || value === '') {
    return `${fieldName} is required`;
  }
  if (typeof value === 'string' && value.trim() === '') {
    return `${fieldName} is required`;
  }
  return '';
};

export const validateMaxLength = (value, max, fieldName) => {
  if (value === null || value === undefined) return '';
  const strValue = String(value);
  if (strValue.length > max) {
    return `${fieldName} must not exceed ${max} characters`;
  }
  return '';
};

export const validateNonNegativeNumber = (value, fieldName) => {
  if (value === null || value === undefined || value === '') {
    return '';
  }
  const numValue = Number(value);
  if (isNaN(numValue)) {
    return `${fieldName} must be a valid number`;
  }
  if (numValue < 0) {
    return `${fieldName} must be 0 or greater`;
  }
  return '';
};

export const validateGramAmount = (value, fieldName = 'Amount') => {
  if (value === null || value === undefined || value === '') {
    return `${fieldName} is required`;
  }
  const numValue = Number(value);
  if (isNaN(numValue)) {
    return `${fieldName} must be a valid number`;
  }
  if (numValue <= 0) {
    return `${fieldName} must be greater than 0`;
  }
  
  // Check decimal places (max 3)
  const strValue = String(value);
  const decimalIndex = strValue.indexOf('.');
  if (decimalIndex !== -1) {
    const decimalPart = strValue.substring(decimalIndex + 1);
    if (decimalPart.length > 3) {
      return `${fieldName} must have at most 3 decimal places`;
    }
  }
  
  return '';
};

