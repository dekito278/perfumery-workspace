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
    url.searchParams.set('quality', '76');
    url.searchParams.set('resize', 'contain');
    return url.toString();
  } catch {
    return sourceUrl;
  }
};

export default getOptimizedStorageImageUrl;
