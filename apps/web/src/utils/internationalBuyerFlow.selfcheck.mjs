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
assert.match(pdp, /priceNumber: selectedPrice,[\s\S]{0,260}\}, addCount\);/, 'and that count is what goes in the cart');
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

// --- 6. Postcode where the country uses one; the country's own words (third audit, 13 Nov 2026) ---------------
{
  const address = await import('./internationalAddress.js');
  for (const code of ['US', 'CA', 'DE', 'GB', 'SG', 'AU', 'JP']) assert.ok(address.postcodeRequiredFor(code), `${code}: a postcode is required`);
  for (const code of ['HK', 'AE', 'QA', 'MO']) assert.ok(!address.postcodeRequiredFor(code), `${code}: no postcode in use, none demanded`);
  assert.equal(address.missingInternationalField({ name: 'a', email: 'a@b.co', phone: '+1 212', address: 'x', city: 'y', region: 'NY' }, 'US'), 'postcode',
    'the endpoint refuses a US address without its ZIP, by the same rule');
  assert.equal(address.missingInternationalField({ name: 'a', email: 'a@b.co', phone: '+852 9', address: 'x', city: 'y' }, 'HK'), '');
  assert.match(address.phoneExampleFor('US'), /^\+1 /, 'a US buyer sees a US phone example, not a Singapore one');
  assert.match(form, /key: 'postcode'[^\n]*requiredFor: postcodeRequiredFor/, 'the form asks the same rule');
  assert.match(form, /field\.labelFor \? field\.labelFor\(quote\.country\) : field\.label/, 'and labels the lines in the country\'s words');
  for (const language of ['id', 'en']) for (const key of ['cart.intl.formState', 'cart.intl.formProvince', 'cart.intl.formZip', 'cart.intl.formPostcodeRequired']) {
    assert.ok(MESSAGES[language][key], `${language}.${key}`);
  }
}

// Fifth visitor audit, 13 Nov 2026: the address form relied on the browser's own bubbles ("Please match the
// requested format.", in the browser's language), and "ABCDE" passed as a US ZIP.
{
  const form = readFileSync(new URL('../components/storefront/InternationalOrderForm.jsx', import.meta.url), 'utf8');
  assert.match(form, /onSubmit=\{submit\} aria-labelledby="intl-order-form" noValidate>/, 'the page, not the browser, says what is wrong');
  assert.match(form, /aria-invalid=\{fieldErrors\[field\.key\] \? 'true' : undefined\}/);
  assert.match(form, /form\.elements\.namedItem\(firstBad\.key\)\?\.focus\(\);\s*return;/, 'and takes the buyer to the first field to fix');
  for (const language of ['id', 'en']) {
    for (const key of ['cart.intl.errRequired', 'cart.intl.errEmail', 'cart.intl.errPhone', 'cart.intl.errPostcode']) {
      assert.ok(MESSAGES[language][key], `${language}: ${key}`);
    }
  }
  const { postcodePatternFor } = await import('./internationalAddress.js');
  const zip = new RegExp(`^(?:${postcodePatternFor('US')})$`, 'v');
  assert.ok(zip.test('94105') && zip.test('94105-1234') && !zip.test('ABCDE'), 'a US ZIP is five digits');
  assert.equal(postcodePatternFor('ZZ'), undefined, 'an unlisted country is checked for presence only');
}
// The error sits beside the field, not inside its label (eighth audit, 13 Nov 2026: read twice).
{
  const form = readFileSync(new URL('../components/storefront/InternationalOrderForm.jsx', import.meta.url), 'utf8');
  assert.match(form, /<label htmlFor=\{`intl-\$\{field\.key\}`\} className="ng-mono text-ng-dust">/, 'the label holds only the label');
  assert.match(form, /id=\{`intl-\$\{field\.key\}`\}/);
}
console.log('internationalBuyerFlow selfcheck OK (bottle count reaches the cart; the form checks what the server checks)');
