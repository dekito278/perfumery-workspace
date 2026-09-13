// `node src/utils/schemaAvailability.selfcheck.mjs`
//
// Measured on the live site: /catalog/aquilaria-tuberosa and /catalog/sudra both had zero stock, both
// showed "Pre-order" to a reader, and both published availability: InStock in the JSON-LD that crawlers
// and social scrapers read. The prerender never fetched stock and hardcoded InStock for every product,
// while the client computed it properly from the storefront's own status — two implementations of one
// answer, and the one that ships in the HTML was the wrong one.
import assert from 'node:assert/strict';
import {
  SCHEMA_IN_STOCK,
  SCHEMA_OUT_OF_STOCK,
  SCHEMA_PRE_ORDER,
  schemaAvailability,
} from './schemaAvailability.js';

// The two products that started this.
assert.equal(schemaAvailability({ stock: 0, variants: [{ size: '30 ml', stock: 0 }] }), SCHEMA_PRE_ORDER,
  'a product with no stock is sold made-to-order, and must not be advertised as in stock');
assert.equal(schemaAvailability({ stock: 12, variants: [{ size: '30 ml', stock: 12 }] }), SCHEMA_IN_STOCK);

// Variant stock is the real total; a stale product-level count must not override it either way.
assert.equal(schemaAvailability({ stock: 0, variants: [{ stock: 0 }, { stock: 3 }] }), SCHEMA_IN_STOCK,
  'one variant in stock means the product can be bought today');
assert.equal(schemaAvailability({ stock: 9, variants: [{ stock: 0 }, { stock: 0 }] }), SCHEMA_PRE_ORDER,
  'every variant empty means nothing ships today, whatever the product row says');

// Discontinued is the one case that is genuinely unavailable rather than made to order.
assert.equal(schemaAvailability({ stock: 0, variants: [], status: 'Habis' }), SCHEMA_OUT_OF_STOCK);
assert.equal(schemaAvailability({ stock: 0, variants: [], status: 'Discontinued' }), SCHEMA_OUT_OF_STOCK);

// With no numbers at all, fall back to the storefront's words.
assert.equal(schemaAvailability({ status: 'Made to order' }), SCHEMA_PRE_ORDER);
assert.equal(schemaAvailability({ status: 'Inquire' }), SCHEMA_PRE_ORDER,
  "'Inquire' is what a variant with no stock is called — it is not availability");
assert.equal(schemaAvailability({ status: 'Available' }), SCHEMA_IN_STOCK);
assert.equal(schemaAvailability({}), SCHEMA_IN_STOCK, 'nothing known at all stays optimistic, as before');

// Both sides must go through this, or they drift again.
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
const webRoot = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
for (const rel of ['src/utils/seo.js', 'tools/seo-artifacts.mjs']) {
  const source = readFileSync(join(webRoot, rel), 'utf8');
  assert.match(source, /schemaAvailability\(/, `${rel} must ask the shared mapping, not answer for itself`);
  assert.doesNotMatch(source.replace(/^\s*\/\/.*$/gm, ''), /'https:\/\/schema\.org\/InStock'/,
    `${rel} still hardcodes InStock somewhere`);
}

console.log('schemaAvailability selfcheck OK (stock decides, and both sides read the same mapping)');
