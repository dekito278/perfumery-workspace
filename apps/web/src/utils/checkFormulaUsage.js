
import { getBatches } from '@/services/batchesSupabaseService.js';

/**
 * Check if a formula is being used in other records
 * @param {string} formulaId - The formula ID to check
 * @returns {Promise<{isInUse: boolean, usageType: string|null, count: number}>}
 */
export const checkFormulaUsage = async (formulaId) => {
  try {
    if (!formulaId) {
      return { isInUse: false, usageType: null, count: 0 };
    }

    const batches = await getBatches();
    const relatedBatches = batches.filter((batch) => batch.formula_id === formulaId);

    if (relatedBatches.length > 0) {
      return {
        isInUse: true,
        usageType: 'batches',
        count: relatedBatches.length
      };
    }

    return { isInUse: false, usageType: null, count: 0 };
  } catch (error) {
    console.error('Error checking formula usage:', error);
    return { isInUse: false, usageType: null, count: 0 };
  }
};
