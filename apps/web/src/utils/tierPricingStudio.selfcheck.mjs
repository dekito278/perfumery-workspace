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
import { readFileSync } from 'node:fs';
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

// --- one size, one row -------------------------------------------------------------------------------
// The '' row is the default for sizes left blank. With a single size it and the size row are the same
// bottle, so drawing both asked the same question twice — and the owner filled one and left the other
// empty, which looks like a half-finished form. Every live product has exactly one variant today.
assert.match(tierEditor, /if \(sizes\.length <= 1\)/, 'a single-size product must not be shown two rows');
assert.match(tierEditor, /return \[\{ id: '', label: sizes\[0\]\?\.label/,
  "the one row must stay the '' row, or a price already saved there would vanish from the form while "
  + 'still being applied to orders');
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

console.log('tierPricingStudio.selfcheck: ok');
