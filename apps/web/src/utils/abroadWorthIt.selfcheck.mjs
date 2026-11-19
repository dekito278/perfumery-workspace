// `node src/utils/abroadWorthIt.selfcheck.mjs`
//
// Foreign-buyer audit, 18 Nov 2026 — what made the English shop feel "not worth it", and the four things
// done about it without touching a price:
//   A. one bottle to Europe paid more shipping (US$85) than perfume (US$80), while a second bottle shares
//      the same 1 kg DHL box and ships cheaper — said only on the Help page. Now said under the total.
//   B. paying a stranger abroad by transfer feels risky: the total now says nothing is charged on the site.
//   C. the English home showed three Indonesian journal notes.
//   D. the English home opened on the US$160 bottle; it now leads with what can be bought, gentlest first.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { orderForAbroad } from './curatedProducts.js';
import { quoteInternationalShippingPrice } from './internationalShippingPrice.js';
import { MESSAGES } from '../i18n/messages.js';

const src = join(dirname(fileURLToPath(import.meta.url)), '..');
const read = (...parts) => readFileSync(join(src, ...parts), 'utf8');

// A. The fact the line rests on: with the shipped policy, two bottles never cost more to ship than one.
for (const country of ['SG', 'US', 'GB', 'DE', 'AU', 'AE']) {
  const one = quoteInternationalShippingPrice({ countryCode: country, bottles: 1 }).usd;
  const two = quoteInternationalShippingPrice({ countryCode: country, bottles: 2 }).usd;
  assert.ok(two <= one, `${country}: a second bottle would make shipping dearer (${one} → ${two}), and the line would lie`);
}
const hook = read('hooks', 'useInternationalQuote.js');
// (Counted as a parcel since 18 Nov 2026, so discovery sets riding along are included.)
assert.match(hook, /quoteInternationalShippingPrice\(\{ countryCode: country, bottles: Math\.max\(1, parcelBottlesFor\(bottles \+ 1, sets\)\), policy \}\)/);
assert.match(hook, /nextShippingUsd: nextShippingUsd !== null && nextShippingUsd <= shippingUsd \? nextShippingUsd : null/,
  'only ever said when one more bottle makes shipping cheaper or free — never when it costs more');
const quote = read('components', 'storefront', 'InternationalShippingQuote.jsx');
assert.match(quote, /t\('intlQuote\.nextCheaper', \{ from: shippingUsd, to: nextShippingUsd \}\)/);
assert.match(quote, /t\('intlQuote\.nextSame'\)/);
// B.
assert.match(quote, /\{totalUsd \? \(\s*<p[^>]*>\{t\('intlQuote\.payAfter'\)\}/);
for (const lang of ['id', 'en']) {
  for (const key of ['intlQuote.nextCheaper', 'intlQuote.nextSame', 'intlQuote.payAfter']) assert.ok(MESSAGES[lang][key], `${lang}.${key}`);
  assert.doesNotMatch(MESSAGES[lang]['intlQuote.payAfter'], /PayPal|card|kartu/i, 'no payment method we do not take');
}
// C.
const home = read('pages', 'HomePage.jsx');
assert.match(home, /\{publishedArticles\.length && !isInternational \? \(/, 'the Indonesian notes stay off the English home');
// D.
const p = (slug, price, stock) => ({ slug, price, variants: [{ stock }] });
const ordered = orderForAbroad([p('maskumambang', 160, 2), p('samhain', 80, 0), p('hug', 80, 10), p('animal', 80, 5), p('unpriced', 0, 3)], (x) => x.price);
assert.deepEqual(ordered.map((x) => x.slug), ['hug', 'animal', 'maskumambang', 'unpriced', 'samhain'],
  'in stock first, gentlest price first, ties in Dekito\'s order, unpriced after priced, sold out last');
assert.match(home, /if \(!isInternational\) return curated;/, 'the Indonesian home keeps Dekito\'s order exactly');
console.log('abroadWorthIt selfcheck OK (second-bottle line, pay-after line, no Indonesian notes on /en, gentlest first)');
