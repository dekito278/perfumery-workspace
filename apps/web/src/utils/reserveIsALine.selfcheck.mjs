// `node src/utils/reserveIsALine.selfcheck.mjs`
//
// Solivagant Reserve is a LINE: a badge with a pill, never a scent family and never a price tier.
//
// The October 2026 brief used "Reserve" as though it were a price tier. It is not — Dekito, 23 Oct
// 2026: "Reserve itu nama lini baru". This pins the shape so the word cannot drift back.
//
// The thing most worth guarding is that it is INERT. Ambar Segara is not in the catalogue yet, so
// nothing wears the badge, and a buyer must see exactly today's screen: no badge on any card, and no
// RESERVE pill. A feature that quietly changes the shop before its first product exists is worse than
// no feature, and that is easy to do by accident — appending a pill unconditionally would do it.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  cardLabels, catalogCategoryPills, familyLabel, isLimitedProduct, isReserveProduct,
  matchesCatalogCategory, productBadges,
} from './productBadge.js';

const here = dirname(fileURLToPath(import.meta.url));
const read = (...parts) => readFileSync(join(here, ...parts), 'utf8');

// --- 1. Inert until something wears it ---------------------------------------------------------------
// Today's catalogue, as filed: families, plus the ten that still sit under 'Limited'.
const today = [
  { name: 'La Rose', category: 'Floral' },
  { name: 'Vanille Planifolia', category: 'Gourmand' },
  { name: 'Maskumambang', category: 'Floral', limited: true },
  { name: 'Jata Bhumi', category: 'Limited' },
];
const pillsToday = catalogCategoryPills(today);
assert.ok(!pillsToday.includes('Reserve'),
  `a RESERVE pill appears with nothing in the line: ${pillsToday.join(', ')}. The shop must look exactly `
  + 'as it does today until Dekito ticks the first bottle');
for (const product of today) {
  assert.ok(!cardLabels(product).includes('Reserve'),
    `${product.name} wears a RESERVE badge it was never given: ${cardLabels(product).join(' / ')}`);
}

// --- 2. It appears the moment one is flagged ---------------------------------------------------------
const ambar = { name: 'Ambar Segara', category: 'Amber', reserve: true };
assert.ok(isReserveProduct(ambar), 'a flagged perfume is not recognised as being in the line');
const pillsWithLine = catalogCategoryPills([...today, ambar]);
assert.ok(pillsWithLine.includes('Reserve'), `the pill never shows up: ${pillsWithLine.join(', ')}`);
assert.deepEqual(pillsWithLine.slice(0, pillsToday.length), pillsToday,
  'adding the line reordered the pills that were already there — today\'s screen must be a prefix of '
  + `tomorrow's: ${pillsWithLine.join(', ')}`);

// --- 3. A line is not a family ------------------------------------------------------------------------
// The whole lesson of 20260920160500: a badge in the category seat makes a perfume unfindable by what
// it smells of. Ambar Segara is an amber, and must answer to AMBER as well as to RESERVE.
assert.equal(familyLabel(ambar), 'Amber', 'the family was swallowed by the line name');
assert.ok(matchesCatalogCategory(ambar, 'Amber'), 'a Reserve bottle vanished from its own scent family');
assert.ok(matchesCatalogCategory(ambar, 'Reserve'), 'the RESERVE pill does not find the bottle in it');
assert.ok(!matchesCatalogCategory({ name: 'La Rose', category: 'Floral' }, 'Reserve'),
  'the RESERVE pill matches a perfume that is not in the line');
assert.deepEqual(cardLabels(ambar), ['Amber', 'Reserve'], 'the card must say both, family first');

// Both badges at once must work, since a Reserve bottle is likely to be limited too.
const both = { name: 'X', category: 'Woody', limited: true, reserve: true };
assert.deepEqual(productBadges(both).map((badge) => badge.label), ['Limited', 'Reserve']);
assert.deepEqual(cardLabels(both), ['Woody', 'Limited', 'Reserve']);
assert.ok(isLimitedProduct(both) && isReserveProduct(both));

// --- 4. The flag survives every hop from the row to the screen ---------------------------------------
// Counted, not quoted: the launch_year bug was FOUR hand-written allowlists between the column and the
// page, each of which silently dropped the field. The same four stand here.
const CHAIN = [
  ['services/productCatalogService.js', /reserve: Boolean\(row\.reserve\)/,
    'fromDatabaseRow does not read the column'],
  ['services/productCatalogService.js', /reserve: Boolean\(input\.reserve\)/,
    'normalizeProduct rebuilds the product from a named list and drops the flag one hop after it is read'],
  ['services/productCatalogService.js', /reserve: Boolean\(product\.reserve\)/,
    'a box ticked in Studio would never be written back'],
  ['data/publicStorefront.js', /reserve: Boolean\(product\.reserve\)/,
    'the public mapper the product pages read through does not carry it, so no card can show the badge'],
];
for (const [file, pattern, why] of CHAIN) {
  assert.match(read('..', file), pattern, `${file}: ${why}`);
}

// --- 5. Dekito can actually set it, on both screens ---------------------------------------------------
// A column nothing can write is a column that stays false forever.
for (const form of ['ProductForm.jsx', 'MobileProductForm.jsx']) {
  const source = read('..', 'components', 'product', form);
  assert.match(source, /updateField\('reserve'/,
    `${form} has no way to tick the line — the column could never become true`);
  assert.match(source, /checked=\{Boolean\(form\.reserve\)\}/,
    `${form} does not show the current value, so the box would always look unticked`);
}
assert.match(read('productFormSnapshot.js'), /reserve: Boolean\(product\.reserve\)/,
  'the form snapshot drops it, so the editor would report an unsaved change that is not there');

// --- 6. The column is declared, and the migration flags nothing --------------------------------------
const migration = read('..', '..', '..', '..', 'supabase', 'migrations', '20261024090000_reserve_is_a_line.sql');
assert.match(migration, /add column if not exists reserve boolean not null default false/,
  'the migration does not add the column the code reads');
assert.ok(!/^\s*update\s+public\.storefront_products/mi.test(migration),
  'the migration flags products by itself. Which perfumes are in the line is the perfumer\'s call, made '
  + 'in Studio — guessing it is the mistake 20260920160500 explicitly refused to make');

console.log('reserveIsALine selfcheck OK (inert today, a badge and a pill tomorrow, never a family)');
