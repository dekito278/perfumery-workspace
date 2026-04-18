
import { getBatches } from '@/services/batchesSupabaseService.js';

/**
 * Check if a formula has related records (batches) that would prevent deletion
 * @param {string} formulaId - The formula ID to check
 * @returns {Promise<{hasRelations: boolean, relationCount: number, relationType: string|null}>}
 */
export const checkFormulaRelations = async (formulaId) => {
  try {
    if (!formulaId) {
      return { hasRelations: false, relationCount: 0, relationType: null };
    }

    const batches = await getBatches();
    const relatedBatches = batches.filter((batch) => batch.formula_id === formulaId);

    if (relatedBatches.length > 0) {
      return {
        hasRelations: true,
        relationCount: relatedBatches.length,
        relationType: 'batches'
      };
    }

    return { hasRelations: false, relationCount: 0, relationType: null };
  } catch (error) {
    console.error('Error checking formula relations:', error);
    return { hasRelations: false, relationCount: 0, relationType: null };
  }
};
