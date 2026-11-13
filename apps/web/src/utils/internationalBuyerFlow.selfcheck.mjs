// `node src/utils/internationalBuyerFlow.selfcheck.mjs`
//
// Second visitor audit of /en, 13 Nov 2026 — what a buyer abroad met between the product page and "Place
// order", and what now holds:
//   1. "3 bottles" chosen beside the price, total US$395 shown, and the button added ONE.
//   2. Before a country was picked the cart said both "place the order right here" and "we confirm on
//      WhatsApp… nothing is reserved".
//   3. The order form accepted "call me maybe", "jane@example" and an 800-character address, which only the
//      server refused after "Place order"; a reload lost everything typed.
//   4. The free-vial sheet was a modal a keyboard could not use.
//   5. Story teasers in Indonesian on /en with no word why.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { MESSAGES } from '../i18n/messages.js';

const src = join(dirname(fileURLToPath(import.meta.url)), '..');
const read = (...parts) => readFileSync(join(src, ...parts), 'utf8');

// --- 1 ----------------------------------------------------------------------------------------------------
const pdp = read('pages', 'PublicProductDetailPage.jsx');
assert.match(pdp, /const \{ bottles: chosenBottles \} = useShippingDestination\(\);\s*const addCount = isInternational \? Math\.max\(1, Math\.round\(Number\(chosenBottles\) \|\| 1\)\) : 1;/,
  'the English shop adds the bottle count chosen in its quote block; the Indonesian shop adds one');
assert.match(pdp, /priceNumber: selectedPrice,\s*\}, addCount\);/, 'and that count is what goes in the cart');
assert.match(pdp, /addCount > 1 && exportPrice\s*\? t\('pdp\.addManyToCartWithPrice', \{ count: addCount, price: `US\$\$\{usdPriceFor\(exportPrice\) \* addCount\}` \}\)/,
  'the button says how many and what they cost');
for (const language of ['id', 'en']) assert.match(MESSAGES[language]['pdp.addManyToCartWithPrice'], /\{count\}[\s\S]*\{price\}/);

// --- 2 ----------------------------------------------------------------------------------------------------
assert.match(read('pages', 'InternationalCartPage.jsx'), /\{!canPlaceHere && !needsDestination \? <p[^>]*>\{t\('cart\.intl\.howItWorks'\)\}/,
  'the WhatsApp path is described only once a country is chosen and the cart cannot take the order');

// --- 3 ----------------------------------------------------------------------------------------------------
const form = read('components', 'storefront', 'InternationalOrderForm.jsx');
const endpoint = readFileSync(join(src, '..', 'api', 'orders', 'create.js'), 'utf8');
const serverLimits = Object.fromEntries([...endpoint.match(/const INTERNATIONAL_FIELDS = \[([^\n]*)\];/)[1].matchAll(/\['(\w+)', (\d+)\]/g)].map((m) => [m[1], Number(m[2])]));
assert.ok(Object.keys(serverLimits).length >= 7, 'the endpoint field limits must be readable');
for (const [key, limit] of Object.entries(serverLimits)) {
  assert.match(form, new RegExp(`key: '${key}'[^\\n]*maxLength: ${limit}\\b`), `${key}: the form stops at the endpoint's ${limit} characters`);
}
// Browsers compile pattern="" with the v flag; a pattern invalid there is silently ignored. Run them so.
const pattern = (key) => {
  const raw = form.match(new RegExp(`key: '${key}'[^\\n]*pattern: '([^']+)'`))?.[1];
  assert.ok(raw, `${key} has a pattern`);
  return new RegExp(`^(?:${raw.replace(/\\\\/g, '\\')})$`, 'v');
};
const phone = pattern('phone');
for (const ok of ['+65 9123 4567', '+1 (212) 555-0100', '+49 30/1234567', '081234567890']) assert.ok(phone.test(ok), `phone accepts ${ok}`);
for (const bad of ['call me maybe', '12', '']) assert.ok(!phone.test(bad), `phone refuses ${JSON.stringify(bad)}`);
const email = pattern('email');
assert.ok(email.test('jane@example.com'));
assert.ok(!email.test('jane@example'), 'an email without a domain dot is refused here, as the endpoint would');
assert.match(form, /const \[buyer, setBuyer\] = useState\(readDraft\);\s*useEffect\(\(\) => \{ writeDraft\(buyer\); \}, \[buyer\]\);/, 'what was typed survives a reload');
assert.match(form, /clearCart\(\);\s*clearDraft\(\);/, 'and is forgotten once the order is placed');
for (const language of ['id', 'en']) {
  assert.ok(MESSAGES[language]['cart.intl.formLatin'], `${language}: the Latin-letters note exists`);
  assert.match(MESSAGES[language]['cart.intl.formPhoneHint'], /\+\d/, `${language}: the phone hint shows a country code`);
}

// --- 4 ----------------------------------------------------------------------------------------------------
const prompt = read('components', 'storefront', 'FreeVialPrompt.jsx');
assert.match(prompt, /if \(event\.key === 'Escape'\) \{ event\.preventDefault\(\); dismiss\(\); return; \}/, 'Escape declines the gift sheet');
assert.match(prompt, /\(focusables\(\)\[1\] \|\| focusables\(\)\[0\]\)\?\.focus\(\);/, 'focus moves into the sheet');
assert.match(prompt, /if \(before && typeof before\.focus === 'function'\) before\.focus\(\);/, 'and returns where it came from');

// --- 5 ----------------------------------------------------------------------------------------------------
assert.match(read('components', 'storefront', 'ProductStoryLink.jsx'), /\{isInternational \? <span className="text-sm text-ng-ash">\{t\('journal\.articleIndonesian'\)\}<\/span> : null\}/,
  'a story teaser on /en says it is written in Indonesian');

console.log('internationalBuyerFlow selfcheck OK (bottle count reaches the cart; the form checks what the server checks)');
