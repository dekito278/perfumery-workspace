// `node src/utils/siteImageSlots.selfcheck.mjs`
//
// The studio offers a fixed list of site-image slots; the pages read keys out of that same map. Nothing
// connected the two, and they had drifted in both directions: HomePage read 'home-newsletter' with no
// slot to upload it (so that section could only ever show the bundled fallback), while two slots existed
// for keys no page reads.
//
// Also checks that every site image actually goes through the render endpoint. The mobile storefront was
// missed when the transform was added, so phones — most of the buyers — still downloaded the 3.4 MB PNG.
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const src = join(here, '..');

const service = readFileSync(join(src, 'services', 'siteImageStorageService.js'), 'utf8');
const slots = [...service.matchAll(/\{ key: '([a-z-]+)'/g)].map((m) => m[1]);
assert.ok(slots.length >= 6, `only ${slots.length} slots found — has the list moved?`);

// Every page that reads a site image key.
const pages = [];
const walk = (dir) => {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) walk(full);
    else if (entry.name.endsWith('.jsx')) pages.push(full);
  }
};
walk(join(src, 'pages'));
walk(join(src, 'components'));

const readKeys = new Set();
const untransformed = [];
for (const file of pages) {
  const text = readFileSync(file, 'utf8');
  for (const m of text.matchAll(/siteImages\['([a-z-]+)'\]/g)) readKeys.add(m[1]);
  for (const m of text.matchAll(/siteImageKey: '([a-z-]+)'/g)) readKeys.add(m[1]);
  // A site image used as an <img src> must be wrapped in the storage transform.
  for (const m of text.matchAll(/src=\{([^}]*siteImages\[[^}]*)\}/g)) {
    if (!m[1].includes('img(')) untransformed.push(`${file.slice(src.length + 1)}: ${m[1].trim().slice(0, 60)}`);
  }
}

assert.deepEqual(
  untransformed,
  [],
  `these site images are served raw instead of through the render endpoint, so the browser downloads the `
  + `original upload:\n  ${untransformed.join('\n  ')}`,
);

const missingSlot = [...readKeys].filter((key) => !slots.includes(key)).sort();
assert.deepEqual(
  missingSlot,
  [],
  `pages read these site image keys but the studio offers no slot for them, so they can only ever show a `
  + `bundled fallback:\n  ${missingSlot.join('\n  ')}`,
);

// Slots nothing reads are uploads that never appear anywhere. Listed rather than failed: a slot may be
// waiting for a page that is not built yet — but it has to be a decision, not a surprise.
const KNOWN_UNUSED = ['catalog-banner', 'about-hero'];
const unused = slots.filter((key) => !readKeys.has(key)).sort();
assert.deepEqual(
  unused,
  [...KNOWN_UNUSED].sort(),
  `the studio's unused slots changed. Nothing reads: ${unused.join(', ')}. Either wire the key up, drop `
  + 'the slot, or update KNOWN_UNUSED here so it stays a deliberate choice.',
);

console.log(`siteImageSlots selfcheck OK (${slots.length} slots, ${readKeys.size} keys read, ${unused.length} deliberate spares)`);
