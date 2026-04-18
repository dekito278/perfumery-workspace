
import { useState, useCallback } from 'react';
import * as formulasService from '@/services/formulasSupabaseService.js';

export const useFormulaItems = () => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const getFormulaItems = useCallback(async (formulaId) => {
    setLoading(true);
    setError(null);
    try {
      return await formulasService.getFormulaItems(formulaId);
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
      return itemData;
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
      return { id: itemId, ...itemData };
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
      return itemId;
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
