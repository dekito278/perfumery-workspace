// `node src/utils/publicProductsView.selfcheck.mjs` — the view strips internal tags by a prefix list that
// lives in SQL; the studio writes tags by a prefix list that lives in JS. If they drift, a new internal
// prefix leaks to the public. Compare the two by reading both sources.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const js = readFileSync(join(here, '..', 'services', 'productCatalogService.js'), 'utf8');
const sql = readFileSync(join(here, '..', '..', '..', '..', 'supabase', 'migrations', '20260907053000_storefront_products_public_view.sql'), 'utf8');

// JS: every PRODUCT_*_TAG_PREFIX constant that is listed inside PRODUCT_INTERNAL_TAG_PREFIXES.
const constants = Object.fromEntries([...js.matchAll(/export const (PRODUCT_[A-Z_]+_TAG_PREFIX) = '([^']+)';/g)].map((m) => [m[1], m[2]]));
const listed = [...js.match(/const PRODUCT_INTERNAL_TAG_PREFIXES = \[([\s\S]*?)\];/)[1].matchAll(/(PRODUCT_[A-Z_]+_TAG_PREFIX)/g)].map((m) => constants[m[1]]);
const jsPrefixes = new Set(listed.map((p) => p.toLowerCase()));

// SQL: the literals inside `like any (array[ ... ])`.
const sqlPrefixes = new Set([...sql.match(/like any \(array\[([\s\S]*?)\]\)/)[1].matchAll(/'([^']+)%'/g)].map((m) => m[1]));

assert.ok(jsPrefixes.size >= 10, 'JS prefix list looks truncated');
assert.deepEqual([...sqlPrefixes].sort(), [...jsPrefixes].sort(), 'SQL view prefix list and PRODUCT_INTERNAL_TAG_PREFIXES differ');
console.log(`publicProductsView selfcheck OK (${jsPrefixes.size} prefixes)`);

// The build's own product fetch must read the view, not the base table. Pointing it at
// storefront_products silently emptied the sitemap and every prerendered product page the moment read
// RLS moved to is_admin(), because the anon key then answered 200 with zero rows.
const seo = readFileSync(join(here, '..', '..', 'tools', 'seo-artifacts.mjs'), 'utf8');
const productQuery = seo.match(/const fetchPublicProducts[\s\S]*?restGet\([\s\S]*?'([^']+)'/);
assert.ok(productQuery, 'could not find the build-time product query — update this guard');
assert.ok(
  productQuery[1].startsWith('storefront_products_public?'),
  `the build fetches SEO data from "${productQuery[1].split('?')[0]}"; the anon key cannot read the base table, so this yields an empty sitemap and no prerendered product pages`,
);
console.log('publicProductsView selfcheck OK (build reads the public view)');
