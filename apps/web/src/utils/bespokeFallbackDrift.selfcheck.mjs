// `node src/utils/bespokeFallbackDrift.selfcheck.mjs`
//
// defaultBespokeSettings is what a visitor sees while storefront_bespoke_options is unreachable. Nothing
// can be BOUGHT at those numbers — api/orders/create.js reprices every option from the table and rejects
// ids it does not find — so the danger is not money. It is a promise the shop will not keep.
//
// It had drifted to exactly that: 30 ml quoted 40,000 low, 50 ml 65,000 low, and it still offered a
// 100 ml bottle the shop had stopped selling. Someone who hit the outage would fill in a whole brief and
// have the order refused at the last step, by an endpoint saying "Unknown or disabled bespoke option".
//
// The drift itself cannot be checked here — this runs without network, and the table is the only truth.
// `npm run build` does check it, against the live table. So what this guards is that the CHECK still
// exists and still speaks up: delete it and the fallback rots again in silence, which is how it got here.
process.env.TZ = 'Asia/Jakarta';

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const web = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const build = readFileSync(join(web, 'tools', 'build.mjs'), 'utf8');
const service = readFileSync(join(web, 'src', 'services', 'bespokeSettingsService.js'), 'utf8');

// --- 1. The build still compares the fallback against the live table ---------------------------------
assert.match(build, /storefront_bespoke_options/,
  'the build must still read the live options table, or nothing compares the fallback to anything');
assert.match(build, /defaultBespokeSettings/, 'and must still read the bundled fallback to compare it against');
// The sentence is wrapped across two source lines, so match the half that carries the meaning rather
// than the whole thing — a guard that breaks on reflowing a string is a guard someone deletes.
assert.match(build, /difference\(s\) between the bundled fallback prices/,
  'and must still say so out loud when they disagree');
assert.match(build, /fallback option prices match the shop/,
  'and must say so when they agree, or a silent build is indistinguishable from a skipped check');
// Naming the file to edit is the difference between a warning someone acts on and one they scroll past.
assert.match(build, /bespokeSettingsService\.js/, 'the warning names the file to update');

// --- 2. The fallback is shaped like the table it stands in for ------------------------------------------
// Read as TEXT, the way tools/build.mjs reads it. The module imports '@/lib/...', a Vite alias Node
// cannot resolve, so importing it here fails outright.
const block = service.slice(
  service.indexOf('export const defaultBespokeSettings'),
  service.indexOf('const toSlug'),
);
assert.ok(block.length > 100, 'the fallback block is readable — this guard has something to check');

const collections = ['bottleSizes', 'bottleTypes', 'capDesigns', 'labelDesigns', 'exoticMaterials'];
const optionsIn = (key) => {
  const start = block.indexOf(`${key}: [`);
  assert.notEqual(start, -1, `${key} is still a collection in the fallback`);
  const section = block.slice(start, block.indexOf(']', start));
  return [...section.matchAll(/\{([^}]*)\}/g)].map((match) => match[1]);
};

const ids = [];
for (const key of collections) {
  for (const option of optionsIn(key)) {
    for (const field of ['id:', 'label:', 'value:', 'price:', 'enabled:', 'sortOrder:']) {
      assert.ok(option.includes(field),
        `${key}: every option carries ${field.slice(0, -1)} — the order endpoint matches on id, and a missing one is silently undefined`);
    }
    const price = option.match(/price: (\d+)/);
    assert.ok(price, `${key}: a price must be a plain whole number, not an expression: ${option.trim().slice(0, 60)}`);
    ids.push(option.match(/id: "([^"]+)"/)?.[1] ?? option.match(/id: '([^']+)'/)?.[1]);
  }
}

// An id repeated across the file would make the option the visitor picked ambiguous.
const named = ids.filter(Boolean);
assert.equal(new Set(named).size, named.length, `duplicate option ids in the fallback: ${named.join(', ')}`);

// --- 3. A bottle size is the one option that cannot be skipped ------------------------------------------
// Every other collection can legitimately be empty. If the sizes list is, a visitor who catches an outage
// has nothing to choose and the brief cannot be completed at all.
const sizes = optionsIn('bottleSizes');
assert.ok(sizes.length > 0,
  'the fallback must offer at least one bottle size, or the brief cannot be filled in during an outage');
for (const size of sizes) {
  assert.match(size, /enabled: true/,
    'a disabled size in the fallback is an option the visitor can see and the order endpoint will refuse');
}

console.log('bespokeFallbackDrift selfcheck OK (the build still compares the fallback to the live table, and the fallback is shaped like it)');
