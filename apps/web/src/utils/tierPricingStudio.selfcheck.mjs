// `node src/utils/tierPricingStudio.selfcheck.mjs`
//
// Two invariants for the Studio side of tiered pricing.
//
// One: there is exactly ONE implementation of each control. The desktop/mobile split produced five
// separate divergences in audit round 9 — a price control that drifts between the two would let the
// owner set a member price on a phone that the desktop cannot see.
//
// Two: a Studio surface must SAY when the migration has not been applied. On the storefront, falling
// back to retail silently is correct — retail is a real price. Here it is a trap: the owner types in a
// member price, sees no complaint, and believes it is live.
import assert from 'node:assert/strict';
import { tierPriceIsNotBelowRetail } from './memberPriceFill.js';
import { tierEditorRows, tierEmptyMeaning, tierPriceWarning } from './tierEditorRows.js';
import { readdirSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const src = join(dirname(fileURLToPath(import.meta.url)), '..');
const read = (...parts) => readFileSync(join(src, ...parts), 'utf8');

const tierEditor = read('components', 'product', 'TierPriceEditor.jsx');
const tierSelect = read('components', 'CustomerTierSelect.jsx');
const service = read('services', 'tierPricingService.js');

// --- one implementation, mounted twice -------------------------------------------------------------
for (const [file, mount] of [
  [['components', 'product', 'ProductForm.jsx'], 'TierPriceEditor'],
  [['components', 'product', 'MobileProductForm.jsx'], 'TierPriceEditor'],
  [['pages', 'CustomersPage.jsx'], 'CustomerTierSelect'],
  [['pages', 'mobile', 'MobileCustomersPage.jsx'], 'CustomerTierSelect'],
]) {
  const source = read(...file);
  assert.match(source, new RegExp(`import ${mount} from`), `${file.join('/')} must import the shared ${mount}`);
  assert.match(source, new RegExp(`<${mount}\\b`), `${file.join('/')} must render ${mount}, not its own copy`);
  // A second implementation would write the tier table directly instead of going through the mount.
  assert.doesNotMatch(source, /storefront_product_prices|saveTierPrice\(/,
    `${file.join('/')} must not write tier prices itself — that is how the two copies drift apart`);
}

// --- the missing migration is visible, on both surfaces --------------------------------------------
assert.match(tierEditor, /schemaReady/, 'the price editor must track whether the table exists');
assert.match(tierEditor, /20260913090000_customer_tiers_and_tier_prices\.sql/,
  'the warning has to name the migration to run, or it is not actionable');
assert.match(tierEditor, /disabled=\{disabled\}/,
  'inputs must be disabled when the table is missing, not merely captioned');

for (const file of [['pages', 'CustomersPage.jsx'], ['pages', 'mobile', 'MobileCustomersPage.jsx']]) {
  const source = read(...file);
  assert.match(source, /tierSchemaReady/, `${file.join('/')} must read the tier schema probe`);
  assert.match(source, /role="alert"[\s\S]{0,400}?20260913090000/,
    `${file.join('/')} must show an alert naming the migration when the column is missing`);
  assert.match(source, /disabled=\{!tierSchemaReady\}/,
    `${file.join('/')} must disable the tier control when the column is missing`);
}

// The probe cannot be replaced by reading the customer list: select('*') succeeds and just omits the
// column, so a missing migration would look exactly like a shop with no resellers.
assert.match(service, /export const customerTierSchemaReady/);
assert.match(service, /\.select\('tier'\)/, 'the probe has to ask for the column by name');

// --- the controls offer only values that do something ----------------------------------------------
// storefront_my_price_tier() answers 'member' for anyone signed in, whatever this column says, so a
// "member" option would be a setting that changes nothing.
assert.doesNotMatch(tierSelect.slice(0, tierSelect.indexOf('const CustomerTierSelect')).replace(/\/\/[^\n]*/g, ''),
  /value: 'member'/, 'offering member here would be a control that does nothing');
assert.match(tierSelect, /value: 'retail'[\s\S]{0,200}value: 'reseller'/, 'the two real states must both be offered');
assert.match(tierSelect, /setTier\(previous\)/,
  'a refused write must put the control back — a select left on "Reseller" is the same lie as a false toast');

// Retail is never stored in the tier table; it lives on the product and is the fallback.
const editableTiers = tierEditor.slice(tierEditor.indexOf('const EDITABLE_TIERS'), tierEditor.indexOf('const cellKey'));
assert.doesNotMatch(editableTiers, /'retail'/, 'retail must not be editable here — it would be a second copy that drifts');
for (const tier of ['member', 'reseller', 'overseas']) {
  assert.match(editableTiers, new RegExp(`key: '${tier}'`), `${tier} must be fillable in Studio`);
}

// After saving, the editor re-reads. Writes to this table are RLS-filtered, so what came back is the
// only evidence of what landed.
assert.match(tierEditor, /const \{ rows: freshRows[\s\S]{0,200}listTierPricesForProduct\(productId\)/,
  'the editor must re-read after saving rather than trusting its own draft');

// --- every saved price is on screen ----------------------------------------------------------------
// The rule used to be "one size, one row — and that row is ''". It guarded against a '' price vanishing,
// and in doing so hid every other price: the automatic member and export prices are written per SIZE, so
// on 2026-11-08 all 39 rows in the table were size rows and the form showed every one of them as empty.
// A price typed there landed on '' and the size row it could not see went on overriding it.
//
// Run, not read: whatever is saved, its row is drawn, and a single-size product still gets one row.
assert.match(tierEditor, /tierEditorRows\(variants, saved\)/, 'the editor must take its rows from the shared builder');
const oneSize = [{ id: '30-ml', size: '30 ml', priceNumber: 429000 }];
const ids = (rows) => rows.map((row) => row.id);
assert.deepEqual(ids(tierEditorRows(oneSize, { '30-ml|member': 386000, '30-ml|overseas': 1510000 })), ['30-ml'],
  'one size with its prices on the size row — the case every live product is in — draws that row, and only it');
assert.deepEqual(ids(tierEditorRows(oneSize, {})), ['30-ml'],
  'a single size with nothing saved yet is still one row, so the automation and the owner write to the same place');
assert.deepEqual(ids(tierEditorRows(oneSize, { '|member': 300000 })), ['', '30-ml'],
  'a price saved on the every-size row is still applied to orders, so it must stay visible');
assert.deepEqual(ids(tierEditorRows([...oneSize, { id: '50-ml', size: '50 ml', priceNumber: 939000 }], {})), ['', '30-ml', '50-ml'],
  'two sizes draw the default row and one row each');
assert.deepEqual(ids(tierEditorRows([], {})), [''], 'a product with no variants prices the every-size row');
assert.equal(tierEditorRows(oneSize, {})[0].retail, 429000, 'a size row knows the retail price it is compared against');
assert.equal(tierEmptyMeaning('30-ml', 'member', { '|member': 300000 }), 'Kosong = ikut semua ukuran',
  'an empty size box falls back to the every-size price when there is one — saying "retail" there would be wrong');
assert.equal(tierEmptyMeaning('30-ml', 'member', {}), 'Kosong = harga retail');
// The export price is meant to be ABOVE retail. The member rule applied to it painted L'iris's correct
// Rp 1.510.000 red the moment it was first shown.
assert.equal(tierPriceWarning('overseas', 429000, 1510000), '', 'a correct export price above retail is not a warning');
assert.equal(tierPriceWarning('overseas', 429000, 400000), 'Di bawah harga retail', 'an export price under retail is a typo');
assert.equal(tierPriceWarning('member', 429000, 386000), '', 'a member price under retail is the point');
assert.equal(tierPriceWarning('member', 429000, 429000), 'Tidak di bawah harga retail');
assert.equal(tierPriceWarning('reseller', 429000, ''), '', 'an empty box is not a mistake');
assert.match(tierEditor, /row\.retail \? `Retail \$\{formatRupiah\(row\.retail\)\}`/,
  'the row must show the retail price it is being compared against when it knows one');

// --- grids that hold inputs must be allowed to shrink -------------------------------------------------
// `1fr` is minmax(auto,1fr): the column may not shrink below its content's minimum width. Four text
// inputs plus a button overflowed their card by 238px on a 1440px screen — measured, not guessed.
for (const [file, source] of [
  ['components/product/ProductForm.jsx', read('components', 'product', 'ProductForm.jsx')],
  ['pages/CustomersPage.jsx', read('pages', 'CustomersPage.jsx')],
]) {
  for (const template of source.match(/grid-cols-\[[^\]]*\]/g) || []) {
    // NOT \b1fr\b: `_` is a word character, so there is no boundary in `_1fr` and every column after
    // the first went uncounted — this guard passed its own sabotage until that was fixed.
    const flexible = (template.match(/(?<![,\d.])1fr/g) || []).length;
    assert.ok(flexible < 2,
      `${file} has a grid with ${flexible} bare 1fr columns (${template}). Use minmax(0,1fr) so the `
      + 'columns can shrink instead of pushing the row out of its card.');
  }
}

// --- Three: a screen that sets a tier price must say when it is not below retail ----------------------
// member and reseller exist to be cheaper than walking in. One typed at or above retail charges a
// signed-in buyer MORE than a stranger, while the storefront badge still reads "Harga member aktif".
//
// It was invisible on both screens for the worst possible reason: memberSaving returns 0 for exactly
// that case, so the saving column renders EMPTY — which is also what an unfilled price looks like. The
// export column beside it has flagged its own mirror case ("Di bawah harga retail") since it shipped;
// the domestic direction never got the same treatment. Same shape as the export check on purpose:
// flagged, never blocked, because the number is Dekito's to set.
//
// Counted, not listed: the screens are whichever files call saveTierPrice. A third one added later is
// covered by being written, not by being added here.
const setsTierPrices = [];
const silent = [];
const walkStudio = (dir) => {
  for (const entry of readdirSync(join(src, dir), { withFileTypes: true })) {
    const rel = `${dir}/${entry.name}`;
    if (entry.isDirectory()) { walkStudio(rel); continue; }
    if (!/\.(jsx|js)$/.test(entry.name) || entry.name.includes('.selfcheck.')) continue;
    const source = read(rel).replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
    if (!/\bsaveTierPrice\s*\(/.test(source)) continue;
    setsTierPrices.push(rel);
    // tierPriceWarning carries the same member/reseller rule (run above) plus the export price's own.
    if (!/(tierPriceIsNotBelowRetail|tierPriceWarning)\s*\(/.test(source)) silent.push(rel);
  }
};
for (const dir of ['pages', 'components']) walkStudio(dir);

assert.ok(setsTierPrices.length >= 2,
  `only ${setsTierPrices.length} screen(s) call saveTierPrice — the derivation broke`);
assert.deepEqual(silent, [],
  'these screens let the owner type a member or reseller price at or above retail without a word, and '
  + 'the saving column goes blank rather than red — the buyer who signs in then pays MORE than one who '
  + `does not:\n  ${silent.join('\n  ')}`);

// And the rule itself, run rather than described: an unset price is never flagged (that is an empty
// field, not a mistake), a cheaper one is fine, equal and dearer are both wrong.
assert.equal(tierPriceIsNotBelowRetail(359000, 300000), false, 'a cheaper member price is the whole point');
assert.equal(tierPriceIsNotBelowRetail(359000, 359000), true, 'equal to retail is not a member price');
assert.equal(tierPriceIsNotBelowRetail(359000, 400000), true, 'dearer than retail is the case that hurts');
assert.equal(tierPriceIsNotBelowRetail(359000, ''), false, 'an empty field is not a mistake');
assert.equal(tierPriceIsNotBelowRetail(0, 100000), false, 'no retail price to compare against');

console.log('tierPricingStudio.selfcheck: ok');
