// `node src/utils/manualAreaLabel.selfcheck.mjs`
//
// On the phone checkout, when the courier rates have not come back, the way forward was a link reading
//
//     "Edit ongkir manual"   /   "Edit the shipping fee by hand"
//
// It opens the DESTINATION AREA search. There is no field for a fee anywhere behind it, and there never
// was: the shipping cost comes from the courier API once the area is known. A buyer whose rates failed
// taps a button that promises to let them type an amount and gets a search box for their sub-district.
//
// The rule: a control is named for what it opens. Anything that opens the area search says "area", and
// nothing that opens it may promise editing a price.
process.env.TZ = 'Asia/Jakarta';

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { MESSAGES } from '../i18n/messages.js';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const stripComments = (source) => source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '').replace(/\{\/\*[\s\S]*?\*\/\}/g, '');
const read = (...parts) => stripComments(readFileSync(join(root, ...parts), 'utf8'));

const page = read('pages', 'mobile', 'MobileCheckoutPage.jsx');

// --- 1. Find the controls by what they DO, not by name -------------------------------------------------
// Every element whose click opens the manual area search, and the message key it is labelled with.
const openers = [...page.matchAll(/onClick=\{\(\) => setShowManualShippingArea\(true\)\}[\s\S]{0,320}?t\('([\w.]+)'\)/g)]
  .map((match) => match[1]);
assert.ok(openers.length >= 2, `expected both controls that open the area search, found ${openers.length}`);

const PROMISES_A_PRICE = /(ongkir|biaya|tarif|harga|fee|price|cost)/i;
const NAMES_THE_AREA = /(area|tujuan|destination|kecamatan|sub-?district)/i;

for (const key of openers) {
  for (const language of ['id', 'en']) {
    const label = MESSAGES[language][key];
    assert.ok(label, `${language}.${key} is missing`);
    assert.doesNotMatch(label, PROMISES_A_PRICE,
      `${language}.${key} = "${label}" promises a price field; what opens is the area search`);
    assert.match(label, NAMES_THE_AREA,
      `${language}.${key} = "${label}" does not say what it opens`);
  }
}

// --- 2. And there is still no fee field behind it ------------------------------------------------------
// If a manual fee input is ever added, this check should fail and be rewritten deliberately — the label
// rule above would no longer be the honest one.
assert.match(page, /placeholder=\{t\('checkout\.destinationPlaceholder'\)\}/,
  'the panel behind these controls must still be the destination search');
assert.doesNotMatch(page, /showManualShippingArea[\s\S]{0,400}?shippingFeeInput|manualShippingFee/,
  'a manual fee field would make these labels honest again — and this rule wrong');

// --- 3. The hint under the panel keeps explaining the real purpose --------------------------------------
for (const language of ['id', 'en']) {
  assert.match(MESSAGES[language]['mcheckout.manualAreaHint'], NAMES_THE_AREA,
    `${language} hint must keep pointing at the area, not at a price`);
}

console.log('manualAreaLabel selfcheck OK (the control is named for the search it opens, not for a fee it never edits)');
