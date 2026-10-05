// `node src/utils/priceFollowsTheDestination.selfcheck.mjs`
//
// Dekito asked, 2026-10-05, whether the gap between the Indonesian price and the international one is
// defensible. It is — US$76 for a 30 ml artisan bottle is unremarkable in the markets it is sold into,
// and the tier is a flat 3,51x across all nineteen bottles, which makes it a rule rather than a judgement
// about each buyer. What was NOT defensible was the mechanism and the omission:
//
//   the MECHANISM — the price followed `detectShippingRegion()`, the browser's clock and language list.
//     That is a guess about WHO IS READING. Two readers in the same city could be charged differently for
//     the same parcel because one of them had an English browser.
//   the OMISSION — the buyer saw US$80 with no shipping at all, and learned about US$140 in a WhatsApp
//     reply, after they had already decided. A total that nearly triples after the fact is the same
//     bait-and-switch the English shop's missing cart was built to remove, pointing the other way.
//
// His decisions: 5 Oct — price by DESTINATION, show the whole total, say why the gap exists. 6 Oct — ONE
// bottle price everywhere (the 2.2x Southeast Asia split retired), and shipping derived from the
// carrier's sheet less a fixed support, so the neighbours still pay the least in total by paying the
// least to ship to. This chain holds all of it by RUNNING the real code rather than by reading it.
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

import { USD_PRICE_RATE, USD_PRICE_STEP, usdPriceFor } from './usdPrice.js';
import { MESSAGES } from '../i18n/messages.js';

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, '..');
// Comments first, every time. A text check that forgets this fails on the sentence explaining why the
// old promise was removed, quoted in the file that removed it.
const stripComments = (source) => source
  .replace(/\{\/\*[\s\S]*?\*\/\}/g, '').replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
const readRaw = (...parts) => readFileSync(join(root, ...parts), 'utf8');
const read = (...parts) => stripComments(readRaw(...parts));
const asJs = (value) => JSON.stringify(value);

/**
 * Strip a browser module's `@/` imports and RUN it with its collaborators injected. Import blocks span
 * several lines, so they are dropped by RANGE — a filter on lines starting with `import` leaves the
 * closing brace of a multi-line block behind and the lift fails to parse.
 */
const withoutImports = (source) => source.replace(/^import[\s\S]*?from '[^']+';$/gm, '');
const inline = (...parts) => withoutImports(readRaw(...parts)).replace(/^export /gm, '');
const run = (source) => import(`data:text/javascript;base64,${Buffer.from(source, 'utf8').toString('base64')}`);

// The REAL carrier sheets, the REAL rule, in one module.
const rates = await run(`
${inline('data', 'exportZones.js')}
${inline('data', 'exportRates.js')}
${inline('data', 'internationalShippingRates.js')}
${inline('utils', 'internationalShippingPrice.js')}
export { quoteInternationalShippingPrice, SHIPPING_RATE_REGIONS, SHIPPING_RATE_MAX_BOTTLES, EXPORT_ZONE_BY_COUNTRY };
`);
const { quoteInternationalShippingPrice, SHIPPING_RATE_REGIONS, SHIPPING_RATE_MAX_BOTTLES, EXPORT_ZONE_BY_COUNTRY } = rates;

// --- 1. THE SPLIT IS GONE, AND ITS ABSENCE IS THE RULE ----------------------------------------------
// From 19 Sep to 6 Oct 2026 the neighbours paid 2.2x retail and everyone else the hand-set price, decided
// first by the browser's clock and then by the picked destination. Dekito retired it: with the carrier's
// cost beside the numbers, the lower bottle price left almost nothing above Indonesian retail once the
// parcel was paid for, and the thing it was for — a total that does not frighten Kuala Lumpur — is done
// by the shipping line now. So the module must not export the split, and the price must not read a
// region even if one is passed: a caller still handing in `region: 'asia'` must get the same price.
const regionModule = await run(withoutImports(readRaw('utils', 'shippingRegion.js')));
for (const retired of ['ASIA_MULTIPLIER', 'ASIA_TIME_ZONES', 'shippingRegionForTimeZone', 'shippingRegionForCountry',
  'isAsiaCountry', 'detectShippingRegion', 'readShippingRegionFromUrl']) {
  assert.equal(regionModule[retired], undefined,
    `${retired} is back — the Asia split was retired on 2026-10-06 and a helper that lingers gets called again`);
}
const { internationalPriceFor } = regionModule;
const line = { tierPrices: { overseas: 1260000 }, linePrice: 359000 };
assert.equal(internationalPriceFor(line), 1260000, 'the international price is the one Dekito set by hand');
assert.equal(internationalPriceFor({ ...line, region: 'asia' }), 1260000,
  'and a region, if anyone still passes one, changes nothing — one bottle price everywhere');
assert.equal(internationalPriceFor({ tierPrices: {}, linePrice: 359000 }), null, 'no export price set is null, not a guess');
assert.equal(internationalPriceFor({ tierPrices: { overseas: 300000 }, linePrice: 359000 }), null,
  'an "export price" below retail is a data-entry slip, not a discount');
// The hooks must not resolve a region either — there is nothing left to resolve.
assert.ok(!readRaw('hooks', 'useOverseasPrice.js').includes('useShippingRegion'),
  'useOverseasPrice still asks which region the reader is in');
assert.doesNotMatch(read('components', 'storefront', 'InternationalPrice.jsx'), /priceNoteAsia/,
  'the headline still has a Southeast Asia sentence to choose');
assert.equal(MESSAGES.en['intl.priceNoteAsia'], undefined, 'and the Southeast Asia sentence itself is gone from the catalogue');
console.log('  the Asia split is retired: no exported helper, no region in the price, no sentence for it');

// --- 2. EVERY COUNTRY THE PICKER OFFERS CAN ACTUALLY BE QUOTED --------------------------------------
// A picker that lists a country and then answers "on request" for it is a form that wastes the one
// question it asked. Every listed country, at every bottle count the picker offers, must come back with
// a number — run through the REAL quote function, not a description of it.
const destination = await run(`
const SHIPPING_RATE_REGIONS = ${asJs(SHIPPING_RATE_REGIONS)};
${inline('utils', 'shippingDestination.js').replace(/^const SHIPPING_RATE_REGIONS[^\n]*\n/m, '')}
export { destinationOptions, DESTINATION_OTHER, isValidDestination, CARD_COUNTRIES };
`);
const { destinationOptions, DESTINATION_OTHER, isValidDestination, CARD_COUNTRIES } = destination;

const offered = destinationOptions('en').flatMap((group) => group.countries.map((item) => item.code));
assert.ok(offered.length >= 200,
  `the picker offers ${offered.length} destinations — the carrier sheet names ${Object.keys(EXPORT_ZONE_BY_COUNTRY).length}, and the picker used to offer 57`);
for (const code of offered) assert.ok(CARD_COUNTRIES.includes(code), `${code} is offered but is not on the carrier sheet`);
// Only NAMED destinations: the sheet carries a few non-ISO codes (Bonaire XB, Kosovo KV) that no browser
// can put a word to, and "XB" in a dropdown between Bolivia and Brazil looks broken to everyone else.
const names = new Intl.DisplayNames(['en'], { type: 'region' });
for (const code of offered) {
  let name = code;
  try { name = names.of(code) || code; } catch { /* unnamed */ }
  assert.notEqual(name, code, `${code} is offered with no name — the picker must leave such codes to "another country"`);
}
let quoted = 0;
for (const code of offered) {
  for (let bottles = 1; bottles <= SHIPPING_RATE_MAX_BOTTLES; bottles += 1) {
    const quote = quoteInternationalShippingPrice({ countryCode: code, bottles });
    assert.ok(quote?.usd > 0, `the picker offers ${code} but the rule cannot quote ${bottles} bottle(s) to it`);
    quoted += 1;
  }
}
console.log(`  ${offered.length} destinations x ${SHIPPING_RATE_MAX_BOTTLES} bottle counts = ${quoted} quotes, none on request`);

// "Somewhere else" is a real choice and must behave like one.
assert.ok(isValidDestination(DESTINATION_OTHER), 'the picker must accept "another country" as a choice');
assert.equal(quoteInternationalShippingPrice({ countryCode: DESTINATION_OTHER, bottles: 1 })?.usd, null,
  '"another country" must be quoted on request, never at a listed zone\'s price');

// --- 3. THE TOTAL IS THE SUM OF THE LINES THE BUYER WAS SHOWN --------------------------------------
// Three numbers on screen and a fourth in the WhatsApp draft. They have drifted before (#362, and the
// Studio summary that said Rp 180.000 while the order billed Rp 2.227.500). So the arithmetic is RUN.
globalThis.__fx = { country: '', bottles: 1 };
globalThis.__quote = quoteInternationalShippingPrice;
const quoteHook = await run(`
const useShippingDestination = () => ({
  country: globalThis.__fx.country, bottles: globalThis.__fx.bottles, setCountry() {}, setBottles() {},
});
const MESSAGES_EN = ${asJs(MESSAGES.en)};
const useTranslate = () => ({
  t: (key, vars) => String(MESSAGES_EN[key] ?? key).replace(/\\{(\\w+)\\}/g, (whole, name) => (
    vars && Object.prototype.hasOwnProperty.call(vars, name) ? String(vars[name]) : whole)),
  region: 'en',
});
const USD_PRICE_RATE = ${asJs(USD_PRICE_RATE)};
const USD_PRICE_STEP = ${asJs(USD_PRICE_STEP)};
const usdPriceFor = ${usdPriceFor.toString()};
const countryNameFor = (code) => String(code || '');
const quoteInternationalShippingPrice = (...args) => globalThis.__quote(...args);
const DESTINATION_OTHER = ${asJs(DESTINATION_OTHER)};
const SHIPPING_RATE_BOTTLE_SIZE_ML = 30;
${withoutImports(readRaw('hooks', 'useInternationalQuote.js'))}
`);
const { useInternationalQuote } = quoteHook;
const ask = ({ country = '', bottles = 1, price = 1260000, size = '30 ml' }) => {
  globalThis.__fx = { country, bottles };
  return useInternationalQuote({ price, product: { size }, variant: { size } });
};

// Jason Voorhees, measured in production 2026-10-05: retail Rp 359.000, export Rp 1.260.000 -> US$80.
{
  const europe = ask({ country: 'DE', bottles: 1 });
  assert.equal(europe.goodsUsd, 80, 'the bottle price must be the published export price in dollars');
  assert.equal(europe.shippingUsd, 85, 'and the shipping must be the carrier cost for Germany less the support');
  assert.equal(europe.shippingCostUsd, 115, 'with the cost itself available for the caption');
  assert.equal(europe.shippingSupportUsd, 30, 'and the support — the sentence "we cover US$30"');
  assert.equal(europe.totalUsd, 165, 'the total must be the sum of the two lines above it');
  assert.equal(europe.onRequest, null, 'a settled total must not also claim to be on request');
  // Dekito's ask, 2026-10-06: the buyer arrives on WhatsApp already knowing when it lands. The estimate
  // is a table per zone and a promise, so it must be present, in working days, and WIDER for zone 8
  // than for the neighbours — an estimate that does not grow with distance is a number, not an estimate.
  assert.deepEqual(europe.transitDays, [4, 7], 'Germany (zone 7) ships in the Europe range');
  assert.match(europe.eta, /^4–7/, 'and the worded estimate starts with that range');
  assert.equal(europe.draft.vars.eta, europe.eta, 'the draft carries the same estimate the page shows');
  const near = ask({ country: 'SG', bottles: 1 }); const far = ask({ country: 'BR', bottles: 1 });
  assert.ok(near.transitDays[1] < far.transitDays[0], 'Singapore must arrive before Brazil even on its slowest day');
}
// The same bottle, the neighbours: the SAME bottle price and a cheaper freight line. Since 2026-10-06 that
// is how Kuala Lumpur pays less than Berlin — through the parcel, not the bottle.
{
  const asia = ask({ country: 'MY', bottles: 1 });
  const europe = ask({ country: 'DE', bottles: 1 });
  assert.equal(asia.goodsUsd, europe.goodsUsd, 'one bottle price everywhere — the 2.2x split is retired');
  assert.ok(asia.shippingUsd < europe.shippingUsd, 'the neighbours pay less to ship to');
  assert.ok(asia.totalUsd < europe.totalUsd, 'and so the neighbours still pay less in total');
}
// Two bottles ride on one shipment, and the second bottle carries more of the freight — Dekito's own
// numbers: US$65 for one to the United States, US$45 for two.
{
  const one = ask({ country: 'US', bottles: 1 });
  const two = ask({ country: 'US', bottles: 2 });
  assert.equal(one.shippingCostUsd, two.shippingCostUsd, 'one and two bottles are the same one-kilo parcel');
  assert.equal(one.shippingUsd, 65, 'his number for one bottle');
  assert.equal(two.shippingUsd, 45, 'his number for two');
  assert.equal(two.goodsUsd, one.goodsUsd * 2, 'while the bottles themselves multiply');
  assert.equal(two.totalUsd, two.goodsUsd + two.shippingUsd, 'and the total must still be the sum');
}
// Past the rule, each limit named SEPARATELY.
{
  const unanswered = ask({ country: '', bottles: 1 });
  assert.equal(unanswered.onRequest, 'country', 'an unanswered picker is a question, not a dead end');
  assert.equal(unanswered.totalUsd, null, 'and it must not print a total it cannot know');
  assert.equal(ask({ country: DESTINATION_OTHER, bottles: 1 }).onRequest, 'destination',
    'a destination the sheet does not name must say so, not blame the bottle count');
  assert.equal(ask({ country: 'DE', bottles: SHIPPING_RATE_MAX_BOTTLES + 1 }).onRequest, 'bottles',
    'past the last bracket the reason is the quantity');
  // THE SIZE THE RULE WAS WRITTEN FOR. Every bottle in the shop is 30 ml today, which is why this rule
  // would otherwise be invisible: a 50 ml added next month would be quoted 30 ml freight as a published
  // promise rather than a figure Dekito reads with both tables in front of him.
  assert.equal(ask({ country: 'DE', bottles: 1, size: '50 ml' }).onRequest, 'size',
    'a bottle the rule was not written for must be quoted on request, not at the 30 ml rate');
  assert.equal(ask({ country: 'DE', bottles: 1, size: '50 ml' }).shippingUsd, null, 'and must carry no freight figure at all');
  // The ORDER of the reasons: with no country AND an off-card size, the useful answer is the size,
  // because picking a country cannot fix a bottle the rule was never written for.
  assert.equal(ask({ country: '', bottles: 1, size: '50 ml' }).onRequest, 'size',
    'with no country AND an off-card size, the reason must be the one the buyer cannot resolve themselves');
}

// --- 4. THE DRAFT CARRIES THE NUMBER THE BUYER WAS SHOWN ------------------------------------------
{
  const settled = ask({ country: 'DE', bottles: 2 });
  assert.equal(settled.draft?.key, 'export.waDraftQuote', 'a settled total must travel as the quote line');
  assert.equal(settled.draft.vars.total, `US$${settled.totalUsd}`, 'and the total in the message must be the total on the screen');
  assert.equal(settled.draft.vars.shipping, `US$${settled.shippingUsd}`);
  assert.equal(settled.draft.vars.goods, `US$${settled.goodsUsd}`);
  assert.equal(ask({ country: 'DE', bottles: 7 }).draft?.key, 'export.waDraftDestination',
    'a known destination with no rate must still name the destination — that is half the question answered');
  assert.equal(ask({ country: '', bottles: 1 }).draft, null,
    'and with nothing chosen there is no quote to send, so the caller\'s own price line stands');
  assert.equal(ask({ country: '', bottles: 1 }).eta, '', 'and no arrival estimate either — there is no parcel to estimate');
  assert.equal(ask({ country: DESTINATION_OTHER, bottles: 1 }).eta, '', 'nor for a destination the sheet does not name');
}

// --- 5. EVERY SURFACE THAT BUILDS THE DRAFT CARRIES THE TOTAL -------------------------------------
// DERIVED by walking the tree. A first version of this block said "derived" in its comment and listed
// five files, and a sabotage adding a sixth surface walked straight past it — #362 happening a second
// time inside the guard built to stop #362.
{
  const walk = (dir) => readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) return walk(full);
    return /\.(jsx?|mjs)$/.test(entry.name) ? [full] : [];
  });
  const callers = [];
  for (const full of walk(root)) {
    if (full.endsWith('overseasEnquiry.js') || full.includes('.selfcheck.')) continue;
    const source = stripComments(readFileSync(full, 'utf8'));
    const calls = (source.match(/buildOverseasDraft\(\{[\s\S]*?\}\)/g) || []);
    if (calls.length) callers.push({ name: full.slice(root.length + 1), calls });
  }
  console.log(`  buildOverseasDraft call sites found: ${callers.map((c) => `${c.name} x${c.calls.length}`).join(', ')}`);
  assert.ok(callers.length >= 3, 'fewer call sites than the three surfaces this rule exists for — the sweep is wrong, not the code');
  for (const caller of callers) {
    for (const call of caller.calls) {
      assert.match(call, /quote:/, `${caller.name} builds a WhatsApp draft without the settled total`);
    }
    // THE GATE, on every surface. Dekito's ask, 2026-10-06: the buyer should open WhatsApp already
    // knowing the shipping and the arrival. A surface that still opens WhatsApp before a destination is
    // picked sends the bare bottle price — the message this screen replaced. So each must read
    // needsDestination from the hook and, when it is set, send the click to the picker instead.
    const source = stripComments(readRaw(...caller.name.split('/')));
    assert.match(source, /\bneedsDestination\b/, `${caller.name} does not read whether a destination has been chosen`);
    assert.match(source, /onClick=\{[^}]*\? focusDestinationPicker : undefined\}/,
      `${caller.name} opens WhatsApp before a destination is chosen — the buyer leaves without the shipping`);
    assert.match(source, /'intlQuote\.pickFirst'/, `${caller.name} does not tell the buyer to pick a country first`);
  }
}
// The gate itself, RUN: it closes only in the international shop, only while nothing is picked, and only
// when there is a price to quote at all.
{
  assert.equal(ask({ country: '', bottles: 1 }).needsDestination, true, 'no destination yet: the gate is shut');
  assert.equal(ask({ country: 'DE', bottles: 1 }).needsDestination, false, 'a destination chosen: the gate opens');
  assert.equal(ask({ country: DESTINATION_OTHER, bottles: 1 }).needsDestination, false, '"another country" is an answer and opens it too');
  assert.equal(ask({ country: '', bottles: 1, price: 0 }).needsDestination, false, 'with no export price there is nothing to gate');
  assert.equal(MESSAGES.en['intlQuote.pickFirst'] && MESSAGES.id['intlQuote.pickFirst'] ? true : false, true, 'the gate needs its label in both shops');
}
// And the picker has the STABLE id the gate points at — a useId one changes between renders.
assert.match(read('components', 'storefront', 'InternationalShippingQuote.jsx'), /const countryId = DESTINATION_PICKER_ID;/,
  'the country picker must carry the id the order buttons send a buyer to');

// --- 6. THE GAP IS EXPLAINED, THE SUPPORT IS SAID, AND THE FREIGHT IS STILL NOT IN THE PRICE ------
const quoteBlock = read('components', 'storefront', 'InternationalShippingQuote.jsx');
assert.match(quoteBlock, /t\('intlQuote\.why'\)/, 'the quote block must say what the international price covers');
assert.match(quoteBlock, /t\('intlQuote\.support', \{ amount: shippingSupportUsd \}\)/,
  'the quote block must say what SOLIVAGANT carries, with the real figure — that sentence is the point of the rule');
// Said only with a settled figure: "we cover US$30" over "quoted on request" is a promise about a parcel we
// have not priced.
assert.match(quoteBlock, /shippingUsd && shippingSupportUsd \? \(/, 'and only when there is a shipping figure to carry part of');
for (const shop of ['id', 'en']) {
  for (const key of ['intlQuote.why', 'intlQuote.duties', 'intlQuote.support']) {
    assert.ok(MESSAGES[shop][key], `${key} is missing from the ${shop} shop`);
  }
  assert.match(MESSAGES[shop]['intlQuote.support'], /\{amount\}/, `${shop}: the support line must carry the figure, not a hard-coded one`);
  for (const [key, text] of Object.entries(MESSAGES[shop])) {
    if (!key.startsWith('intlQuote.')) continue;
    assert.doesNotMatch(String(text), /shipping is included|ongkir (sudah )?termasuk|free shipping|gratis ongkir/i,
      `${shop}/${key} promises the freight is in the price, which it has not been since 2026-09-25`);
  }
}

// --- 7. EVERY KEY THE SCREEN READS EXISTS IN BOTH SHOPS ------------------------------------------
{
  const keys = new Set();
  for (const parts of [['components', 'storefront', 'InternationalShippingQuote.jsx'], ['hooks', 'useInternationalQuote.js']]) {
    const source = read(...parts);
    for (const [, key] of source.matchAll(/t\(['"]([a-zA-Z][\w.]*)['"]/g)) keys.add(key);
    for (const [, prefix] of source.matchAll(/t\(`([\w.]+)\$\{/g)) {
      if (prefix === 'intlQuote.region.') for (const region of SHIPPING_RATE_REGIONS) keys.add(prefix + region.key);
      if (prefix === 'intlQuote.onRequest.') for (const reason of ['country', 'destination', 'bottles', 'size']) keys.add(prefix + reason);
    }
  }
  const expanded = [...keys].sort();
  console.log(`  message keys read by the quote screen: ${expanded.length}`);
  assert.ok(expanded.length >= 20, `only ${expanded.length} keys found — the sweep is broken, not the screen`);
  assert.ok(expanded.includes('intlQuote.region.rest_of_world'), 'the sixth group — zone 8 — must have a label');
  for (const key of expanded) {
    for (const shop of ['id', 'en']) assert.ok(MESSAGES[shop][key], `${key} is read by the quote screen but missing from the ${shop} shop`);
  }
}

// --- 8. A MEMBER DISCOUNT DOES NOT TRAVEL ---------------------------------------------------------
// Moved here from asiaPrice.selfcheck when the split was retired; the rule outlived it. applyTierPrices
// lowers priceNumber to the member price for a signed-in member and keeps the original as
// retailPriceNumber. The international price is built on RETAIL: reading the lowered number multiplied a
// domestic loyalty discount into an export price, so the same bottle cost US$45 to a buyer who had
// logged in and US$50 to one who had not. Dekito's decision, 2026-09-24.
{
  const exportHook = read('hooks', 'useOverseasPrice.js');
  const lineExpression = (exportHook.match(/const linePrice = Number\(([\s\S]*?)\);/) || [])[1] || '';
  assert.ok(lineExpression, 'the hook must compute one line price');
  // Order matters, not just presence: `priceNumber ?? retailPriceNumber` reads the member price first.
  const firstRetail = lineExpression.search(/retailPriceNumber/);
  const firstTierPrice = lineExpression.search(/(?<!retail)(?<!Retail)\bpriceNumber/);
  assert.ok(firstRetail >= 0 && (firstTierPrice < 0 || firstRetail < firstTierPrice),
    `retail must be read before the tier-rewritten price: ${lineExpression.replace(/\s+/g, ' ')}`);
}

console.log('priceFollowsTheDestination selfcheck OK (one bottle price everywhere, shipping from the carrier sheet less the '
  + 'support, the whole total on the page, every surface sends the same number, and the gap says why it exists)');
