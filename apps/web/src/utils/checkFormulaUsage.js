
import pb from '@/lib/pocketbaseClient.js';

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

    const batches = await pb.collection('batches').getList(1, 1, {
      filter: `formula_id = "${formulaId}"`,
      $autoCancel: false
    });

    if (batches.totalItems > 0) {
      return {
        isInUse: true,
        usageType: 'batches',
        count: batches.totalItems
      };
    }

    return { isInUse: false, usageType: null, count: 0 };
  } catch (error) {
    console.error('Error checking formula usage:', error);
    return { isInUse: false, usageType: null, count: 0 };
  }
};
