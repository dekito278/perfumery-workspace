import { useCallback, useEffect, useState } from 'react';
import { listSiteImages, SITE_IMAGES_CHANGED_EVENT } from '@/services/siteImageStorageService.js';

/**
 * Bundled fallbacks, used only once we know a slot has no upload.
 *
 * They are deliberately NOT the initial state. Seeding with them meant every first paint showed
 * /brand/home/raw-material-library.jpg in the hero — so replacing the hero in the studio still flashed the
 * old photograph on load, until the storage list came back and swapped it. Showing a photograph the owner
 * has removed, however briefly, is worse than showing the section's own background for a moment.
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
  // Empty until the real list settles: '' means "not known yet", not "nothing here".
  const [imageMap, setImageMap] = useState({});
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
      // Only now do the bundled images become the answer: the upload list is genuinely unavailable.
      setImageMap(DEFAULT_IMAGES);
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
