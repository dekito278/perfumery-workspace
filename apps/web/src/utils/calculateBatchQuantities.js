
export const calculateBatchQuantities = (targetQuantity, formulaPercentage) => {
  // Validate inputs
  if (targetQuantity === null || targetQuantity === undefined || targetQuantity <= 0) {
    throw new Error('Target quantity must be greater than 0');
  }
  
  if (formulaPercentage === null || formulaPercentage === undefined || formulaPercentage <= 0 || formulaPercentage > 100) {
    throw new Error('Formula percentage must be between 0 and 100');
  }

  // Calculate quantities
  const formulaQuantityNeeded = (targetQuantity * formulaPercentage) / 100;
  const solventQuantityNeeded = targetQuantity - formulaQuantityNeeded;
  const solventPercentage = 100 - formulaPercentage;

  // Round to 2 decimal places
  return {
    formulaQuantityNeeded: Math.round(formulaQuantityNeeded * 100) / 100,
    solventQuantityNeeded: Math.round(solventQuantityNeeded * 100) / 100,
    solventPercentage: Math.round(solventPercentage * 100) / 100
  };
};
