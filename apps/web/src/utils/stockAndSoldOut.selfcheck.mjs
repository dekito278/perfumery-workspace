// `node src/utils/stockAndSoldOut.selfcheck.mjs`
//
// Second visitor audit, 13 Nov 2026 (Indonesian shop):
//   - a third Maskumambang, two in stock: the toast said "masuk ke keranjang" and the cart stayed at 2; "+"
//     went grey with no word why, and "−" at 1 looked live and did nothing;
//   - Sudra, sold out: a disabled button beside a free-vial offer, a shipping quote and a "US$95 to my
//     country?" WhatsApp draft, and no way to hear when it is back;
//   - on a phone the answer to a cart code landed under the sticky checkout bar.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { MESSAGES } from '../i18n/messages.js';

const src = join(dirname(fileURLToPath(import.meta.url)), '..');
const read = (...parts) => readFileSync(join(src, ...parts), 'utf8');

const cart = read('hooks', 'useCart.js');
assert.match(cart, /const added = Math\.max\(0, lineQuantity\(next\) - before\);\s*if \(added > 0\) window\.dispatchEvent/,
  'addItem returns what actually went in, and announces nothing when nothing did');
for (const page of ['PublicProductDetailPage.jsx', 'CatalogPage.jsx']) {
  assert.match(read('pages', page), /if \(added === 0\) \{\s*toast\.info\(t\('cart\.stockAllIn'/, `${page}: an add stopped by the stock says so instead of "masuk"`);
}
assert.match(read('pages', 'PublicProductDetailPage.jsx'), /maxStock: variantStock/, 'the cap is the chosen size\'s stock');
for (const page of ['CartPage.jsx', 'InternationalCartPage.jsx']) {
  const source = read('pages', page);
  assert.match(source, /disabled=\{(item|line)\.quantity <= 1\}/, `${page}: "−" is off at one`);
  assert.match(source, /atStockCap\((item|line)\) \? <span[^>]*>\{t\('cart\.stockLeft'/, `${page}: the cap is said`);
}

const pdp = read('pages', 'PublicProductDetailPage.jsx');
assert.match(pdp, /\{soldOut \? null : <FreeVialNote/, 'no gift offer beside a sold-out bottle');
assert.match(pdp, /\{soldOut \? \(\s*<AskAtelierButton labelKey="pdp\.restockAsk" draftKey="pdp\.restockDraft"/, 'a way to hear it is back instead of the overseas enquiry');
assert.match(pdp, /\{exportPrice && !soldOut \? \(\s*<InternationalShippingQuote/, 'and no shipping quote for it');
for (const language of ['id', 'en']) {
  assert.match(MESSAGES[language]['pdp.restockDraft'], /\{name\}/, `${language}: the restock message names the perfume`);
  assert.match(MESSAGES[language]['cart.stockLeft'], /\{count\}/);
}

assert.match(read('pages', 'CartPage.jsx'), /if \(voucher\.message\) codeMessageRef\.current\?\.scrollIntoView\?\.\(\{ block: 'center'/,
  'the answer to a code is brought out from under the sticky bar');

console.log('stockAndSoldOut selfcheck OK (an add the stock stops is said; a sold-out page offers a way back)');
