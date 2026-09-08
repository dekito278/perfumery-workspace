// `node src/utils/seedProducts.selfcheck.mjs`
//
// data/storefront.js carries six invented perfumes — Santal Morn, Petal Smoke, Citrus Veil, Vanilla
// Atelier, Fig Linen, Cedar Rain — that this shop has never sold. They exist as seed/reference data for
// productCatalogService.normalizeProduct.
//
// HomePage and CatalogPage used them as a fallback: `fetchedProducts.length ? fetchedProducts :
// featuredProducts`. When the catalogue query came back empty — an outage, an RLS change, a dropped
// connection — the storefront showed all six with prices, and clicking one landed on "Halaman tidak
// ditemukan". A shop that appears to stock things it does not is worse than a shop that says it cannot
// load right now.
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const src = join(here, '..');

const seed = readFileSync(join(src, 'data', 'storefront.js'), 'utf8');
const seedNames = [...seed.matchAll(/name: '([^']+)'/g)].map((m) => m[1]);
assert.ok(seedNames.includes('Santal Morn'), 'the seed products moved — update this guard');

// Only the service may reference them, and only as reference data for normalisation.
const ALLOWED = new Set(['services/productCatalogService.js', 'pages/ProductListPage.jsx']);

// Comments are stripped first. The fix itself explains the seed data by name, and a raw substring scan
// would flag that prose as a use — the same blindness silentWrites.selfcheck.mjs had to fix.
const stripComments = (text) => text.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/^[ \t]*\/\/.*$/gm, ' ');

const offenders = [];
const walk = (dir) => {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) { walk(full); continue; }
    if (!/\.jsx?$/.test(entry.name)) continue;
    const rel = full.slice(src.length + 1);
    if (ALLOWED.has(rel)) continue;
    const text = stripComments(readFileSync(full, 'utf8'));
    if (!text.includes('featuredProducts')) continue;
    offenders.push(rel);
  }
};
walk(join(src, 'pages'));
walk(join(src, 'components'));
walk(join(src, 'hooks'));

assert.deepEqual(
  offenders,
  [],
  'these customer-facing files reference the bundled seed products, which are perfumes the shop does not '
  + `sell:\n  ${offenders.join('\n  ')}\n`
  + 'Showing them during an outage puts phantom stock in front of buyers. Render an empty state instead, '
  + `or add the file to ALLOWED if it genuinely needs the seed for normalisation.`,
);

// ProductListPage is admin-only and shows the seed count as a statistic, never as buyable stock.
const adminUse = stripComments(readFileSync(join(src, 'pages', 'ProductListPage.jsx'), 'utf8'));
assert.ok(
  /featuredProducts\.length/.test(adminUse) && !/: featuredProducts/.test(adminUse),
  'ProductListPage now uses the seed as more than a count — check it is not being rendered as stock',
);

console.log(`seedProducts selfcheck OK (${seedNames.length} seed names, 0 customer-facing uses)`);
