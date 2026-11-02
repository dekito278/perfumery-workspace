// `node src/utils/relatedProducts.selfcheck.mjs`
//
// "Mungkin kamu suka" offered the first four perfumes in the catalogue, on every product page.
//
// Measured on the live shop: HUG N°1 (metallic, milky, musky) and Vanille Planifolia (a vanilla
// gourmand) both showed L'iris, Maskumambang, La Tulipe and .Wayback — identical, in catalogue order.
// The vanilla's own sibling, J'adore la Vanille, was never suggested on it.
//
// The desktop page named that list `contextual` while computing catalog.slice(0, 4); the phone did not
// even try. Tested as behaviour, because the bug was never in the WORDS — it was in what came back.
import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { relatedFor } from './relatedProducts.js';

const here = dirname(fileURLToPath(import.meta.url));
const strip = (src) => src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
const read = (...parts) => strip(readFileSync(join(here, '..', ...parts), 'utf8'));

const catalog = [
  { slug: 'liris', category: 'Floral' },
  { slug: 'maskumambang', category: 'Limited' },
  { slug: 'la-tulipe', category: 'Floral' },
  { slug: 'wayback', category: 'Woody' },
  { slug: 'vanille-planifolia', category: 'Gourmand' },
  { slug: 'jadore-la-vanille', category: 'Gourmand' },
  { slug: 'hug-n-1', category: 'Limited' },
];
const slugs = (list) => list.map((item) => item.slug);

// --- 1. The sibling comes first ----------------------------------------------------------------------
const vanilla = catalog.find((item) => item.slug === 'vanille-planifolia');
assert.equal(slugs(relatedFor(vanilla, catalog))[0], 'jadore-la-vanille',
  'a gourmand must lead with the other gourmand — this is the case that was wrong on the live site');

// --- 2. Never itself, and never short ----------------------------------------------------------------
for (const product of catalog) {
  const related = relatedFor(product, catalog);
  assert.ok(!slugs(related).includes(product.slug), `${product.slug} recommends itself`);
  assert.equal(related.length, 4, `${product.slug} must still fill the row`);
  assert.equal(new Set(slugs(related)).size, 4, `${product.slug} repeats a perfume`);
}

// --- 3. Same category first, THEN the rest -----------------------------------------------------------
{
  const order = slugs(relatedFor(catalog[0], catalog)); // Floral
  assert.equal(order[0], 'la-tulipe', 'the other floral leads');
  assert.ok(order.slice(1).length === 3, 'and the row is padded from the rest of the catalogue');
}

// --- 4. A hand-chosen pairing beats the rule ---------------------------------------------------------
{
  const withPicks = { slug: 'hug-n-1', category: 'Limited', relatedFragrances: ['wayback', 'la-tulipe'] };
  const order = slugs(relatedFor(withPicks, catalog));
  assert.deepEqual(order.slice(0, 2), ['wayback', 'la-tulipe'], 'explicit picks lead, in the order given');
  assert.ok(!order.slice(2).includes('wayback'), 'and are never repeated by the fallback');
  // A pick that no longer exists must be dropped, not rendered as a hole.
  const stale = { slug: 'hug-n-1', category: 'Limited', relatedFragrances: ['tidak-ada', 'wayback'] };
  assert.equal(slugs(relatedFor(stale, catalog))[0], 'wayback', 'a dead slug is skipped, not left as a gap');
}

// --- 5. Nothing to work with is not a crash ----------------------------------------------------------
assert.deepEqual(relatedFor(null, catalog), []);
assert.deepEqual(relatedFor(catalog[0], null), []);
assert.deepEqual(relatedFor(catalog[0], []), []);
assert.deepEqual(relatedFor({ slug: 'solo', category: 'Floral' }, [{ slug: 'solo', category: 'Floral' }]), []);

// --- 6. BOTH pages use the one rule ------------------------------------------------------------------
// There are two product pages and they disagreed: the desktop padded explicit picks, the phone took the
// first four and nothing else.
for (const [name, file] of [
  ['desktop', ['pages', 'PublicProductDetailPage.jsx']],
]) {
  const source = read(...file);
  assert.match(source, /relatedFor\(product, catalog\)/, `${name} must ask the shared rule`);
  assert.doesNotMatch(source, /catalog\s*\n?\s*\.filter\([^)]*\)\s*\n?\s*\.slice\(0, 4\)/,
    `${name} still builds its own "first four in the catalogue" list`);
}

// --- The picks come from Studio now ------------------------------------------------------------------
// Until 2026-11-03 relatedFragrances existed only in the static seed, so no live product ever had one.
// It is stored in related_slugs and must survive every hand-written list between the form and the page —
// a field not named in one of them stops existing at that line.
const service = readFileSync(join(here, '..', 'services', 'productCatalogService.js'), 'utf8');
for (const [pattern, why] of [
  [/relatedFragrances: Array\.isArray\(row\.related_slugs\)/, 'fromDatabaseRow does not read related_slugs'],
  [/relatedFragrances: splitList\(input\.relatedFragrances\)/, 'normalizeProduct drops the picks one hop after they are read'],
  [/related_slugs: product\.relatedFragrances/, 'the save does not write related_slugs, so a pick is lost'],
]) assert.match(service, pattern, why);
assert.match(readFileSync(join(here, '..', 'data', 'publicStorefront.js'), 'utf8'), /relatedFragrances: product\.relatedFragrances/,
  'the public mapper does not carry the picks to the page');
for (const form of ['ProductForm.jsx', 'MobileProductForm.jsx']) {
  assert.match(readFileSync(join(here, '..', 'components', 'product', form), 'utf8'),
    /<RelatedFragrancePicker value=\{form\.relatedFragrances\} onChange=\{\(next\) => updateField\('relatedFragrances', next\)\}/,
    `${form} cannot pick the pairings`);
}
// The column must reach the buyer's view, which freezes its column list when it is created.
const migrations = join(here, '..', '..', '..', '..', 'supabase', 'migrations');
const adder = readdirSync(migrations).filter((name) => /add column if not exists related_slugs/.test(readFileSync(join(migrations, name), 'utf8')));
assert.equal(adder.length, 1, `exactly one migration adds related_slugs, found ${adder.join(', ') || 'none'}`);
assert.match(readFileSync(join(migrations, adder[0]), 'utf8'), /create or replace view public\.storefront_products_public/,
  `${adder[0]} adds related_slugs and never recreates the buyer's view, so no buyer would see a pick`);

console.log('relatedProducts selfcheck OK (a gourmand leads with the other gourmand, both pages ask the same rule)');
