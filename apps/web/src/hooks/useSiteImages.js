import { useCallback, useEffect, useState } from 'react';
import { listSiteImages, SITE_IMAGES_CHANGED_EVENT } from '@/services/siteImageStorageService.js';

/**
 * Default static fallbacks for site images.
 * Used when no uploaded image exists for a slot.
 */
const DEFAULT_IMAGES = {
  'home-hero': '/brand/home/raw-material-library.jpg',
  'home-statement': '/brand/home/perfumer-pipettes.jpg',
};

/**
 * Hook to fetch and cache site images.
 * Returns { images, loading, refresh }.
 * `images` is a plain object: { 'home-hero': 'url', ... }
 * Merges uploaded images over defaults.
 */
export const useSiteImages = () => {
  const [imageMap, setImageMap] = useState(DEFAULT_IMAGES);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    try {
      const uploaded = await listSiteImages();
      setImageMap((prev) => {
        const merged = { ...DEFAULT_IMAGES };
        for (const [key, url] of uploaded) {
          merged[key] = url;
        }
        return merged;
      });
    } catch {
      // Keep defaults on error
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();

    const handleChange = () => refresh();
    window.addEventListener(SITE_IMAGES_CHANGED_EVENT, handleChange);
    return () => window.removeEventListener(SITE_IMAGES_CHANGED_EVENT, handleChange);
  }, [refresh]);

  return { images: imageMap, loading, refresh };
};

/**
 * Get a single site image URL with fallback.
 */
export const getSiteImageWithFallback = (images, key) =>
  images[key] || DEFAULT_IMAGES[key] || '';
