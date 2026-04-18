
import { useState, useCallback } from 'react';
import * as formulasService from '@/services/formulasSupabaseService.js';

export const useFormulas = () => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const getFormulas = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await formulasService.getFormulas();
      return data;
    } catch (err) {
      setError(err.message);
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  const getFormulaById = useCallback(async (id) => {
    setLoading(true);
    setError(null);
    try {
      const data = await formulasService.getFormulaById(id);
      return data;
    } catch (err) {
      setError(err.message);
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  const createFormula = useCallback(async (formulaData, items) => {
    setLoading(true);
    setError(null);
    try {
      const result = await formulasService.createFormula(formulaData, items);
      return result;
    } catch (err) {
      setError(err.message);
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  const updateFormula = useCallback(async (formulaId, formulaData, items) => {
    setLoading(true);
    setError(null);
    try {
      const result = await formulasService.updateFormula(formulaId, formulaData, items);
      return result;
    } catch (err) {
      setError(err.message);
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  const deleteFormula = useCallback(async (formulaId) => {
    setLoading(true);
    setError(null);
    try {
      await formulasService.deleteFormula(formulaId);
    } catch (err) {
      setError(err.message);
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  const duplicateFormula = useCallback(async (formulaId) => {
    setLoading(true);
    setError(null);
    try {
      const result = await formulasService.duplicateFormula(formulaId);
      return result;
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
    getFormulas,
    getFormulaById,
    createFormula,
    updateFormula,
    deleteFormula,
    duplicateFormula
  };
};
