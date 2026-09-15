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
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { getOptimizedStorageImageUrl, getStorageImageSrcSet } from './storageImage.js';

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


// --- a srcset, so a phone does not take the desktop hero -----------------------------------------------
// Measured on the live site at a 390px viewport: home-hero at width=1600 and home-statement at
// width=1280, 371 KB each — 742 KB of an 802 KB image payload, to be drawn at a quarter of that size.
// The product cards beside them already had a srcset; the site images never got one.
assert.equal(typeof getStorageImageSrcSet, 'function', 'site images need a srcset helper of their own');

const heroSet = getStorageImageSrcSet(supabase('site-images', 'home-hero.png'));
assert.ok(heroSet.includes('480w'), 'the smallest candidate must be phone-sized');
assert.ok(heroSet.includes('1600w'), 'the largest must still cover a wide desktop');
assert.equal(heroSet.split(', ').length, 4, 'four candidates is enough; more is just more URLs');
for (const entry of heroSet.split(', ')) {
  const [url, descriptor] = entry.split(' ');
  assert.ok(url.includes('/render/image/public/'), 'every candidate must go through the transform');
  assert.ok(url.includes(`width=${descriptor.replace('w', '')}`), 'the descriptor must match the width asked for');
}

// A URL the transform cannot touch must produce NO srcset, not four copies of one unchanged file.
assert.equal(getStorageImageSrcSet('/brand/home/raw-material-library.jpg'), undefined);
assert.equal(getStorageImageSrcSet('https://example.com/a.jpg'), undefined);
assert.equal(getStorageImageSrcSet(''), undefined);
assert.equal(getStorageImageSrcSet(null), undefined);

// The three full-bleed images on the home page must carry both halves: a srcset is inert without sizes.
const home = readFileSync(join(dirname(fileURLToPath(import.meta.url)), '..', 'pages', 'HomePage.jsx'), 'utf8');
for (const slot of ['home-hero', 'home-statement', 'home-newsletter']) {
  const tag = home.split('\n').find((line) => line.includes(`siteImages['${slot}']`) && line.includes('<img'));
  assert.ok(tag, `${slot} must still be rendered`);
  assert.ok(tag.includes('srcSet={srcSet('), `${slot} must offer the browser a choice of widths`);
  assert.ok(tag.includes('sizes="100vw"'), `${slot} is full-bleed; without sizes the browser assumes 100vw anyway but says so`);
}

// --- The transform must ask for a FORMAT, not just a size -------------------------------------------
// Supabase keeps the source format unless told otherwise, and `quality` is meaningless on a lossless
// one. So a PNG stayed a PNG at every width: 3,250 kB at 1600w, 612 kB even at the 480w a phone picks —
// while the very same endpoint returns 370 kB and 67 kB as WebP. The render path had been in place for
// a while; it was the format that was never asked for, which is why the file's own header comment
// described this as solved when the hero was still multiple megabytes.
const hero = getOptimizedStorageImageUrl('https://x.supabase.co/storage/v1/object/public/site-images/site/home-hero.png', 1600);
assert.ok(hero.includes('format=webp'),
  'the transform must name a format, or a lossless source is served untouched and `quality` does nothing');

// Every candidate in a srcset, not just the widest — the 480w a phone takes is where it matters most.
for (const entry of getStorageImageSrcSet('https://x.supabase.co/storage/v1/object/public/site-images/site/home-hero.png').split(', ')) {
  assert.ok(entry.split(' ')[0].includes('format=webp'), `every srcset candidate converts: ${entry}`);
}

// And the parameters stay together. Setting a format without a quality gives WebP at the endpoint's
// default; setting quality without a format is the bug above wearing a different hat.
for (const param of ['width=1600', 'format=webp', 'quality=76', 'resize=contain']) {
  assert.ok(hero.includes(param), `${param} must survive in the transformed URL`);
}

console.log('storageImage selfcheck OK (and the transform asks for WebP, not just a width)');
