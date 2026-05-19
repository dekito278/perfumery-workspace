import { useCallback, useState } from 'react';
import * as journalPostsService from '@/services/journalPostsSupabaseService.js';

export const useJournalPosts = () => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const getJournalPosts = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      return await journalPostsService.getJournalPosts();
    } catch (err) {
      setError(err.message);
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  const getJournalPostById = useCallback(async (postId) => {
    setLoading(true);
    setError(null);
    try {
      return await journalPostsService.getJournalPostById(postId);
    } catch (err) {
      setError(err.message);
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  const createJournalPost = useCallback(async (postData) => {
    setLoading(true);
    setError(null);
    try {
      return await journalPostsService.createJournalPost(postData);
    } catch (err) {
      setError(err.message);
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  const updateJournalPost = useCallback(async (postId, postData) => {
    setLoading(true);
    setError(null);
    try {
      return await journalPostsService.updateJournalPost(postId, postData);
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
    getJournalPosts,
    getJournalPostById,
    createJournalPost,
    updateJournalPost,
  };
};
