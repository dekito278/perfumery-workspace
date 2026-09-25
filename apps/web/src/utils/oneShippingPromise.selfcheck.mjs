// `node src/utils/oneShippingPromise.selfcheck.mjs`
//
// Three screens tell an overseas buyer what happens about shipping, and they have to tell them the same
// thing, because a buyer reads them in sequence: the home page's reason to buy direct, the product
// page's note under the price, and the checkout's notice above the country field.
//
// They drifted. The home page still said "Shipping is quoted by hand for your country, because that is
// the only honest way to do it" — written when every international order was arranged by hand, and left
// standing after three of the five zones had their freight folded into the price. A buyer in Singapore
// or the United States read, on the first screen of the shop, that they would have to wait for a figure
// that was already included, and that the fast path this project built was not for them.
//
// The rule is not the wording. It is that wherever the shop explains international shipping, it explains
// BOTH halves — included for the regions it is included for, worked out by hand for the rest — and that
// the regions named are the regions the code actually ships that way.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { MESSAGES } from '../i18n/messages.js';
import { SHIPPING_INCLUDED_REGIONS, destinationFor, shippingIncludedFor } from './internationalDestination.js';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const read = (...parts) => readFileSync(join(root, ...parts), 'utf8');

// --- 1. The premise, run: shipping really is included for some destinations and not others -------------
assert.equal(SHIPPING_INCLUDED_REGIONS.length, 3,
  'the promise below names three groups of destinations; if the code now ships them all the same way, '
  + 'the copy has to be rewritten rather than this guard relaxed');
assert.equal(shippingIncludedFor('SG'), true, 'Singapore is inside the price');
assert.equal(shippingIncludedFor('US'), true, 'so is the United States');
assert.equal(shippingIncludedFor('DE'), false, 'Germany is quoted by hand — that is the whole Europe path');
assert.equal(destinationFor('DE').shippingQuoted, true, 'and the order knows it');
assert.equal(destinationFor('SG').shippingQuoted, false, 'and knows when it does not');

// --- 2. Every sentence that explains it explains both halves -------------------------------------------
// Matched on meaning-bearing words rather than on the sentences themselves: the copy is Dekito's and may
// be rewritten freely, so long as a reader is told both what is covered and what follows by hand.
const INCLUDED = { id: /termasuk|sudah di ?harga/i, en: /includ(?:e|es|ed|ing)|in the price/i };
const QUOTED = { id: /hitung tangan|dikutip|kami kirim angkanya/i, en: /by hand|work(ed)? the freight|send you the figure/i };

for (const key of ['why.intl.body', 'intl.noticeCatalogPrice']) {
  for (const locale of ['id', 'en']) {
    const message = MESSAGES[locale][key];
    if (!message) continue;
    assert.match(message, INCLUDED[locale],
      `${locale}.${key} explains international shipping without saying it is ever included — a buyer in `
      + 'Singapore is told to wait for a figure that is already in the price they can see');
  }
}
// The home page's reason is the first thing an overseas reader meets, so it carries both halves itself.
for (const locale of ['id', 'en']) {
  assert.match(MESSAGES[locale]['why.intl.body'], QUOTED[locale],
    `${locale}.why.intl.body promises included shipping without the exception — Europe is quoted by hand `
    + 'and a buyer who finds that out at the checkout was told otherwise on the home page');
}

// --- 3. And the regions named are the regions the code ships that way -----------------------------------
// One of these is easy to get wrong by leaving a region out of a sentence after adding it to the list.
const NAMED = {
  en: [/southeast asia/i, /east asia/i, /america/i],
  id: [/asia tenggara/i, /asia timur/i, /amerika/i],
};
for (const locale of ['id', 'en']) {
  for (const pattern of NAMED[locale]) {
    assert.match(MESSAGES[locale]['intl.priceNote'], pattern,
      `${locale}.intl.priceNote no longer names every region whose shipping is inside the price`);
    assert.match(MESSAGES[locale]['why.intl.body'], pattern,
      `${locale}.why.intl.body and the product page disagree about which destinations include shipping`);
  }
}

// --- 4. The checkout says it too, on the screen where the country is chosen -----------------------------
// Checked in the component rather than the message file: this one is assembled from the destination rule
// at render time, so the question is whether the screen still asks that rule at all.
const fields = read('components', 'storefront', 'InternationalDeliveryFields.jsx');
assert.match(fields, /shippingIncluded|shippingQuoted/,
  'the checkout no longer tells the buyer which of the two applies to the country they just picked — it '
  + 'is the last screen before they commit, and the only one that knows their country');

console.log('oneShippingPromise selfcheck OK (home, product page and checkout tell an overseas buyer the '
  + 'same thing about shipping, and name the same destinations)');
