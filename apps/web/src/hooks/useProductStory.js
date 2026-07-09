import { useEffect, useState } from 'react';
import { fetchStoryConfig } from '@/services/productStoryService.js';

const cache = new Map();

const useProductStory = (slug) => {
  const [story, setStory] = useState(cache.get(slug) || null);
  const [loading, setLoading] = useState(!cache.has(slug));

  useEffect(() => {
    if (!slug) return;
    if (cache.has(slug)) {
      setStory(cache.get(slug));
      setLoading(false);
      return;
    }

    let cancelled = false;
    setLoading(true);

    fetchStoryConfig(slug)
      .then((config) => {
        if (cancelled) return;
        cache.set(slug, config);
        setStory(config);
      })
      .catch(() => {
        if (cancelled) return;
        cache.set(slug, null);
        setStory(null);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => { cancelled = true; };
  }, [slug]);

  return { story, loading };
};

export const invalidateStoryCache = (slug) => {
  if (slug) cache.delete(slug);
  else cache.clear();
};

export default useProductStory;
