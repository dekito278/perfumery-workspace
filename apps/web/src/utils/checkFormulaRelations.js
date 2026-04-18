
import pb from '@/lib/pocketbaseClient';

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

    const batches = await pb.collection('batches').getList(1, 1, {
      filter: `formula_id = "${formulaId}"`,
      $autoCancel: false
    });

    if (batches.totalItems > 0) {
      return {
        hasRelations: true,
        relationCount: batches.totalItems,
        relationType: 'batches'
      };
    }

    return { hasRelations: false, relationCount: 0, relationType: null };
  } catch (error) {
    console.error('Error checking formula relations:', error);
    return { hasRelations: false, relationCount: 0, relationType: null };
  }
};
