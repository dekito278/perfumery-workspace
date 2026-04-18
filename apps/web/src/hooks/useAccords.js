
import { useState, useCallback } from 'react';
import * as accordsService from '@/services/accordsService.js';

export const useAccords = () => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const fetchAccords = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await accordsService.getAccords();
      return data;
    } catch (err) {
      setError(err.message);
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchAccordItems = useCallback(async (accordId) => {
    setLoading(true);
    setError(null);
    try {
      const data = await accordsService.getAccordItems(accordId);
      return data;
    } catch (err) {
      setError(err.message);
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  const addAccord = useCallback(async (accordData, items) => {
    setLoading(true);
    setError(null);
    try {
      const result = await accordsService.createAccord(accordData, items);
      return result;
    } catch (err) {
      setError(err.message);
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  const editAccord = useCallback(async (accordId, accordData, items) => {
    setLoading(true);
    setError(null);
    try {
      const result = await accordsService.updateAccord(accordId, accordData, items);
      return result;
    } catch (err) {
      setError(err.message);
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  const deleteAccord = useCallback(async (accordId) => {
    setLoading(true);
    setError(null);
    try {
      await accordsService.deleteAccord(accordId);
    } catch (err) {
      setError(err.message);
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  const produceAccord = useCallback(async (accordId, quantity) => {
    setLoading(true);
    setError(null);
    try {
      const result = await accordsService.produceAccord(accordId, quantity);
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
    fetchAccords,
    fetchAccordItems,
    addAccord,
    editAccord,
    deleteAccord,
    produceAccord
  };
};
