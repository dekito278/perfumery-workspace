// `node src/utils/internationalPriceMissing.selfcheck.mjs`
//
// A bottle with no international price has exactly one number attached to it: the Indonesian one. That
// number is wrong for a parcel to Berlin by a factor of three and a half, and api/orders/create.js will
// not write an order carrying it — it throws rather than fall back, which is the right call.
//
// The cart did fall back. It kept the line at the domestic price, so the buyer saw Rp 359.000, filled in
// the whole form, pressed the button, and got the endpoint's sanitised "Pesanan belum bisa dibuat. Coba
// lagi sebentar lagi" — a sentence that names nothing and invites them to try again at a wall.
//
// All 19 bottles have an overseas price today, so nothing is broken right now. The path opens the moment
// Dekito adds a twentieth, which is the same shape as every other defect in this repo: a rule taught to
// the half of the code that refuses, and not to the half that displays.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { internationalPriceFor } from './internationalDestination.js';
import { MESSAGES } from '../i18n/messages.js';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const read = (...parts) => readFileSync(join(root, ...parts), 'utf8');

// --- 1. The premise, run rather than read -------------------------------------------------------------
// 'world' has no formula: it is a price someone types in, and there is nothing to compute it from.
assert.equal(internationalPriceFor({ tierPrices: {}, linePrice: 359000, region: 'world' }), null,
  'a world-region line with no overseas price must come back with no price at all — a fallback here is '
  + 'the Indonesian number on a parcel to Berlin');
// Asia is different on purpose: it is retail x 2.2, so it always has an answer.
assert.ok(internationalPriceFor({ tierPrices: {}, linePrice: 359000, region: 'asia' }),
  'the Asia price is computed from retail and must never come back empty');

// --- 2. Nobody shows it ------------------------------------------------------------------------------
const cart = read('hooks', 'useCart.js');
const branch = cart.slice(cart.indexOf('if (!international)'), cart.indexOf('\n', cart.indexOf('if (!international)')));
assert.ok(branch, 'useCart no longer handles a line with no international price');
assert.doesNotMatch(branch, /return line;/,
  'returning the line untouched leaves the DOMESTIC price on screen for an international buyer, and the '
  + 'order that price belongs to cannot be written');
assert.match(branch, /unavailable: true/,
  'the line must reach checkout through the same blockedItems path as a sold-out bottle, or the form '
  + 'stays submittable');
assert.match(branch, /noInternationalPrice: true/,
  'and must carry WHY, because the reason decides which sentence the buyer reads');

// --- 3. Nobody charges it ----------------------------------------------------------------------------
const endpoint = readFileSync(join(root, '..', 'api', 'orders', 'create.js'), 'utf8');
assert.match(endpoint, /if \(!international\) \{\s*\n\s*throw new Error\(/,
  'the endpoint must refuse a line with no international price rather than charge the Indonesian one');

// --- 4. And the buyer is told the true reason --------------------------------------------------------
// "No longer available" is false: the bottle is on sale in Indonesia at that moment, and its own product
// page says so. A buyer sent away by that message goes looking for something that is sitting there.
for (const locale of ['id', 'en']) {
  const message = MESSAGES[locale]['cart.noInternationalPrice'];
  assert.ok(message, `cart.noInternationalPrice is missing in ${locale}`);
  assert.ok(message.includes('{names}'), `${locale} must name the bottles — a notice with no name is a dead end`);
  assert.notEqual(message, MESSAGES[locale]['cart.unavailable'],
    `${locale} must not reuse the sold-out sentence; the bottle is available, just not abroad`);
}
assert.notEqual(MESSAGES.id['cart.noInternationalPrice'], MESSAGES.en['cart.noInternationalPrice'],
  'each shop says it in its own language');

for (const page of [['pages', 'CartPage.jsx'], ['pages', 'mobile', 'MobileCartPage.jsx']]) {
  const source = read(...page);
  assert.match(source, /cart\.noInternationalPrice/,
    `${page.join('/')} must show the international reason, not only the sold-out one`);
  // The CONDITION as well as the names. A sabotage put `unavailableItems.length` back on the sold-out
  // notice and left the filtered names inside it: the notice then appeared for a purely international
  // block, with an empty list where the bottle's name should be. A notice naming nothing is the exact
  // failure this whole file exists to prevent, and it walked straight past the names-only check.
  assert.doesNotMatch(source, /\{unavailableItems\.length \?/,
    `${page.join('/')} shows the sold-out notice whenever anything is blocked — for an international-only `
    + 'block it then renders with no names in it');
  assert.equal((source.match(/unavailableItems\.filter\(\(item\) => !item\.noInternationalPrice\)/g) || []).length, 2,
    `${page.join('/')} must filter the sold-out notice in both its condition and its names`);
  assert.equal((source.match(/unavailableItems\.filter\(\(item\) => item\.noInternationalPrice\)/g) || []).length, 2,
    `${page.join('/')} must filter the international notice in both its condition and its names`);
}

console.log('internationalPriceMissing selfcheck OK (a bottle with no international price is blocked and '
  + 'says why, never shown at the Indonesian one)');
