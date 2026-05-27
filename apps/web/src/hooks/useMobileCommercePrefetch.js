import { useEffect } from 'react';
import { getOptimizedProductImageUrl } from '@/services/productImageStorageService.js';
import { prefetchCatalogProducts } from '@/services/productCatalogService.js';
import { prefetchStorefrontCategories } from '@/services/storefrontCategoryService.js';

const homeImageUrls = [
  '/brand/solivagant-logo.png',
  '/brand/home/perfumer-pipettes.jpg',
  '/brand/home/raw-material-library.jpg',
];

let hasPrefetchedMobileCommerceImages = false;
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

export const useMobileCommercePrefetch = ({ prefetchCommerceData = true } = {}) => {
  useEffect(() => {
    return schedulePrefetch(() => {
      if (hasPrefetchedMobileCommerceImages) return;
      hasPrefetchedMobileCommerceImages = true;
      homeImageUrls.forEach(preloadImage);
    });
  }, []);

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
