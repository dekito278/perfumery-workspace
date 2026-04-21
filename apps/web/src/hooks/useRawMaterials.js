
import { useState, useCallback } from 'react';
import * as rawMaterialsService from '@/services/rawMaterialsService.js';

export const useRawMaterials = () => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const fetchMaterials = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await rawMaterialsService.getRawMaterials();
      return data;
    } catch (err) {
      setError(err.message);
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchMaterialsPage = useCallback(async (params) => {
    setLoading(true);
    setError(null);
    try {
      const data = await rawMaterialsService.getRawMaterialsPage(params);
      return data;
    } catch (err) {
      setError(err.message);
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchMaterialsSummary = useCallback(async () => {
    setError(null);
    try {
      return await rawMaterialsService.getRawMaterialsSummary();
    } catch (err) {
      setError(err.message);
      throw err;
    }
  }, []);

  const fetchMaterialsReferenceSummary = useCallback(async () => {
    setError(null);
    try {
      return await rawMaterialsService.getRawMaterialsReferenceSummary();
    } catch (err) {
      setError(err.message);
      throw err;
    }
  }, []);

  const addMaterial = useCallback(async (data) => {
    setLoading(true);
    setError(null);
    try {
      const result = await rawMaterialsService.createRawMaterial(data);
      return result;
    } catch (err) {
      setError(err.message);
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  const updateMaterial = useCallback(async (id, data) => {
    setLoading(true);
    setError(null);
    try {
      const result = await rawMaterialsService.updateRawMaterial(id, data);
      return result;
    } catch (err) {
      setError(err.message);
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  const deleteMaterial = useCallback(async (id) => {
    setLoading(true);
    setError(null);
    try {
      await rawMaterialsService.deleteRawMaterial(id);
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
    fetchMaterials,
    fetchMaterialsPage,
    fetchMaterialsSummary,
    fetchMaterialsReferenceSummary,
    addMaterial,
    updateMaterial,
    deleteMaterial
  };
};
