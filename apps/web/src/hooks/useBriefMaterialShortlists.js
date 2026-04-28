import { useCallback, useState } from 'react';
import * as shortlistService from '@/services/briefMaterialShortlistsSupabaseService.js';

export const useBriefMaterialShortlists = () => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const getBriefMaterialShortlist = useCallback(async (briefId) => {
    setLoading(true);
    setError(null);
    try {
      return await shortlistService.getBriefMaterialShortlist(briefId);
    } catch (err) {
      setError(err.message);
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  const getBriefMaterialShortlistsByBriefIds = useCallback(async (briefIds) => {
    setLoading(true);
    setError(null);
    try {
      return await shortlistService.getBriefMaterialShortlistsByBriefIds(briefIds);
    } catch (err) {
      setError(err.message);
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  const upsertBriefMaterialShortlist = useCallback(async (briefId, items) => {
    setLoading(true);
    setError(null);
    try {
      return await shortlistService.upsertBriefMaterialShortlist(briefId, items);
    } catch (err) {
      setError(err.message);
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  const deleteBriefMaterialShortlistItem = useCallback(async (itemId) => {
    setLoading(true);
    setError(null);
    try {
      await shortlistService.deleteBriefMaterialShortlistItem(itemId);
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
    getBriefMaterialShortlist,
    getBriefMaterialShortlistsByBriefIds,
    upsertBriefMaterialShortlist,
    deleteBriefMaterialShortlistItem,
  };
};
