import supabase from '@/lib/supabaseClient.js';

const TABLE = 'product_stories';
const BUCKET = 'product-stories';
const MAX_IMAGE_SIZE = 10 * 1024 * 1024;
const MAX_MEDIA_SIZE = 50 * 1024 * 1024;

const ALLOWED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
const ALLOWED_AUDIO_TYPES = ['audio/mpeg', 'audio/mp4', 'audio/ogg'];
const ALLOWED_VIDEO_TYPES = ['video/mp4', 'video/webm'];

const extFromMime = (type) => {
  const map = {
    'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp',
    'audio/mpeg': 'mp3', 'audio/mp4': 'm4a', 'audio/ogg': 'ogg',
    'video/mp4': 'mp4', 'video/webm': 'webm',
  };
  return map[type] || 'bin';
};

export const fetchStory = async (productSlug) => {
  const { data, error } = await supabase
    .from(TABLE)
    .select('*')
    .eq('product_slug', productSlug)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return data;
};

export const fetchAllStories = async () => {
  const { data, error } = await supabase
    .from(TABLE)
    .select('*')
    .order('updated_at', { ascending: false });
  if (error) throw new Error(error.message);
  return data || [];
};

const rowToStoryConfig = (row) => {
  if (!row) return null;
  return {
    slug: row.product_slug,
    enabled: row.enabled,
    colors: {
      bg: row.color_bg,
      text: row.color_text,
      accent: row.color_accent,
      muted: `${row.color_text}73`,
      border: `${row.color_text}1f`,
    },
    hero: {
      eyebrow: row.hero_eyebrow,
      headline: row.hero_headline,
      headlineScript: row.hero_headline_script,
      subtitle: row.hero_subtitle,
    },
    music: {
      src: row.music_url || null,
      label: row.music_label || '',
    },
    video: {
      src: row.video_url || null,
      poster: row.video_poster_url || null,
    },
    sections: row.sections || [],
  };
};

export const fetchStoryConfig = async (productSlug) => {
  const row = await fetchStory(productSlug);
  if (!row || !row.enabled) return null;
  return rowToStoryConfig(row);
};

export const upsertStory = async (productSlug, data) => {
  const payload = {
    product_slug: productSlug,
    enabled: data.enabled ?? true,
    color_bg: data.colors?.bg || '#1a0f14',
    color_text: data.colors?.text || '#f5ede4',
    color_accent: data.colors?.accent || '#c4917b',
    hero_eyebrow: data.hero?.eyebrow || '',
    hero_headline: data.hero?.headline || '',
    hero_headline_script: data.hero?.headlineScript || null,
    hero_subtitle: data.hero?.subtitle || '',
    music_url: data.music?.src || null,
    music_label: data.music?.label || null,
    video_url: data.video?.src || null,
    video_poster_url: data.video?.poster || null,
    sections: data.sections || [],
    updated_at: new Date().toISOString(),
  };

  const { data: result, error } = await supabase
    .from(TABLE)
    .upsert(payload, { onConflict: 'product_slug' })
    .select()
    .single();

  if (error) throw new Error(error.message);
  return result;
};

export const deleteStory = async (productSlug) => {
  const { error } = await supabase
    .from(TABLE)
    .delete()
    .eq('product_slug', productSlug);
  if (error) throw new Error(error.message);

  // The row is gone, so its whole media folder is now orphaned — clear it (best-effort).
  try {
    const { data: files } = await supabase.storage.from(BUCKET).list(productSlug);
    if (files?.length) {
      await supabase.storage.from(BUCKET).remove(files.map((file) => `${productSlug}/${file.name}`));
    }
  } catch (cleanupError) {
    console.warn('Story media cleanup skipped:', cleanupError.message || cleanupError);
  }
};

export const uploadStoryMedia = async (productSlug, category, file) => {
  const isImage = ALLOWED_IMAGE_TYPES.includes(file.type);
  const isAudio = ALLOWED_AUDIO_TYPES.includes(file.type);
  const isVideo = ALLOWED_VIDEO_TYPES.includes(file.type);

  if (!isImage && !isAudio && !isVideo) {
    throw new Error('Format file tidak didukung.');
  }

  const maxSize = isImage ? MAX_IMAGE_SIZE : MAX_MEDIA_SIZE;
  if (file.size > maxSize) {
    throw new Error(`File terlalu besar (maks ${Math.round(maxSize / 1024 / 1024)} MB).`);
  }

  const ext = extFromMime(file.type);
  const path = `${productSlug}/${category}.${ext}`;

  const { error: uploadError } = await supabase.storage
    .from(BUCKET)
    .upload(path, file, { cacheControl: '3600', upsert: true, contentType: file.type });

  if (uploadError) throw new Error(uploadError.message);

  const { data: urlData } = supabase.storage
    .from(BUCKET)
    .getPublicUrl(path);

  return `${urlData.publicUrl}?t=${Date.now()}`;
};

export const deleteStoryMedia = async (productSlug, category) => {
  const extensions = ['jpg', 'png', 'webp', 'mp3', 'm4a', 'ogg', 'mp4', 'webm'];
  const paths = extensions.map((ext) => `${productSlug}/${category}.${ext}`);
  await supabase.storage.from(BUCKET).remove(paths);
};
