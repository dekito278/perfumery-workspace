
export const validateRequired = (value, fieldName) => {
  if (value === null || value === undefined || value === '') {
    return `${fieldName} wajib diisi`;
  }
  if (typeof value === 'string' && value.trim() === '') {
    return `${fieldName} wajib diisi`;
  }
  return '';
};

export const validateMaxLength = (value, max, fieldName) => {
  if (value === null || value === undefined) return '';
  const strValue = String(value);
  if (strValue.length > max) {
    return `${fieldName} maksimal ${max} karakter`;
  }
  return '';
};

export const validateNonNegativeNumber = (value, fieldName) => {
  if (value === null || value === undefined || value === '') {
    return '';
  }
  const numValue = Number(value);
  if (isNaN(numValue)) {
    return `${fieldName} harus berupa angka`;
  }
  if (numValue < 0) {
    return `${fieldName} tidak boleh negatif`;
  }
  return '';
};

export const validateGramAmount = (value, fieldName = 'Jumlah') => {
  if (value === null || value === undefined || value === '') {
    return `${fieldName} wajib diisi`;
  }
  const numValue = Number(value);
  if (isNaN(numValue)) {
    return `${fieldName} harus berupa angka`;
  }
  if (numValue <= 0) {
    return `${fieldName} harus lebih dari 0`;
  }
  
  // Check decimal places (max 3)
  const strValue = String(value);
  const decimalIndex = strValue.indexOf('.');
  if (decimalIndex !== -1) {
    const decimalPart = strValue.substring(decimalIndex + 1);
    if (decimalPart.length > 3) {
      return `${fieldName} paling banyak 3 angka di belakang koma`;
    }
  }
  
  return '';
};

