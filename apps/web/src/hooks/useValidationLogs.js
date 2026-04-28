import { useCallback, useState } from 'react';
import * as validationLogsService from '@/services/validationLogsSupabaseService.js';

export const useValidationLogs = () => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const getValidationLogs = useCallback(async (options) => {
    setLoading(true);
    setError(null);
    try {
      return await validationLogsService.getValidationLogs(options);
    } catch (err) {
      setError(err.message);
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  const createValidationLog = useCallback(async (logData) => {
    setLoading(true);
    setError(null);
    try {
      return await validationLogsService.createValidationLog(logData);
    } catch (err) {
      setError(err.message);
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  const updateValidationLog = useCallback(async (logId, logData) => {
    setLoading(true);
    setError(null);
    try {
      return await validationLogsService.updateValidationLog(logId, logData);
    } catch (err) {
      setError(err.message);
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  const deleteValidationLog = useCallback(async (logId) => {
    setLoading(true);
    setError(null);
    try {
      await validationLogsService.deleteValidationLog(logId);
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
    getValidationLogs,
    createValidationLog,
    updateValidationLog,
    deleteValidationLog,
  };
};
