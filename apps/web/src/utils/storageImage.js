// Supabase serves the file you uploaded unless you ask it not to. The product images already go through
// the render endpoint; nothing else did, so the home page shipped its hero at 3.4 MB of PNG while a
// product card next to it was 6 kB — the same image pipeline, one path shorter.
//
// Bucket-agnostic on purpose: the product helper used to match one bucket by name, which is why
// site-images and storefront-bespoke-images were never rewritten.
const PUBLIC_PATH = '/storage/v1/object/public/';
const RENDER_PATH = '/storage/v1/render/image/public/';

export const getOptimizedStorageImageUrl = (imageUrl, width = 1280) => {
  const sourceUrl = String(imageUrl || '').trim();
  if (!sourceUrl) return '';

  try {
    const url = new URL(sourceUrl);
    // Anything not served from a Supabase public bucket — a local /brand/ fallback, an external URL — is
    // returned untouched rather than rewritten into a path that does not exist.
    if (!url.pathname.includes(PUBLIC_PATH)) return sourceUrl;

    url.pathname = url.pathname.replace(PUBLIC_PATH, RENDER_PATH);
    url.searchParams.set('width', String(width));
    // Without this the render endpoint keeps the SOURCE format, and `quality` below is then ignored for
    // anything lossless. The home hero was still being served as a 3,250 kB PNG long after it started
    // going through this helper — 370 kB as WebP, the same pixels, from the same endpoint. The comment
    // at the top of this file described that as fixed; the path was, the format was not.
    url.searchParams.set('format', 'webp');
    url.searchParams.set('quality', '76');
    url.searchParams.set('resize', 'contain');
    return url.toString();
  } catch {
    return sourceUrl;
  }
};

/**
 * A srcset so the browser picks a width instead of every visitor taking the largest one.
 *
 * The home page asked for width=1600 and width=1280 whatever the screen, so a 390px phone downloaded
 * 742 KB of hero — 92% of its image payload — to display it at a quarter of that size. The product
 * cards next to it already did this properly; site images simply never got a srcset.
 *
 * Returns undefined when the URL cannot be transformed (a local /brand/ fallback, an external host), so
 * the caller emits no srcset at all rather than four copies of one unchanged file.
 */
export const getStorageImageSrcSet = (imageUrl, widths = [480, 768, 1080, 1600]) => {
  const sourceUrl = String(imageUrl || '').trim();
  if (!sourceUrl) return undefined;

  try {
    if (!new URL(sourceUrl).pathname.includes(PUBLIC_PATH)) return undefined;
  } catch {
    return undefined;
  }

  return widths.map((width) => `${getOptimizedStorageImageUrl(sourceUrl, width)} ${width}w`).join(', ');
};

export default getOptimizedStorageImageUrl;
