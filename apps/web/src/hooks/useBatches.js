
import { useState, useCallback } from 'react';
import * as batchesService from '@/services/batchesService.js';
import pb from '@/lib/pocketbaseClient';

export const useBatches = () => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const getBatches = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await pb.collection('batches').getFullList({
        expand: 'formula_id,solvent_id',
        sort: '-created',
        $autoCancel: false
      });
      return data;
    } catch (err) {
      setError(err.message);
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  const getBatchById = useCallback(async (id) => {
    setLoading(true);
    setError(null);
    try {
      const data = await pb.collection('batches').getOne(id, {
        expand: 'formula_id,solvent_id',
        $autoCancel: false
      });
      return data;
    } catch (err) {
      setError(err.message);
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  const createBatch = useCallback(async (batchData) => {
    setLoading(true);
    setError(null);
    try {
      const result = await batchesService.createBatch(batchData);
      return result;
    } catch (err) {
      setError(err.message);
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  const updateBatch = useCallback(async (id, batchData) => {
    setLoading(true);
    setError(null);
    try {
      const result = await batchesService.updateBatch(id, batchData);
      return result;
    } catch (err) {
      setError(err.message);
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  const deleteBatch = useCallback(async (id) => {
    setLoading(true);
    setError(null);
    try {
      await batchesService.deleteBatch(id);
    } catch (err) {
      setError(err.message);
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  const completeBatch = useCallback(async (id) => {
    setLoading(true);
    setError(null);
    try {
      const result = await batchesService.completeBatch(id);
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
    getBatches,
    getBatchById,
    createBatch,
    updateBatch,
    deleteBatch,
    completeBatch
  };
};
