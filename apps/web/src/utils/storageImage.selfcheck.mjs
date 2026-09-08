// `node src/utils/storageImage.selfcheck.mjs`
//
// Supabase serves the uploaded file unless you ask for a rendered one. The product images asked; the
// site and bespoke images did not, because the old helper matched a single bucket by name — so the home
// page shipped a 3.4 MB PNG hero next to 6 kB product cards.
//
// The two things that matter here: every public-bucket URL gets rewritten whatever the bucket, and
// anything else is returned untouched. Rewriting a local /brand/ fallback would point it at a path that
// does not exist, which is worse than a large image.
import assert from 'node:assert/strict';
import { getOptimizedStorageImageUrl } from './storageImage.js';

const supabase = (bucket, file) => `https://x.supabase.co/storage/v1/object/public/${bucket}/${file}`;

for (const bucket of ['site-images', 'storefront-product-images', 'storefront-bespoke-images', 'anything-new']) {
  const out = getOptimizedStorageImageUrl(supabase(bucket, 'a/b.png'), 720);
  assert.ok(out.includes(`/render/image/public/${bucket}/`), `bucket ${bucket} was not rewritten: ${out}`);
  assert.ok(out.includes('width=720') && out.includes('quality=76') && out.includes('resize=contain'), `missing params: ${out}`);
  assert.ok(!out.includes('/object/public/'), `both paths present: ${out}`);
}

// Width is per call site: a mood card must not download a hero.
assert.ok(getOptimizedStorageImageUrl(supabase('site-images', 'x.png'), 1600).includes('width=1600'));
assert.ok(getOptimizedStorageImageUrl(supabase('site-images', 'x.png'), 240).includes('width=240'));

// Left alone: local fallbacks, foreign hosts, empty and unparseable values.
assert.equal(getOptimizedStorageImageUrl('/brand/home/raw-material-library.jpg', 1280), '/brand/home/raw-material-library.jpg');
assert.equal(getOptimizedStorageImageUrl('https://example.com/a.png', 1280), 'https://example.com/a.png');
assert.equal(getOptimizedStorageImageUrl('', 1280), '');
assert.equal(getOptimizedStorageImageUrl(null, 1280), '');
assert.equal(getOptimizedStorageImageUrl('not a url', 800), 'not a url');
// A signed/private object URL is not a public one and must not be rewritten into a public render path.
const signed = 'https://x.supabase.co/storage/v1/object/sign/site-images/a.png?token=abc';
assert.equal(getOptimizedStorageImageUrl(signed, 800), signed);

// Calling it twice must not double-rewrite or stack parameters.
const once = getOptimizedStorageImageUrl(supabase('site-images', 'a.png'), 800);
assert.equal(getOptimizedStorageImageUrl(once, 800), once, 'a second pass changed the URL');

console.log('storageImage selfcheck OK');
