// The slots on the shop's pages that Studio can fill with a photo (home hero, moods, …), and how the bucket
// listing becomes { slot: url }. One pure module for the app (services/siteImageStorageService.js) and the
// build (tools/build.mjs), which bakes the same map into the home page so its hero can start downloading
// before the app has run (15 Nov 2026: the hero waited for the bundle AND a storage round trip, ~6 s on a
// slow phone). Relative import only: plain Node imports this file.
export const SITE_IMAGES_BUCKET = 'site-images';
export const SITE_IMAGES_FOLDER = 'site';

/**
 * [[slot, url]] from a bucket listing, newest first, one entry per slot (a slot can hold an old .jpg beside
 * a newer .webp; the newest upload wins). `publicUrlFor(fileName)` turns a file name into its public URL.
 */
export const siteImageEntries = (files = [], publicUrlFor = (name) => name) => {
  const sorted = [...(Array.isArray(files) ? files : [])].sort((a, b) => (
    new Date(b.updated_at || b.created_at || 0).getTime()
    - new Date(a.updated_at || a.created_at || 0).getTime()
  ));
  const entries = new Map();
  for (const file of sorted) {
    const name = String(file?.name || '');
    if (!name) continue;
    const dot = name.lastIndexOf('.');
    const slot = dot > 0 ? name.slice(0, dot) : name;
    if (!entries.has(slot)) entries.set(slot, publicUrlFor(name));
  }
  return [...entries];
};

// The hero's two image sets, exactly as HomePage renders them: the phone <source> and the desktop <img>.
export const PHONE_HERO_WIDTHS = [480, 720, 900];
export const PHONE_HERO_MEDIA = '(max-width: 767px)';
export const DESKTOP_HERO_MEDIA = '(min-width: 768px)';
