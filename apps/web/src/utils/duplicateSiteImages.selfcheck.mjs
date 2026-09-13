// `node src/utils/duplicateSiteImages.selfcheck.mjs`
//
// Measured against the live bucket: nine slots, eight uploaded, and only THREE distinct pictures between
// them. One file was sitting in home-hero, home-statement, about-hero and mood-floral at once; another in
// catalog-banner and mood-woody; a third in mood-fresh and mood-gourmand. The owner had no way to see
// that — a slot with a preview looks finished — which is why replacing one image did not change the
// storefront.
//
// Storage returns an eTag per object, which is the MD5 of its contents, so the grouping is free. This
// pins the grouping itself.
import assert from 'node:assert/strict';
import { readFileSync, writeFileSync, unlinkSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const shim = join(here, `.dupes.selfcheck.${process.pid}.mjs`);
writeFileSync(shim, `${readFileSync(join(here, '..', 'services', 'siteImageStorageService.js'), 'utf8')
  .replace(/^import .*?;$/gm, '')
  .replace(/^export /gm, '')}\nexport { groupDuplicateSlots };\n`);
const { groupDuplicateSlots } = await import(shim);
unlinkSync(shim);

// The real shape, from the live bucket on the day this was written.
const live = groupDuplicateSlots({
  'home-hero': '79355600d82f0075f90f43109469d6aa',
  'home-statement': '79355600d82f0075f90f43109469d6aa',
  'about-hero': '79355600d82f0075f90f43109469d6aa',
  'mood-floral': '79355600d82f0075f90f43109469d6aa',
  'catalog-banner': 'c02471ac96224',
  'mood-woody': 'c02471ac96224',
  'mood-fresh': '320a8318e3719',
  'mood-gourmand': '320a8318e3719',
});
assert.deepEqual(live['home-hero'], ['about-hero', 'home-statement', 'mood-floral'],
  'a slot must name every other slot holding the identical file, sorted so the notice is stable');
assert.deepEqual(live['mood-fresh'], ['mood-gourmand']);
assert.deepEqual(live['mood-woody'], ['catalog-banner']);
assert.equal(Object.keys(live).length, 8, 'every slot in a repeated group is flagged, not just the extras');

// A slot whose picture is its own says nothing.
assert.deepEqual(groupDuplicateSlots({ a: 'x', b: 'y', c: 'z' }), {},
  'distinct images must not be reported as repeats');
assert.deepEqual(groupDuplicateSlots({}), {}, 'an empty bucket is not a duplicate');

// Storage quotes the eTag; a missing one must not make every empty slot a match for every other.
assert.deepEqual(groupDuplicateSlots({ a: '', b: '', c: null, d: undefined }), {},
  'slots with no fingerprint are unknown, not identical');

console.log('duplicateSiteImages selfcheck OK (repeated slots name each other, unknowns stay unknown)');
