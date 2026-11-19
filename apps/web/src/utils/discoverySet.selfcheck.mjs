// `node src/utils/discoverySet.selfcheck.mjs`
//
// Dekito's discovery sets (18 Nov 2026): abroad they ride with a bottle (US$35/45/115, his numbers), no free
// vial, and the price he set — no automatic member or export price. Told apart by category, which every cart
// and order line carries.
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { DISCOVERY_SET_CATEGORY, isDiscoverySet, parcelBottlesFor, setContents, setSizeLabel } from './discoverySet.js';
import { bottleCount, freeVialAllowance } from './freeVial.js';
import { planAutoTierPrices } from './autoTierPrices.js';

const here = dirname(fileURLToPath(import.meta.url));
const set = { slug: 'set-i-floral', category: DISCOVERY_SET_CATEGORY, priceNumber: 199000, variants: [{ id: 'set', size: '5 vial', priceNumber: 199000, stock: 5 }] };
const bottle = { slug: 'hug-n-1', category: 'Limited', variants: [{ id: '30-ml', size: '30 ml', priceNumber: 479000, stock: 5 }] };

assert.equal(isDiscoverySet(set), true);
assert.equal(isDiscoverySet({ category: 'discovery set ' }), true, 'case and spaces do not matter');
assert.equal(isDiscoverySet(bottle), false);
assert.equal(isDiscoverySet({}), false);
// 1. Abroad a set rides with a bottle: one set per bottle adds nothing, a set beyond that ships as a bottle.
assert.equal(parcelBottlesFor(1, 1), 1);
assert.equal(parcelBottlesFor(2, 1), 2);
assert.equal(parcelBottlesFor(1, 3), 3, 'two sets beyond the one bottle ship as two bottles');
assert.equal(parcelBottlesFor(0, 1), 1, 'a set alone is a parcel of its own (and the cart warns)');
assert.equal(parcelBottlesFor(2, 0), 2);
// 2. Not a bottle: no vial.
assert.equal(bottleCount([{ ...set, quantity: 2 }]), 0);
assert.equal(freeVialAllowance(bottleCount([{ ...set, quantity: 1 }, { ...bottle, quantity: 1 }])), 1, 'only the bottle earns a vial');
// 3. Exactly his price.
assert.deepEqual(planAutoTierPrices({ product: set, previousProduct: null, savedRows: [] }), { writes: [], kept: [] });

// Wiring.
const read = (...parts) => readFileSync(join(here, '..', ...parts), 'utf8');
assert.match(read('..', 'api', 'orders', 'create.js'), /\} else if \(!isDiscoverySet\(product\)\) \{\s*\/\/[^\n]*\n\s*bottles \+= qty;/, 'the server does not count a set as a bottle either');
const quoteHook = read('hooks', 'useInternationalQuote.js');
assert.match(quoteHook, /bottles: Math\.max\(1, parcel\)/, 'the English shipping is priced on the parcel, sets included');
assert.match(quoteHook, /setsNeedBottle: sets > 0 && !bottles/);
assert.match(read('pages', 'InternationalCartPage.jsx'), /\{quote\.setsNeedBottle \? \(\s*<p[^>]*role="alert">\{t\('cart\.intl\.setNeedsBottle'\)\}/, 'a set with no bottle is said, before WhatsApp');
assert.match(read('pages', 'PublicProductDetailPage.jsx'), /exportPrice && !soldOut && isDiscoverySet\(product\) \? \(\s*<p[^>]*>\{t\('pdp\.setAbroad'\)\}/, 'the English set page says it rides with a bottle');
// Audit, 19 Nov 2026: the set page lists the perfumes in the box, read from Dekito's own description.
{
  const cat = [
    { slug: 'la-rose', name: 'La rose', category: 'Floral' },
    { slug: 'l-iris', name: 'L’iris', category: 'Floral' },
    { slug: 'ayang', name: 'Ayang-ayang (ꦲꦪꦤ꧀ꦒ꧀)', category: 'Floral' },
    { slug: 'hug-n-1', name: 'HUG N°1', category: 'Limited' },
    { slug: 'wayback', name: '.Wayback', category: 'Woody' },
    { slug: 'set-x', name: 'La rose box', category: DISCOVERY_SET_CATEGORY },
  ];
  const box = { ...set, description: "Isi 5 vial: La Rose, La Tulipe, L'iris, Ayang-ayang, Lintang Asmoro." };
  assert.deepEqual(setContents(box, cat).map((item) => item.slug), ['la-rose', 'l-iris', 'ayang'],
    'in the description\'s order; case, apostrophes and aksara do not matter; never a perfume it does not name; never a set');
  assert.deepEqual(setContents(bottle, cat), [], 'only a set has contents');
  assert.deepEqual(setContents({ ...set, description: '' }, cat), []);
}
assert.equal(setSizeLabel('5 vial', true), '5 vials');
assert.equal(setSizeLabel('5 vial', false), '5 vial');
assert.equal(setSizeLabel('30 ml', true), '30 ml');
const pdpPage = read('pages', 'PublicProductDetailPage.jsx');
assert.match(pdpPage, /const inTheSet = setContents\(product, catalog\);/);
assert.match(pdpPage, /\{isSet \? \(\s*<>\s*<h2 id="pdp-pyramid-heading"[^>]*>\{t\('pdp\.setContentsHeading'\)\}/, 'a set page shows what is in the box, not an empty pyramid');
// And the catalogue counts perfumes as perfumes ("27 parfum" counted the five sets).
const catalogPage = read('pages', 'CatalogPage.jsx');
assert.match(catalogPage, /const perfumeCount = products\.filter\(\(product\) => !isDiscoverySet\(product\)\)\.length;/);
assert.match(catalogPage, /t\('catalog\.ngEyebrow', \{ count: perfumeCount \}\)/);

// The box images the SQL points at ship with the site.
for (const name of ['set-i-floral', 'set-ii-hangat-manis', 'set-iii-jalan-pulang', 'set-iv-limited', 'set-lengkap']) {
  assert.ok(existsSync(join(here, '..', '..', 'public', 'brand', 'sets', `${name}.jpg`)), `${name}.jpg is missing`);
}
console.log('discoverySet selfcheck OK (rides with a bottle abroad, no free vial, Dekito\'s price, images shipped)');
