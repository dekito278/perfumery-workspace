// Relative, not '@/': the build imports this file under plain Node.
import { getOptimizedStorageImageUrl } from './storageImage.js';

// The product photo's srcset, in one pure place: the page draws it (ProductVisual) and the build preloads it
// (tools/seo-artifacts.mjs). The preload only helps when its URLs are EXACTLY the ones the page then asks
// for; two copies of this list would drift, and a preload that misses is a second download, not a faster one.
export const PRODUCT_IMAGES_BUCKET = 'storefront-product-images';
const PRODUCT_STORAGE_PUBLIC_PATH = `/storage/v1/object/public/${PRODUCT_IMAGES_BUCKET}/`;
// 1080 for the product page on a 3x phone, whose ~350 CSS px frame wants ~1050 device pixels (sixth visitor
// audit, 13 Nov 2026: the largest offered was 720w). Cards stay small: `sizes` picks the width per slot.
export const PRODUCT_IMAGE_WIDTHS = [240, 360, 520, 720, 1080];
// The product page's main photo: its `src` width (priority) and `sizes` (ProductGallery).
export const PRODUCT_HERO_WIDTH = 720;
export const PRODUCT_HERO_SIZES = '(max-width: 767px) 100vw, 640px';

export const getOptimizedProductImageUrl = (imageUrl, width = 520) => getOptimizedStorageImageUrl(imageUrl, width);

export const getProductImageSrcSet = (imageUrl) => {
  const sourceUrl = String(imageUrl || '').trim();
  if (!sourceUrl) return undefined;

  try {
    const url = new URL(sourceUrl);
    if (!url.pathname.includes(PRODUCT_STORAGE_PUBLIC_PATH)) {
      return undefined;
    }
  } catch {
    return undefined;
  }

  return PRODUCT_IMAGE_WIDTHS
    .map((width) => `${getOptimizedProductImageUrl(sourceUrl, width)} ${width}w`)
    .join(', ');
};
