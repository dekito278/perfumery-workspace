import supabase from '@/lib/supabaseClient.js';
import { compressProductImage } from '@/services/productImageStorageService.js';

export const BESPOKE_IMAGES_BUCKET = 'storefront-bespoke-images';

const sanitizeName = (value) => String(value || 'bespoke-option')
  .trim()
  .toLowerCase()
  .replace(/[^a-z0-9]+/g, '-')
  .replace(/^-+|-+$/g, '')
  || 'bespoke-option';

// Remove bespoke option images from storage by public URL. Best-effort: non-bucket URLs are ignored
// and errors are non-fatal. Mirrors deleteProductImages.
export const deleteBespokeImages = async (urls = []) => {
  const marker = `/${BESPOKE_IMAGES_BUCKET}/`;
  const paths = (Array.isArray(urls) ? urls : [urls])
    .map((url) => {
      const str = String(url || '');
      const idx = str.indexOf(marker);
      if (idx === -1) return null;
      return decodeURIComponent(str.slice(idx + marker.length).split('?')[0]);
    })
    .filter(Boolean);

  if (!paths.length) return;
  await supabase.storage.from(BESPOKE_IMAGES_BUCKET).remove(paths);
};

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
