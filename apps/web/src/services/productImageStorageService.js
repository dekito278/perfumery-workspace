import supabase from '@/lib/supabaseClient.js';

export const PRODUCT_IMAGES_BUCKET = 'storefront-product-images';
const MAX_IMAGE_SIZE_BYTES = 15 * 1024 * 1024;
const TARGET_IMAGE_SIZE_BYTES = 250 * 1024;
const MAX_IMAGE_DIMENSION = 1600;
const MIN_IMAGE_DIMENSION = 760;
const SUPPORTED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
const PRODUCT_STORAGE_PUBLIC_PATH = `/storage/v1/object/public/${PRODUCT_IMAGES_BUCKET}/`;
const PRODUCT_STORAGE_RENDER_PATH = `/storage/v1/render/image/public/${PRODUCT_IMAGES_BUCKET}/`;
const PRODUCT_IMAGE_WIDTHS = [240, 360, 520, 720];

const canvasToBlob = (canvas, type, quality) => new Promise((resolve, reject) => {
  canvas.toBlob((blob) => {
    if (blob) {
      resolve(blob);
      return;
    }

    reject(new Error('Failed to compress product image'));
  }, type, quality);
});

const sanitizeName = (value) => String(value || 'product')
  .trim()
  .toLowerCase()
  .replace(/[^a-z0-9]+/g, '-')
  .replace(/^-+|-+$/g, '')
  || 'product';

export const getOptimizedProductImageUrl = (imageUrl, width = 520) => {
  const sourceUrl = String(imageUrl || '').trim();
  if (!sourceUrl) return '';

  try {
    const url = new URL(sourceUrl);
    if (!url.pathname.includes(PRODUCT_STORAGE_PUBLIC_PATH)) {
      return sourceUrl;
    }

    url.pathname = url.pathname.replace(PRODUCT_STORAGE_PUBLIC_PATH, PRODUCT_STORAGE_RENDER_PATH);
    url.searchParams.set('width', String(width));
    url.searchParams.set('quality', '76');
    url.searchParams.set('resize', 'contain');
    return url.toString();
  } catch {
    return sourceUrl;
  }
};

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

export const validateProductImageFile = (file) => {
  if (!file) {
    throw new Error('Please choose an image file');
  }

  if (!SUPPORTED_IMAGE_TYPES.includes(file.type)) {
    throw new Error('Use JPG, PNG, WebP, or GIF image files');
  }

  if (file.size > MAX_IMAGE_SIZE_BYTES) {
    throw new Error('Use an image below 15 MB');
  }
};

const loadImageSource = async (file) => {
  if ('createImageBitmap' in window) {
    try {
      return await createImageBitmap(file, { imageOrientation: 'from-image' });
    } catch (error) {
      // Fall back to HTMLImageElement decode for browsers with partial bitmap support.
    }
  }

  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const image = new Image();
    image.onload = () => {
      URL.revokeObjectURL(url);
      resolve(image);
    };
    image.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('Failed to read product image'));
    };
    image.src = url;
  });
};

const getScaledSize = (width, height, maxDimension) => {
  const largestSide = Math.max(width, height);
  if (largestSide <= maxDimension) {
    return { width, height };
  }

  const scale = maxDimension / largestSide;
  return {
    width: Math.max(1, Math.round(width * scale)),
    height: Math.max(1, Math.round(height * scale)),
  };
};

export const compressProductImage = async (file) => {
  validateProductImageFile(file);

  if (typeof window === 'undefined' || typeof document === 'undefined') {
    return file;
  }

  const source = await loadImageSource(file);
  const sourceWidth = source.width || source.naturalWidth;
  const sourceHeight = source.height || source.naturalHeight;
  let maxDimension = MAX_IMAGE_DIMENSION;
  let bestBlob = null;

  while (maxDimension >= MIN_IMAGE_DIMENSION) {
    const { width, height } = getScaledSize(sourceWidth, sourceHeight, maxDimension);
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext('2d', { alpha: true });

    if (!context) {
      break;
    }

    context.imageSmoothingEnabled = true;
    context.imageSmoothingQuality = 'high';
    context.drawImage(source, 0, 0, width, height);

    for (const quality of [0.86, 0.78, 0.7, 0.62, 0.54, 0.46]) {
      const blob = await canvasToBlob(canvas, 'image/webp', quality);
      if (!bestBlob || blob.size < bestBlob.size) {
        bestBlob = blob;
      }
      if (blob.size <= TARGET_IMAGE_SIZE_BYTES) {
        return new File([blob], `${sanitizeName(file.name)}.webp`, { type: 'image/webp' });
      }
    }

    maxDimension = Math.floor(maxDimension * 0.82);
  }

  if (!bestBlob) {
    return file;
  }

  return new File([bestBlob], `${sanitizeName(file.name)}.webp`, { type: 'image/webp' });
};

export const uploadProductImage = async (file, productName = 'product') => {
  const uploadFile = await compressProductImage(file);

  const safeName = sanitizeName(productName);
  const path = `${safeName}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.webp`;

  const { error } = await supabase.storage
    .from(PRODUCT_IMAGES_BUCKET)
    .upload(path, uploadFile, {
      cacheControl: '31536000',
      contentType: uploadFile.type || 'image/webp',
      upsert: false,
    });

  if (error) {
    throw new Error(error.message || 'Failed to upload product image');
  }

  const { data } = supabase.storage
    .from(PRODUCT_IMAGES_BUCKET)
    .getPublicUrl(path);

  if (!data?.publicUrl) {
    throw new Error('Failed to get product image URL');
  }

  return data.publicUrl;
};
