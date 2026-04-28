import { useCallback, useState } from 'react';
import * as briefProjectsService from '@/services/briefProjectsSupabaseService.js';

export const useBriefProjects = () => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const run = useCallback(async (callback) => {
    setLoading(true);
    setError(null);
    try {
      return await callback();
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
    ensureBriefProject: useCallback((briefId) => run(() => briefProjectsService.ensureBriefProject(briefId)), [run]),
    getBriefProjectByBriefId: useCallback((briefId) => run(() => briefProjectsService.getBriefProjectByBriefId(briefId)), [run]),
    updateBriefProject: useCallback((projectId, data) => run(() => briefProjectsService.updateBriefProject(projectId, data)), [run]),
    getBriefProjectStages: useCallback((projectId) => run(() => briefProjectsService.getBriefProjectStages(projectId)), [run]),
    upsertBriefProjectStage: useCallback((projectId, stage, data) => run(() => briefProjectsService.upsertBriefProjectStage(projectId, stage, data)), [run]),
    getBriefProjectStageItems: useCallback((projectId, stage) => run(() => briefProjectsService.getBriefProjectStageItems(projectId, stage)), [run]),
    upsertBriefProjectStageItems: useCallback((projectId, items) => run(() => briefProjectsService.upsertBriefProjectStageItems(projectId, items)), [run]),
    deleteBriefProjectStageItem: useCallback((itemId) => run(() => briefProjectsService.deleteBriefProjectStageItem(itemId)), [run]),
    deleteBriefProjectStageItemsByStage: useCallback((projectId, stage, states) => run(() => briefProjectsService.deleteBriefProjectStageItemsByStage(projectId, stage, states)), [run]),
  };
};
