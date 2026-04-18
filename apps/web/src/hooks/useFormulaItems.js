
import { useState, useCallback } from 'react';
import pb from '@/lib/pocketbase.js';

export const useFormulaItems = () => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const getFormulaItems = useCallback(async (formulaId) => {
    setLoading(true);
    setError(null);
    try {
      const records = await pb.collection('formula_items').getList(1, 100, {
        filter: `formula_id="${formulaId}"`,
        sort: 'created',
        $autoCancel: false
      });
      return records.items;
    } catch (err) {
      setError(err.message);
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  const createFormulaItem = useCallback(async (itemData) => {
    setLoading(true);
    setError(null);
    try {
      const record = await pb.collection('formula_items').create({
        formula_id: itemData.formula_id,
        item_type: itemData.item_type,
        item_id: itemData.item_id,
        percentage: itemData.percentage
      }, { $autoCancel: false });
      return record;
    } catch (err) {
      setError(err.message);
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  const updateFormulaItem = useCallback(async (itemId, itemData) => {
    setLoading(true);
    setError(null);
    try {
      const record = await pb.collection('formula_items').update(itemId, {
        item_type: itemData.item_type,
        item_id: itemData.item_id,
        percentage: itemData.percentage
      }, { $autoCancel: false });
      return record;
    } catch (err) {
      setError(err.message);
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  const deleteFormulaItem = useCallback(async (itemId) => {
    setLoading(true);
    setError(null);
    try {
      await pb.collection('formula_items').delete(itemId, { $autoCancel: false });
    } catch (err) {
      setError(err.message);
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  return {
    loading,
    error,
    getFormulaItems,
    createFormulaItem,
    updateFormulaItem,
    deleteFormulaItem
  };
};
