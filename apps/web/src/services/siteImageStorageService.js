import supabase from '@/lib/supabaseClient.js';

export const SITE_IMAGES_BUCKET = 'site-images';
const MAX_IMAGE_SIZE_BYTES = 10 * 1024 * 1024;
const SUPPORTED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp'];

/**
 * Predefined site image slots.
 * Each slot has a key (storage path), label (UI display), and dimensions hint.
 */
export const SITE_IMAGE_SLOTS = [
  { key: 'home-hero', label: 'Home Hero', hint: '1920×1080 landscape' },
  { key: 'home-statement', label: 'Home Statement', hint: '1920×1080 landscape' },
  { key: 'mood-fresh', label: 'Mood: Fresh', hint: '800×800 square' },
  { key: 'mood-gourmand', label: 'Mood: Gourmand', hint: '800×800 square' },
  { key: 'mood-woody', label: 'Mood: Woody', hint: '800×800 square' },
  { key: 'mood-floral', label: 'Mood: Floral', hint: '800×800 square' },
  { key: 'catalog-banner', label: 'Catalog Banner', hint: '1920×600 wide' },
  { key: 'about-hero', label: 'About Hero', hint: '1920×1080 landscape' },
];

export const SITE_IMAGES_CHANGED_EVENT = 'solivagant:site-images-changed';

const emitChange = () => {
  window.dispatchEvent(new CustomEvent(SITE_IMAGES_CHANGED_EVENT));
};

/**
 * Validate a file before upload.
 */
const validateFile = (file) => {
  if (!file) throw new Error('Please choose an image file.');
  if (!SUPPORTED_IMAGE_TYPES.includes(file.type)) {
    throw new Error('Use JPG, PNG, or WebP images.');
  }
  if (file.size > MAX_IMAGE_SIZE_BYTES) {
    throw new Error('Image must be under 10 MB.');
  }
};

/**
 * Build the storage path for a site image key.
 * All images go under a flat namespace: `site/{key}.ext`
 */
const storagePath = (key, extension = 'webp') => `site/${key}.${extension}`;

/**
 * Get the file extension from MIME type.
 */
const extFromMime = (type) => {
  if (type === 'image/png') return 'png';
  if (type === 'image/webp') return 'webp';
  return 'jpg';
};

/**
 * Upload (or replace) a site image for a given slot key.
 * Returns the public URL.
 */
export const uploadSiteImage = async (key, file) => {
  validateFile(file);

  const ext = extFromMime(file.type);
  const path = storagePath(key, ext);

  // Upsert — overwrite if exists
  const { error: uploadError } = await supabase.storage
    .from(SITE_IMAGES_BUCKET)
    .upload(path, file, {
      cacheControl: '3600',
      upsert: true,
      contentType: file.type,
    });

  if (uploadError) {
    throw new Error(uploadError.message || 'Failed to upload site image.');
  }

  const { data: urlData } = supabase.storage
    .from(SITE_IMAGES_BUCKET)
    .getPublicUrl(path);

  // Bust browser cache by appending timestamp
  const publicUrl = `${urlData.publicUrl}?t=${Date.now()}`;

  emitChange();
  return publicUrl;
};

/**
 * Delete a site image by key.
 * Tries all known extensions since we don't track which was used.
 */
export const deleteSiteImage = async (key) => {
  const paths = ['webp', 'jpg', 'png'].map((ext) => storagePath(key, ext));

  const { error } = await supabase.storage
    .from(SITE_IMAGES_BUCKET)
    .remove(paths);

  if (error) {
    throw new Error(error.message || 'Failed to delete site image.');
  }

  emitChange();
};

/**
 * List all uploaded site images.
 * Returns a Map<string, string> of key → public URL.
 */
export const listSiteImages = async () => {
  const { data: files, error } = await supabase.storage
    .from(SITE_IMAGES_BUCKET)
    .list('site', { limit: 100 });

  if (error) {
    throw new Error(error.message || 'Failed to list site images.');
  }

  const imageMap = new Map();

  for (const file of (files || [])) {
    // Extract key from filename: "home-hero.webp" → "home-hero"
    const dotIndex = file.name.lastIndexOf('.');
    const key = dotIndex > 0 ? file.name.slice(0, dotIndex) : file.name;

    // Only keep the first match per key (in case multiple extensions exist)
    if (!imageMap.has(key)) {
      const { data: urlData } = supabase.storage
        .from(SITE_IMAGES_BUCKET)
        .getPublicUrl(`site/${file.name}`);

      imageMap.set(key, urlData.publicUrl);
    }
  }

  return imageMap;
};

/**
 * Get a single site image URL by key, or null if not uploaded.
 */
export const getSiteImageUrl = async (key) => {
  const map = await listSiteImages();
  return map.get(key) || null;
};
