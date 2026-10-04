// `node src/utils/oneWidthIsNotEveryScreen.selfcheck.mjs`
//
// An image asked for at a desktop width has to offer a phone width too.
//
// storageImage.js already tells this story twice. Its header: "the home page shipped its hero at 3.4 MB of
// PNG while a product card next to it was 6 kB — the same image pipeline, one path shorter." And over
// getStorageImageSrcSet: "The home page asked for width=1600 and width=1280 whatever the screen, so a
// 390px phone downloaded 742 KB of hero — 92% of its image payload — to display it at a quarter of that
// size. The product cards next to it already did this properly; site images simply never got a srcset."
//
// Both were fixed — for the hero, the statement band and the newsletter band. Two renders were missed:
//
//   HomePage, the mood panel       img(url, 720) and no srcset
//   BespokePage, the preview       img(url, 720) and no srcset
//
// Measured on the live render endpoint, 2026-10-04:
//
//   mood-floral   width=720 -> 171 kB     width=390 -> 42 kB      129 kB a phone did not need
//   bespoke       width=720 ->  15 kB     width=390 ->  5 kB        9 kB
//
// The home page is the busiest surface in the shop, so that 129 kB is the one that matters; the bespoke
// one is included because the rule should not have an exception nobody can explain.
//
// The threshold is 480, and it is a rule rather than a taste: below it the ask IS a phone width — the
// bespoke option thumbnails ask for 240 and one file is the right answer for them.
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const src = dirname(fileURLToPath(import.meta.url)).replace(/\/utils$/, '');
const strip = (text) => text
  .replace(/\/\*[\s\S]*?\*\//g, ' ')
  .replace(/^\s*\/\/.*$/gm, ' ')
  .replace(/\{\/\*[\s\S]*?\*\/\}/g, ' ');

// The helper pair, run — so the rule rests on what they return, not on how they are spelled.
const helper = readFileSync(join(src, 'utils', 'storageImage.js'), 'utf8')
  .replace(/^import\b[\s\S]*?from '[^']+';\n/gm, '');
const { getOptimizedStorageImageUrl, getStorageImageSrcSet } = await import(
  `data:text/javascript;base64,${Buffer.from(helper, 'utf8').toString('base64')}`
);
const PUBLIC = 'https://x.supabase.co/storage/v1/object/public/site-images/site/home-hero.png';
assert.match(getOptimizedStorageImageUrl(PUBLIC, 480), /render\/image\/public/, 'the transform path is used');
assert.match(getOptimizedStorageImageUrl(PUBLIC, 480), /format=webp/,
  'without format=webp the render endpoint keeps the source format and quality is ignored for PNG');
const set = getStorageImageSrcSet(PUBLIC);
assert.ok(set && set.split(',').length >= 3, `a srcset must offer several widths; got ${set}`);
assert.match(set, /\b480w\b/, 'and one of them has to be a phone width');
// A local fallback cannot be transformed, so it must produce no srcset rather than four copies of itself.
assert.equal(getStorageImageSrcSet('/brand/home/raw-material-library.jpg'), undefined,
  'an untransformable URL must yield no srcset at all');

// --- Every render, swept off disk ---------------------------------------------------------------------
const files = [];
const walk = (dir) => {
  for (const entry of readdirSync(join(src, dir), { withFileTypes: true })) {
    const rel = dir ? `${dir}/${entry.name}` : entry.name;
    if (entry.isDirectory()) { walk(rel); continue; }
    if (/\.jsx$/.test(entry.name) && !/selfcheck/.test(entry.name)) files.push(rel);
  }
};
walk('');

const PHONE_WIDTH = 480;
const wide = [];
const narrow = [];
for (const rel of files) {
  const source = strip(readFileSync(join(src, rel), 'utf8'));
  for (const match of source.matchAll(/<img\b[^>]*?src=\{img\([^,]+,\s*(\d+)\)[^>]*?\/>/g)) {
    const [tag, width] = match;
    const entry = `${rel}: img(…, ${width})`;
    if (Number(width) < PHONE_WIDTH) { narrow.push(entry); continue; }
    if (!/srcSet=/.test(tag)) wide.push(entry);
  }
}
console.log(`  renders asked at >= ${PHONE_WIDTH}px: ${wide.length} without a srcset`);
console.log(`  thumbnails below it (one width is right): ${narrow.join(', ') || '(none)'}`);
assert.deepEqual(wide, [],
  `these ask for one fixed width of ${PHONE_WIDTH}px or more and offer nothing smaller, so a phone takes `
  + 'the desktop file to paint a fraction of it:\n  ' + wide.join('\n  '));

// A srcset the browser cannot choose from is the same single width with extra bytes: `sizes` has to be
// there too, or every candidate is measured against the full viewport.
const sizeless = [];
for (const rel of files) {
  const source = strip(readFileSync(join(src, rel), 'utf8'));
  for (const match of source.matchAll(/<img\b[^>]*?srcSet=\{srcSet\([^)]*\)\}[^>]*?\/>/g)) {
    if (!/\bsizes=/.test(match[0])) sizeless.push(`${rel}: ${match[0].replace(/\s+/g, ' ').slice(0, 70)}`);
  }
}
assert.deepEqual(sizeless, [],
  'these offer a srcset with no sizes, so the browser measures every candidate against the full viewport '
  + 'and picks the largest anyway:\n  ' + sizeless.join('\n  '));

console.log('oneWidthIsNotEveryScreen selfcheck OK (every wide render offers a phone width, and says how wide it paints)');
