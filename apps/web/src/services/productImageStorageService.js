import supabase from '@/lib/supabaseClient.js';

export const PRODUCT_IMAGES_BUCKET = 'storefront-product-images';
const MAX_IMAGE_SIZE_BYTES = 5 * 1024 * 1024;
const SUPPORTED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];

const extensionFromFile = (file) => {
  const extension = file.name?.split('.').pop()?.toLowerCase();
  if (extension && /^[a-z0-9]+$/.test(extension)) {
    return extension;
  }

  return file.type?.split('/').pop()?.toLowerCase() || 'jpg';
};

const sanitizeName = (value) => String(value || 'product')
  .trim()
  .toLowerCase()
  .replace(/[^a-z0-9]+/g, '-')
  .replace(/^-+|-+$/g, '')
  || 'product';

export const validateProductImageFile = (file) => {
  if (!file) {
    throw new Error('Please choose an image file');
  }

  if (!SUPPORTED_IMAGE_TYPES.includes(file.type)) {
    throw new Error('Use JPG, PNG, WebP, or GIF image files');
  }

  if (file.size > MAX_IMAGE_SIZE_BYTES) {
    throw new Error('Use an image below 5 MB');
  }
};

export const uploadProductImage = async (file, productName = 'product') => {
  validateProductImageFile(file);

  const safeName = sanitizeName(productName);
  const extension = extensionFromFile(file);
  const path = `${safeName}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${extension}`;

  const { error } = await supabase.storage
    .from(PRODUCT_IMAGES_BUCKET)
    .upload(path, file, {
      cacheControl: '31536000',
      contentType: file.type,
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
