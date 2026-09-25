// `node src/utils/restockThresholdIsPerProduct.selfcheck.mjs`
//
// Every product carries its own restock threshold. It is an editable field on both product forms, it
// survives as an internal tag, and getProductLowStock is built on it: stock above zero and at or below
// whatever that product's threshold says. Five is only the fallback for a product that has never been
// given one.
//
// Both product list screens painted their variant badges red at a hard-coded 5.
//
// The desktop one contradicted itself in the space of two lines. Line 166 coloured the badge against
// the literal; line 171, directly beneath it, printed "min {getProductRestockThreshold(product)}". Set
// a threshold of 12 on a bottle and the screen said "min 12" under a badge that stayed calm at 8. The
// phone did the same without even the text, so the colour could not be questioned.
//
// This is not the usual desktop-versus-phone split. Both copied the default by hand, which is the older
// and quieter version of the same mistake: the helper was written, and the screens kept the number.
//
// The rule: no screen decides what "low" means. Both halves derived — the behaviour is RUN against
// products built here, and the offending shape is searched for across the tree rather than in the two
// files that happened to have it.
import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { Buffer } from 'node:buffer';

const src = dirname(fileURLToPath(import.meta.url)).replace(/\/utils$/, '');

// The two pure functions, lifted out of a service whose import graph reaches supabase. Multi-line
// imports stripped too — leaving them in is how a stub collides with a name already bound.
const serviceSource = readFileSync(join(src, 'services', 'productCatalogService.js'), 'utf8');
const slice = (name) => {
  const start = serviceSource.indexOf(`export const ${name} = `);
  assert.notEqual(start, -1, `${name} has moved; this guard no longer points at it`);
  // From the ARROW's body, not the first brace after the name: getProductRestockThreshold's parameter
  // list is `(product = {}, fallback = 5)`, so the first `{` is a default value that closes instantly
  // and the slice came back as half a declaration.
  let index = serviceSource.indexOf('=> {', start) + 3;
  let depth = 1;
  index += 1;
  while (index < serviceSource.length && depth) {
    if (serviceSource[index] === '{') depth += 1;
    else if (serviceSource[index] === '}') depth -= 1;
    index += 1;
  }
  return serviceSource.slice(start, index + 1);
};
const tagPrefix = serviceSource.match(/const PRODUCT_RESTOCK_THRESHOLD_TAG_PREFIX = '[^']*';/)[0];
const module = [
  "const splitList = (value) => (Array.isArray(value) ? value : String(value || '').split(',')).map((item) => String(item).trim()).filter(Boolean);",
  tagPrefix,
  serviceSource.match(/const getProductInternalTagValue = [\s\S]*?\n\};/)[0],
  slice('getProductRestockThreshold'),
  slice('getProductLowStock'),
].join('\n\n');
const { getProductRestockThreshold, getProductLowStock } = await import(
  `data:text/javascript;base64,${Buffer.from(module, 'utf8').toString('base64')}`
);

// --- 1. The threshold is the product's own ---------------------------------------------------------------
assert.equal(getProductRestockThreshold({}), 5, 'five is the fallback for a product never given one');
assert.equal(getProductRestockThreshold({ restockThreshold: 12 }), 12, 'and a set threshold is the answer');
assert.equal(getProductRestockThreshold({ restockThreshold: 0 }), 0,
  'zero is a real answer — "tell me only when it is gone" — not a missing one');
assert.equal(getProductRestockThreshold({ restockThreshold: 'abc' }), 5, 'nonsense falls back rather than throwing');

// The case the badges got wrong: eight left against a threshold of twelve is low.
assert.equal(getProductLowStock({ stock: 8, restockThreshold: 12 }), true,
  'a bottle under its own threshold is low, whatever the number five thinks');
assert.equal(getProductLowStock({ stock: 8 }), false, 'and above the fallback it is not');
assert.equal(getProductLowStock({ stock: 0, restockThreshold: 12 }), false,
  'sold out is a different state with its own filter, deliberately excluded here');

// --- 2. Nobody decides it for themselves ------------------------------------------------------------------
const files = [];
const walk = (dir) => {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) walk(full);
    else if (/\.(js|jsx)$/.test(entry.name) && !entry.name.includes('.selfcheck.')) files.push(full);
  }
};
walk(src);

const PINNED = /\bstock\s*(?:<=|<)\s*\d+/;
const offenders = files
  .filter((file) => !file.endsWith(join('services', 'productCatalogService.js')))
  .filter((file) => PINNED.test(readFileSync(file, 'utf8')
    .replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '')))
  .map((file) => file.slice(src.length + 1));
assert.deepEqual(offenders, [],
  'a screen compares stock against a number it chose itself. The threshold is per product and editable '
  + 'on the very form beside these screens, so a pinned number is a badge that ignores what was typed '
  + `into it: ${offenders.join(', ')}`);

// --- 3. And the screens that colour a badge take it from the helper ---------------------------------------
for (const name of ['pages/ProductListPage.jsx', 'pages/mobile/MobileProductListPage.jsx']) {
  const text = readFileSync(join(src, name), 'utf8');
  assert.match(text, /variant\.stock <= getProductRestockThreshold\(product\)/,
    `${name} no longer colours its variant badge against the product's own threshold`);
  assert.match(text, /min \{getProductRestockThreshold\(product\)\}/,
    `${name} colours a badge by a rule it never states — the number has to be on screen or the colour `
    + 'cannot be questioned. That is how the desktop went two lines contradicting itself');
}

console.log(`restockThresholdIsPerProduct selfcheck OK (${files.length} modules, none of them deciding `
  + 'what "low" means on their own)');
