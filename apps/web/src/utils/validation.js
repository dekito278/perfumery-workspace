
export const validateRequired = (value, fieldName) => {
  if (value === null || value === undefined || value === '') {
    return `${fieldName} is required`;
  }
  if (typeof value === 'string' && value.trim() === '') {
    return `${fieldName} is required`;
  }
  return '';
};

export const validateMinLength = (value, min, fieldName) => {
  if (value === null || value === undefined) return '';
  const strValue = String(value);
  if (strValue.length < min) {
    return `${fieldName} must be at least ${min} characters`;
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

export const validatePositiveNumber = (value, fieldName) => {
  if (value === null || value === undefined || value === '') {
    return '';
  }
  const numValue = Number(value);
  if (isNaN(numValue)) {
    return `${fieldName} must be a valid number`;
  }
  if (numValue <= 0) {
    return `${fieldName} must be greater than 0`;
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

export const validateEmail = (value) => {
  if (!value) return '';
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(value)) {
    return 'Please enter a valid email address';
  }
  return '';
};

export const validateUrl = (value) => {
  if (!value) return '';
  try {
    new URL(value);
    return '';
  } catch {
    return 'Please enter a valid URL';
  }
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

export const validateIngredientAmount = (value, fieldName = 'Ingredient amount') => {
  return validateGramAmount(value, fieldName);
};

export const validateAlphanumericWithDash = (value, fieldName) => {
  if (!value) return '';
  const regex = /^[a-zA-Z0-9-_]+$/;
  if (!regex.test(value)) {
    return `${fieldName} can only contain letters, numbers, dashes, and underscores`;
  }
  return '';
};

export const validateFormulaPercentage = (value) => {
  if (value === null || value === undefined || value === '') {
    return 'Formula percentage is required';
  }
  const numValue = Number(value);
  if (isNaN(numValue)) {
    return 'Formula percentage must be a valid number';
  }
  if (numValue <= 0 || numValue > 100) {
    return 'Formula percentage must be between 0 and 100';
  }
  return '';
};

export const validateTargetQuantity = (value) => {
  if (value === null || value === undefined || value === '') {
    return 'Target quantity is required';
  }
  const numValue = Number(value);
  if (isNaN(numValue)) {
    return 'Target quantity must be a valid number';
  }
  if (numValue <= 0) {
    return 'Target quantity must be greater than 0';
  }
  return '';
};

export const validateSolventSelection = (solventId, formulaIngredients = []) => {
  if (!solventId || solventId === '') {
    return 'Solvent material is required';
  }
  
  // Check if solvent is already in formula ingredients
  const isInFormula = formulaIngredients.some(ingredient => ingredient.item_id === solventId);
  if (isInFormula) {
    return 'Selected solvent is already used in the formula';
  }
  
  return '';
};
