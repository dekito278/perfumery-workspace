// `node src/utils/bespokeSaysItBesideTheField.selfcheck.mjs`
//
// Tenth visitor audit, 13 Nov 2026, the bespoke checkout on a phone: "BUAT ORDER & UPLOAD BUKTI" with a
// field missing answered with a toast at the top of the screen — "Pilih layanan ongkir." — while focus
// stayed on the button and the shipping section was a screen away. And almost every buyer met that one,
// because "TAMPILKAN ONGKIR" listed the single rate without choosing it, unlike the cart checkout.
//
// The rule: a refusal names its field, is said beside it, and takes the buyer there; the rate is chosen
// for the buyer (the cheapest, which they can change) whenever the page prices the parcel.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const page = readFileSync(join(root, 'pages', 'BespokePage.jsx'), 'utf8');

// --- 1. Every refusal names a field ------------------------------------------------------------------------
const validate = page.slice(page.indexOf('const validateForm = () => {'), page.indexOf('return null;\n  };', page.indexOf('const validateForm = () => {')));
const keys = [...validate.matchAll(/return fail\('([a-z]+)'/g)].map((match) => match[1]);
assert.ok(keys.length >= 10, `only ${keys.length} refusals found — the scan is broken`);
assert.ok(!/return t\(/.test(validate), 'a refusal without a field went back to being a bare message');

// --- 2. Each field the checkout step shows has an id, a marker and its message ------------------------------
const ids = Object.fromEntries([...page.matchAll(/^\s{2}([a-z]+): '(bespoke-[a-z-]+)',$/gm)].map((match) => [match[1], match[2]]));
for (const key of ['name', 'contact', 'address', 'area', 'courier', 'service', 'preorder', 'voucher']) {
  assert.ok(keys.includes(key), `validateForm no longer refuses '${key}'`);
  assert.ok(ids[key], `BESPOKE_FIELD_IDS has no target for '${key}'`);
  assert.ok(page.includes(`id="${ids[key]}"`), `nothing on the page has id="${ids[key]}" for '${key}'`);
  assert.ok(page.includes(`{errorFor('${key}')}`), `the '${key}' refusal is never said on the page`);
  if (key !== 'service') assert.ok(page.includes(`aria-invalid={invalidFor('${key}')}`), `the '${key}' field is never marked invalid`);
}

// --- 3. The submit takes the buyer there, and toasts only what has no field here ----------------------------
const submit = page.slice(page.indexOf('const submitRequest = async (event) => {'));
assert.match(submit, /setSubmitError\(validationError\);/);
assert.match(submit, /field\.scrollIntoView\(\{ block: 'center' \}\);\s*field\.focus\(\{ preventScroll: true \}\);/);
assert.match(submit, /if \(!target\) \{\s*toast\.error\(validationError\.text\);/);
// A message leaves once its field is fixed.
assert.match(page, /const shownError = liveError && liveError\.key === submitError\?\.key \? liveError : null;/);

// --- 4. The rate is chosen when the page prices the parcel -------------------------------------------------
assert.match(page, /onClick=\{\(\) => autoCalculateShipping\(\{ autoSelectBest: true \}\)\}/, '"Tampilkan ongkir" lists rates without choosing one');
assert.match(page, /onClick=\{\(\) => loadShippingRates\(destination, \{ autoSelectCheapest: true \}\)\}/, 'picking an area lists rates without choosing one');

console.log(`bespokeSaysItBesideTheField selfcheck OK (${keys.length} refusals, each named; the checkout step's are said beside their field)`);
