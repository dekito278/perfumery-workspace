import supabase from '@/lib/supabaseClient.js';
import { getOptimizedStorageImageUrl } from '@/utils/storageImage.js';

export const PRODUCT_IMAGES_BUCKET = 'storefront-product-images';
const MAX_IMAGE_SIZE_BYTES = 15 * 1024 * 1024;
const TARGET_IMAGE_SIZE_BYTES = 250 * 1024;
const MAX_IMAGE_DIMENSION = 1600;
const MIN_IMAGE_DIMENSION = 760;
const SUPPORTED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
const PRODUCT_STORAGE_PUBLIC_PATH = `/storage/v1/object/public/${PRODUCT_IMAGES_BUCKET}/`;
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

// Kept as the product-facing name; the rewrite itself is bucket-agnostic and shared with site and
// bespoke images (utils/storageImage.js).
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

// canvas.toBlob falls back to PNG when it cannot encode the type you asked for, and says nothing. Asking
// for WebP on a browser without a WebP encoder (older Safari, iOS) therefore produced a PNG — which this
// code then wrapped as `<name>.webp` with contentType 'image/webp' and uploaded. Seven of the twelve
// product images checked in the live bucket are PNGs under a .webp name, 200-900 kB against 7-69 kB for
// the ones that really are WebP. Every buyer downloads the difference.
const EXTENSION_FOR_TYPE = {
  'image/webp': 'webp',
  'image/jpeg': 'jpg',
  'image/png': 'png',
};

const encodedAs = (blob, requested) => (blob?.type === requested ? blob : null);

// JPEG is far smaller than PNG for a photograph but has no alpha channel, so only offer it when the
// image has none to lose. A single pass over the alpha bytes; anything we cannot read stays PNG.
const hasTransparency = (context, width, height) => {
  try {
    const { data } = context.getImageData(0, 0, width, height);
    for (let i = 3; i < data.length; i += 4) {
      if (data[i] < 255) return true;
    }
    return false;
  } catch {
    return true;
  }
};

const namedForType = (file, blob) => {
  const type = blob.type || 'application/octet-stream';
  const extension = EXTENSION_FOR_TYPE[type];
  if (!extension) return new File([blob], sanitizeName(file.name), { type });
  return new File([blob], `${sanitizeName(file.name)}.${extension}`, { type });
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

    // Whatever the browser can actually encode, best first. PNG is last because for a photograph it is
    // the one that balloons.
    const formats = ['image/webp'];
    if (!hasTransparency(context, width, height)) {
      formats.push('image/jpeg');
    }
    formats.push('image/png');

    for (const format of formats) {
      let encoderWorks = true;
      for (const quality of [0.86, 0.78, 0.7, 0.62, 0.54, 0.46]) {
        const blob = encodedAs(await canvasToBlob(canvas, format, quality), format);
        if (!blob) {
          // This browser has no encoder for that type; toBlob quietly returned something else.
          encoderWorks = false;
          break;
        }
        if (!bestBlob || blob.size < bestBlob.size) {
          bestBlob = blob;
        }
        if (blob.size <= TARGET_IMAGE_SIZE_BYTES) {
          return namedForType(file, blob);
        }
        // PNG ignores the quality argument, so repeating it just burns time.
        if (format === 'image/png') break;
      }
      if (encoderWorks) break;
      console.warn(`This browser cannot encode ${format}; falling back to a larger format.`);
    }

    maxDimension = Math.floor(maxDimension * 0.82);
  }

  if (!bestBlob) {
    return file;
  }

  return namedForType(file, bestBlob);
};

// Remove product images from storage by their public URL. Best-effort: URLs that don't point at our
// bucket (e.g. externally-hosted images pasted into the form) are ignored, and errors are non-fatal.
export const deleteProductImages = async (urls = []) => {
  const marker = `/${PRODUCT_IMAGES_BUCKET}/`;
  const paths = (Array.isArray(urls) ? urls : [urls])
    .map((url) => {
      const str = String(url || '');
      const idx = str.indexOf(marker);
      if (idx === -1) return null;
      return decodeURIComponent(str.slice(idx + marker.length).split('?')[0]);
    })
    .filter(Boolean);

  if (!paths.length) return;
  await supabase.storage.from(PRODUCT_IMAGES_BUCKET).remove(paths);
};

export const uploadProductImage = async (file, productName = 'product') => {
  const uploadFile = await compressProductImage(file);

  const safeName = sanitizeName(productName);
  // Name the object for what it holds. It used to be .webp unconditionally, so a PNG fallback was stored
  // under a name and a content type that both claimed otherwise.
  const extension = EXTENSION_FOR_TYPE[uploadFile.type] || 'webp';
  const path = `${safeName}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${extension}`;

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
