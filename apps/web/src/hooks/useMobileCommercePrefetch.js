import { useEffect } from 'react';
import { getOptimizedProductImageUrl } from '@/services/productImageStorageService.js';
import { prefetchCatalogProducts } from '@/services/productCatalogService.js';
import { prefetchStorefrontCategories } from '@/services/storefrontCategoryService.js';

let hasPrefetchedMobileCommerceData = false;

const preloadImage = (src) => {
  if (typeof window === 'undefined' || !src) return;
  const image = new Image();
  image.decoding = 'async';
  image.src = src;
};

const schedulePrefetch = (callback) => {
  if (typeof window === 'undefined') return () => {};

  if ('requestIdleCallback' in window) {
    const requestId = window.requestIdleCallback(callback, { timeout: 1200 });
    return () => window.cancelIdleCallback?.(requestId);
  }

  const timeoutId = window.setTimeout(callback, 250);
  return () => window.clearTimeout(timeoutId);
};

// The image half of this used to warm three local files — the logo and two /brand/home fallbacks —
// on EVERY mobile commerce page. Measured on the live site: 521 KB, untransformed originals, downloaded
// on /mobile/articles and everywhere else.
//
// They were fallbacks, shown only when a site-image slot is empty. home-statement is configured, so
// perfumer-pipettes.jpg (175 KB) could never be displayed at all. And the images the mobile home page
// actually shows come from Supabase through the transform, so none of them were ever warmed by this.
// It cost mobile data on every page and bought nothing.
export const useMobileCommercePrefetch = ({ prefetchCommerceData = true } = {}) => {
  useEffect(() => {
    if (!prefetchCommerceData || hasPrefetchedMobileCommerceData) return;

    return schedulePrefetch(() => {
      if (hasPrefetchedMobileCommerceData) return;
      hasPrefetchedMobileCommerceData = true;

      void Promise.all([
        prefetchCatalogProducts(),
        prefetchStorefrontCategories(),
      ]).then(([products]) => {
        const firstProductImage = products
          .flatMap((product) => product?.images?.[0] || product?.imageUrl || [])
          .filter(Boolean)
          .at(0);

        preloadImage(getOptimizedProductImageUrl(firstProductImage, 720));
      });
    });
  }, [prefetchCommerceData]);
};
