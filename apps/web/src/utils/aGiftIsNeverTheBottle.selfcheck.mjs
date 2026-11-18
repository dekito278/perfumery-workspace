// `node src/utils/aGiftIsNeverTheBottle.selfcheck.mjs`
//
// Eleventh visitor audit, 15 Nov 2026:
//  B1 — pick the La rose vial, then add a bottle of La rose. The dropdown left La rose out (a sample of the
//       bottle being bought is no gift) and so read "— Belum dipilih —", while the cart, the checkout and the
//       WhatsApp order still carried the La rose vial. Now the picker releases it and says why.
//  B8 — picking in the add-to-cart sheet closed it with no word about the vial. Now a toast names it.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { freeVialChoices, giftScentIsBought } from './freeVial.js';
import { MESSAGES } from '../i18n/messages.js';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const read = (...parts) => readFileSync(join(root, ...parts), 'utf8');

const vial = { variants: [{ id: 'la-rose', size: 'La rose', stock: 3 }, { id: 'sudra', size: 'Sudra ꦱꦸꦢ꧀ꦫ', stock: 2 }] };
assert.equal(giftScentIsBought({ size: 'La rose' }, ['La rose']), true);
assert.equal(giftScentIsBought({ size: 'La rose' }, ['La Rose']), true, 'case does not make it another perfume');
assert.equal(giftScentIsBought({ size: 'Sudra ꦱꦸꦢ꧀ꦫ' }, ['Sudra']), true, 'the aksara half is not part of the match');
assert.equal(giftScentIsBought({ size: 'La rose' }, ['Sudra']), false);
assert.equal(giftScentIsBought(null, ['La rose']), false);
// The same rule as the list: whatever the list leaves out, a held gift is released for.
for (const bought of [['La rose'], ['Sudra'], []]) {
  for (const variant of vial.variants) {
    const offered = freeVialChoices(vial, bought).some((c) => c.variantId === variant.id);
    assert.equal(giftScentIsBought({ size: variant.size }, bought), !offered, `${variant.size} / ${bought}`);
  }
}

const picker = read('components', 'storefront', 'FreeVialPicker.jsx');
assert.match(picker, /giftScentIsBought\(gift, bought\)/);
// One per bottle since 18 Nov 2026: the stale vial is released by writing back the set without it.
assert.match(picker, /onPick\(kept\)/, 'the stale gift must be released, not just hidden');
assert.match(picker, /t\('cart\.giftReleased'/, 'and the buyer is told why');
assert.match(read('pages', 'CheckoutPage.jsx'), /&& !chosenGifts\.some\(\(gift\) => giftScentIsBought\(gift, boughtNames\(items\)\)\);/,
  'checkout hides the picker once every earned vial is chosen — except a gift that has to be released');
assert.match(read('pages', 'CheckoutPage.jsx'), /\{giftsSettled \? null : <FreeVialPicker/);

assert.match(read('components', 'storefront', 'FreeVialPrompt.jsx'), /toast\.success\(t\('cart\.giftAdded', \{ name: item\.size \}\)\)/);
for (const lang of ['id', 'en']) {
  for (const key of ['cart.giftReleased', 'cart.giftAdded']) assert.match(MESSAGES[lang][key], /\{name\}/, `${lang} ${key}`);
}
console.log('aGiftIsNeverTheBottle selfcheck OK (a bought scent releases its vial, and a pick says so)');
