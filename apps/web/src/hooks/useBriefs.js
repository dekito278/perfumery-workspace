import { useCallback, useState } from 'react';
import * as briefsService from '@/services/briefsSupabaseService.js';

export const useBriefs = () => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const getBriefs = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      return await briefsService.getBriefs();
    } catch (err) {
      setError(err.message);
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  const createBrief = useCallback(async (briefData) => {
    setLoading(true);
    setError(null);
    try {
      return await briefsService.createBrief(briefData);
    } catch (err) {
      setError(err.message);
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  const updateBrief = useCallback(async (briefId, briefData) => {
    setLoading(true);
    setError(null);
    try {
      return await briefsService.updateBrief(briefId, briefData);
    } catch (err) {
      setError(err.message);
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  const deleteBrief = useCallback(async (briefId) => {
    setLoading(true);
    setError(null);
    try {
      await briefsService.deleteBrief(briefId);
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
    getBriefs,
    createBrief,
    updateBrief,
    deleteBrief,
  };
};
