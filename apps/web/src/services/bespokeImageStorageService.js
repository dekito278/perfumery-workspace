import supabase from '@/lib/supabaseClient.js';
import { compressProductImage } from '@/services/productImageStorageService.js';

export const BESPOKE_IMAGES_BUCKET = 'storefront-bespoke-images';

const sanitizeName = (value) => String(value || 'bespoke-option')
  .trim()
  .toLowerCase()
  .replace(/[^a-z0-9]+/g, '-')
  .replace(/^-+|-+$/g, '')
  || 'bespoke-option';

export const uploadBespokeOptionImage = async (file, collectionKey = 'bespoke', optionLabel = 'option') => {
  const uploadFile = await compressProductImage(file);
  const safeCollection = sanitizeName(collectionKey);
  const safeName = sanitizeName(optionLabel);
  const path = `${safeCollection}/${safeName}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.webp`;

  const { error } = await supabase.storage
    .from(BESPOKE_IMAGES_BUCKET)
    .upload(path, uploadFile, {
      cacheControl: '31536000',
      contentType: uploadFile.type || 'image/webp',
      upsert: false,
    });

  if (error) {
    throw new Error(error.message || 'Failed to upload bespoke image');
  }

  const { data } = supabase.storage
    .from(BESPOKE_IMAGES_BUCKET)
    .getPublicUrl(path);

  if (!data?.publicUrl) {
    throw new Error('Failed to get bespoke image URL');
  }

  return data.publicUrl;
};
