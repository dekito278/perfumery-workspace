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
// His decision: price by DESTINATION, show the whole total, say why the gap exists. This chain holds all
// three, and it holds them by RUNNING the real code rather than by reading it.
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

import { EXPORT_ZONE_BY_COUNTRY } from '../data/exportZones.js';
import {
  SHIPPING_RATE_MAX_BOTTLES,
  SHIPPING_RATE_REGIONS,
  SHIPPING_RATE_TIERS,
} from '../data/internationalShippingRates.js';
import { USD_PRICE_RATE, USD_PRICE_STEP, usdPriceFor } from './usdPrice.js';
import { MESSAGES } from '../i18n/messages.js';

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, '..');
// Comments first, every time. A text check that forgets this fails on the sentence explaining why the
// old promise was removed, quoted in the file that removed it. This repo has been caught by that trap
// more than once.
const stripComments = (source) => source
  .replace(/\{\/\*[\s\S]*?\*\/\}/g, '').replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
const readRaw = (...parts) => readFileSync(join(root, ...parts), 'utf8');
const read = (...parts) => stripComments(readRaw(...parts));

/**
 * Strip a browser module's `@/` imports and RUN it with its collaborators injected.
 *
 * The import blocks in these files span several lines, so they are dropped by RANGE rather than by line
 * prefix — a filter on lines starting with `import` leaves the closing brace of a multi-line block
 * behind and the lift fails to parse, which reads as a broken rule rather than a broken tool.
 */
const withoutImports = (source) => source.replace(/^import[\s\S]*?from '[^']+';$/gm, '');
const run = (parts, preamble) => import(
  `data:text/javascript;base64,${Buffer.from(preamble + withoutImports(readRaw(...parts)), 'utf8').toString('base64')}`
);

const asJs = (value) => JSON.stringify(value);

// --- 1. THE SPLIT IN THE PRICE AGREES WITH THE SPLIT IN THE CARD -----------------------------------
// Two tables, written months apart, for different reasons. EXPORT_ZONE_BY_COUNTRY is the CARRIER's zone
// sheet and decides 2.2x or 3.5x on the bottle; SHIPPING_RATE_REGIONS is Dekito's own PRICE card and
// decides the freight. Nothing made them agree — they agree today, and that is exactly the kind of rule
// that is alive only because of today's data.
//
// If they ever disagree the result is a destination charged the neighbours' bottle price with Europe's
// freight, or the reverse, and nobody would notice from either file alone. So it is checked here, where
// both are in the same room.
const shippingRegion = await run(['utils', 'shippingRegion.js'], `
const EXPORT_ZONE_BY_COUNTRY = ${asJs(EXPORT_ZONE_BY_COUNTRY)};
const overseasPriceFromRetail = (retail, factor) => {
  const r = Number(retail) || 0;
  if (!r || !Number.isFinite(factor) || factor <= 1 || factor > 10) return null;
  return Math.ceil((r * factor) / 10000) * 10000;
};
`);
const { shippingRegionForCountry, internationalPriceFor, ASIA_MULTIPLIER } = shippingRegion;
assert.equal(typeof shippingRegionForCountry, 'function',
  'the destination no longer decides which international price a parcel is charged');

const cardRegionOf = new Map(
  SHIPPING_RATE_REGIONS.flatMap((region) => region.countries.map((code) => [code, region.key])),
);
const asiaOnTheCard = [...cardRegionOf].filter(([, key]) => key === 'southeast_asia').map(([code]) => code);
const asiaByPrice = [...cardRegionOf.keys()].filter((code) => shippingRegionForCountry(code) === 'asia');
assert.deepEqual(asiaByPrice.slice().sort(), asiaOnTheCard.slice().sort(),
  'the card\'s Southeast Asia group and the 2.2x bottle price must cover exactly the same countries — '
  + `price says ${asiaByPrice.join(' ')}, card says ${asiaOnTheCard.join(' ')}`);
console.log(`  the two tables agree on ${asiaOnTheCard.length} Southeast Asia destinations: ${asiaOnTheCard.join(' ')}`);

// An unknown destination must fall to the DEARER price. That direction is the safety property: an
// over-quote is corrected downwards in a conversation, an under-quote has to be taken back.
for (const unknown of ['XX', 'ZZ', '', null, undefined, 'id', '  ']) {
  assert.equal(shippingRegionForCountry(unknown), 'world',
    `an unrecognised destination (${asJs(unknown)}) must never be quoted the cheaper bottle price`);
}

// --- 2. EVERY COUNTRY THE PICKER OFFERS CAN ACTUALLY BE QUOTED --------------------------------------
// A picker that lists a country and then answers "on request" for it is a form that wastes the one
// question it asked. Every listed country, at every bottle count the picker offers, must come back with
// a number — run through the REAL quote function, not a description of it.
const quoteModule = await run(['utils', 'internationalShippingPrice.js'], `
const SHIPPING_RATE_MAX_BOTTLES = ${asJs(SHIPPING_RATE_MAX_BOTTLES)};
const SHIPPING_RATE_TIERS = ${asJs(SHIPPING_RATE_TIERS)};
const REGIONS = ${asJs(SHIPPING_RATE_REGIONS)};
const BY_COUNTRY = new Map(REGIONS.flatMap((r) => r.countries.map((c) => [c, r])));
const shippingRateRegionFor = (code) => BY_COUNTRY.get(String(code || '').trim().toUpperCase()) || null;
`);
const { quoteInternationalShippingPrice } = quoteModule;

const destination = await run(['utils', 'shippingDestination.js'], `
const SHIPPING_RATE_REGIONS = ${asJs(SHIPPING_RATE_REGIONS)};
`);
const { destinationOptions, DESTINATION_OTHER, isValidDestination, CARD_COUNTRIES } = destination;

const offered = destinationOptions('en').flatMap((group) => group.countries.map((item) => item.code));
assert.deepEqual(offered.slice().sort(), CARD_COUNTRIES.slice().sort(),
  'the picker must offer exactly the countries the card can quote — no more, and none missing');
let quoted = 0;
for (const code of offered) {
  for (let bottles = 1; bottles <= SHIPPING_RATE_MAX_BOTTLES; bottles += 1) {
    const quote = quoteInternationalShippingPrice({ countryCode: code, bottles });
    assert.ok(quote?.usd > 0,
      `the picker offers ${code} but the card cannot quote ${bottles} bottle(s) to it`);
    quoted += 1;
  }
}
console.log(`  ${offered.length} destinations x ${SHIPPING_RATE_MAX_BOTTLES} bottle counts = ${quoted} quotes, none on request`);

// "Somewhere else" is a real choice and must behave like one: accepted by the picker, and answered with
// the card's own footnote rather than with a guess.
assert.ok(isValidDestination(DESTINATION_OTHER), 'the picker must accept "another country" as a choice');
assert.equal(quoteInternationalShippingPrice({ countryCode: DESTINATION_OTHER, bottles: 1 })?.usd, null,
  '"another country" must be quoted on request, never at a listed region\'s price');
assert.equal(shippingRegionForCountry(DESTINATION_OTHER), 'world',
  'and it must pay the world bottle price, which is the one that cannot under-quote');

// --- 3. THE TOTAL IS THE SUM OF THE LINES THE BUYER WAS SHOWN --------------------------------------
// Three numbers on screen and a fourth in the WhatsApp draft. They have drifted before: #362 fixed the
// action button's price line and left both sticky bars sending a figure that had not been offered, and
// the Studio calculator once showed Rp 180.000 in the copied summary while billing Rp 2.227.500 for the
// same six bottles. So the arithmetic is RUN, with the real quote function and the real dollar rounding.
globalThis.__fx = { country: '', bottles: 1 };
globalThis.__quote = quoteInternationalShippingPrice;
const quoteHook = await run(['hooks', 'useInternationalQuote.js'], `
const useShippingDestination = () => ({
  country: globalThis.__fx.country, bottles: globalThis.__fx.bottles, setCountry() {}, setBottles() {},
});
const useTranslate = () => ({ t: (key, vars) => (vars ? key + ':' + JSON.stringify(vars) : key), region: 'en' });
const USD_PRICE_RATE = ${asJs(USD_PRICE_RATE)};
const USD_PRICE_STEP = ${asJs(USD_PRICE_STEP)};
const usdPriceFor = ${usdPriceFor.toString()};
const countryNameFor = (code) => String(code || '');
const quoteInternationalShippingPrice = (...args) => globalThis.__quote(...args);
const DESTINATION_OTHER = ${asJs(DESTINATION_OTHER)};
const SHIPPING_RATE_BOTTLE_SIZE_ML = 30;
`);
const { useInternationalQuote } = quoteHook;

const ask = ({ country = '', bottles = 1, price = 1260000, size = '30 ml' }) => {
  globalThis.__fx = { country, bottles };
  return useInternationalQuote({ price, product: { size }, variant: { size } });
};

// La Tulipe, measured in production 2026-10-05: retail Rp 359.000, export Rp 1.260.000 -> US$80.
{
  const europe = ask({ country: 'DE', bottles: 1 });
  assert.equal(europe.goodsUsd, 80, 'the bottle price must be the published export price in dollars');
  assert.equal(europe.shippingUsd, 140, 'and the shipping must come off the card for that destination');
  assert.equal(europe.totalUsd, 220, 'the total must be the sum of the two lines above it');
  assert.equal(europe.onRequest, null, 'a settled total must not also claim to be on request');
}
// The same bottle, the neighbours: the cheaper freight tier AND the cheaper bottle price, because the
// destination now decides both. This is the pair of numbers the old clock-based guess got wrong for a
// reader in Kuala Lumpur using an English browser.
{
  const asia = ask({ country: 'MY', bottles: 1, price: 790000 });
  assert.equal(asia.shippingUsd, 80, 'Southeast Asia must be charged the card\'s Southeast Asia freight');
  assert.ok(asia.totalUsd < 220, 'and the neighbours must not end up paying more than Europe');
}
// Two bottles ride on one shipment. The card says so and the buyer must see it, because a shipping line
// that doubled with the bottle count would be a worse deal than the one actually on offer.
{
  const one = ask({ country: 'DE', bottles: 1 });
  const two = ask({ country: 'DE', bottles: 2 });
  assert.equal(two.shippingUsd, one.shippingUsd,
    'the card charges per SHIPMENT inside a tier — the second bottle must not be charged freight twice');
  assert.equal(two.goodsUsd, one.goodsUsd * 2, 'while the bottles themselves do multiply');
  assert.equal(two.totalUsd, two.goodsUsd + two.shippingUsd, 'and the total must still be the sum');
}
// Past the card, each limit named SEPARATELY. "Quote on request" with no reason reads as a refusal; with
// a reason it reads as a next step, and the three reasons are not interchangeable.
{
  const unanswered = ask({ country: '', bottles: 1 });
  assert.equal(unanswered.onRequest, 'country', 'an unanswered picker is a question, not a dead end');
  assert.equal(unanswered.totalUsd, null, 'and it must not print a total it cannot know');

  assert.equal(ask({ country: DESTINATION_OTHER, bottles: 1 }).onRequest, 'destination',
    'a destination the card does not list must say so, not blame the bottle count');
  assert.equal(ask({ country: 'DE', bottles: SHIPPING_RATE_MAX_BOTTLES + 1 }).onRequest, 'bottles',
    'past the card\'s last tier the reason is the quantity');
  // THE SIZE THE CARD WAS WRITTEN FOR. Every bottle in the shop is 30 ml today, which is why this rule
  // would otherwise be invisible: a 50 ml added next month would be quoted 30 ml freight, and here that
  // is a published promise rather than a figure Dekito is reading with both tables in front of him.
  assert.equal(ask({ country: 'DE', bottles: 1, size: '50 ml' }).onRequest, 'size',
    'a bottle the card was not written for must be quoted on request, not at the 30 ml rate');
  assert.equal(ask({ country: 'DE', bottles: 1, size: '50 ml' }).shippingUsd, null,
    'and it must carry no freight figure at all');
  // THE ORDER OF THE REASONS, tested where it actually shows. A sabotage that swapped size behind country
  // passed every case above, because with a country already chosen both orders reach 'size'. It only
  // matters when BOTH are unanswered — and there the useful answer is the size, because picking a country
  // cannot fix a bottle the card was never written for.
  assert.equal(ask({ country: '', bottles: 1, size: '50 ml' }).onRequest, 'size',
    'with no country AND an off-card size, the reason must be the one the buyer cannot resolve themselves');
}

// --- 4. THE DRAFT CARRIES THE NUMBER THE BUYER WAS SHOWN ------------------------------------------
// Whatever is settled on screen has to be what reaches WhatsApp, or Dekito is quoted one figure and
// replies with another.
{
  const settled = ask({ country: 'DE', bottles: 2 });
  assert.equal(settled.draft?.key, 'export.waDraftQuote', 'a settled total must travel as the quote line');
  assert.equal(settled.draft.vars.total, `US$${settled.totalUsd}`,
    'and the total in the message must be the total on the screen');
  assert.equal(settled.draft.vars.shipping, `US$${settled.shippingUsd}`);
  assert.equal(settled.draft.vars.goods, `US$${settled.goodsUsd}`);

  const onRequest = ask({ country: 'DE', bottles: 7 });
  assert.equal(onRequest.draft?.key, 'export.waDraftDestination',
    'a known destination with no rate must still name the destination — that is half the question answered');
  assert.equal(ask({ country: '', bottles: 1 }).draft, null,
    'and with nothing chosen there is no quote to send, so the caller\'s own price line stands');
}

// --- 5. EVERY SURFACE THAT BUILDS THE DRAFT CARRIES THE TOTAL -------------------------------------
// DERIVED, not listed. #362 is the reason: it fixed the one call site that was reported and left the two
// nobody had named, and on the phone the sticky bar is the only button most buyers ever press. So find
// every caller of the builder and require each to pass the quote.
// A SABOTAGE PROVED THIS LIST WAS THE BUG. The first version of this block said "DERIVED, not listed"
// in its own comment and then listed five files — so a sixth surface added tomorrow walks straight past
// it, which is #362 happening a second time inside the guard built to stop #362. The comment's promise
// was wider than its subject, which is the most productive defect class in this repo and it caught me.
// So: WALK THE TREE.
{
  const walk = (dir) => readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) return walk(full);
    return /\.(jsx?|mjs)$/.test(entry.name) ? [full] : [];
  });
  const callers = [];
  for (const full of walk(root)) {
    // The definition itself, and the chains that test it, are not surfaces.
    if (full.endsWith('overseasEnquiry.js') || full.includes('.selfcheck.')) continue;
    const source = stripComments(readFileSync(full, 'utf8'));
    const calls = (source.match(/buildOverseasDraft\(\{[\s\S]*?\}\)/g) || []);
    if (calls.length) callers.push({ name: full.slice(root.length + 1), calls });
  }
  console.log(`  buildOverseasDraft call sites found: ${callers.map((c) => `${c.name} x${c.calls.length}`).join(', ')}`);
  assert.ok(callers.length >= 3,
    'the draft builder has fewer call sites than the three surfaces this rule exists for — the sweep is wrong, not the code');
  for (const caller of callers) {
    for (const call of caller.calls) {
      assert.match(call, /quote:/,
        `${caller.name} builds a WhatsApp draft without the settled total — the buyer sees one number and Dekito receives another`);
    }
  }
}

// --- 6. THE GAP IS EXPLAINED, AND THE FREIGHT IS STILL NOT IN THE PRICE ---------------------------
// Dekito's decision, 2026-10-05: an export price large enough to raise the question is better off
// answering it. A 3.5x tier with no stated reason is the version a buyer screenshots.
const quoteBlock = read('components', 'storefront', 'InternationalShippingQuote.jsx');
assert.match(quoteBlock, /t\('intlQuote\.why'\)/,
  'the quote block must say what the international price covers — that sentence is the whole answer to '
  + 'the question the gap invites');
for (const shop of ['id', 'en']) {
  assert.ok(MESSAGES[shop]['intlQuote.why'], `the reason for the gap is missing from the ${shop} shop`);
  assert.ok(MESSAGES[shop]['intlQuote.duties'],
    `the duties note is missing from the ${shop} shop — a total that hides them is the same surprise one step later`);
}
// The same rule asiaPrice.selfcheck holds across the old copy, applied to the new screen: nothing may
// say the freight is inside the price, because it stopped being true on 2026-09-25.
for (const shop of ['id', 'en']) {
  for (const [key, text] of Object.entries(MESSAGES[shop])) {
    if (!key.startsWith('intlQuote.')) continue;
    assert.doesNotMatch(String(text), /shipping is included|ongkir (sudah )?termasuk|free shipping|gratis ongkir/i,
      `${shop}/${key} promises the freight is in the price, which it has not been since 2026-09-25`);
  }
}

// --- 7. EVERY KEY THE SCREEN READS EXISTS IN BOTH SHOPS ------------------------------------------
// DERIVED from the files themselves rather than listed, because a key list written by hand is a key list
// that goes stale. translate() falls back to the KEY when a message is missing, so a typo here does not
// throw — it prints "intlQuote.total" on the page, in front of the buyer.
{
  const sources = [
    ['components', 'storefront', 'InternationalShippingQuote.jsx'],
    ['hooks', 'useInternationalQuote.js'],
  ];
  const keys = new Set();
  for (const parts of sources) {
    const source = read(...parts);
    for (const [, key] of source.matchAll(/t\(['"]([a-zA-Z][\w.]*)['"]/g)) keys.add(key);
    // Template-built keys: `intlQuote.region.${group.key}` and `intlQuote.onRequest.${reason}`. The
    // prefix is in the file; the suffixes are the data, so expand them from the data.
    for (const [, prefix] of source.matchAll(/t\(`([\w.]+)\$\{/g)) {
      if (prefix === 'intlQuote.region.') for (const region of SHIPPING_RATE_REGIONS) keys.add(prefix + region.key);
      if (prefix === 'intlQuote.onRequest.') for (const reason of ['country', 'destination', 'bottles', 'size']) keys.add(prefix + reason);
    }
  }
  const expanded = [...keys].sort();
  console.log(`  message keys read by the quote screen: ${expanded.length}`);
  assert.ok(expanded.length >= 20, `only ${expanded.length} keys found — the sweep is broken, not the screen`);
  assert.ok(expanded.includes('intlQuote.region.europe'), 'the region group labels must be in the swept set');
  assert.ok(expanded.includes('intlQuote.onRequest.size'), 'and so must every on-request reason');
  for (const key of expanded) {
    for (const shop of ['id', 'en']) {
      assert.ok(MESSAGES[shop][key], `${key} is read by the quote screen but missing from the ${shop} shop`);
    }
  }
}

// --- 8. THE PICKED DESTINATION OUTRANKS THE CLOCK ------------------------------------------------
// The point of the whole change, held where the precedence actually lives. RUN the hook's own expression
// rather than pinning its words: it has been rewritten once already and will be again.
{
  const hook = read('hooks', 'useShippingRegion.js');
  const returned = (hook.match(/return ([^;]+);/) || [])[1];
  assert.ok(returned, 'useShippingRegion no longer returns anything');
  // The hook's own expression, read from the file and run as written — not a copy of it.
  const decide = new Function('country', 'detected', 'shippingRegionForCountry', `return (${returned});`);
  assert.equal(decide('MY', 'world', shippingRegionForCountry), 'asia',
    'a buyer who picked Malaysia must be quoted Malaysia, whatever their browser clock says');
  assert.equal(decide('DE', 'asia', shippingRegionForCountry), 'world',
    'and a reader whose clock says Southeast Asia must still be charged Europe when Europe is where it ships');
  assert.equal(decide('', 'asia', shippingRegionForCountry), 'asia',
    'until they pick, the clock still seeds the default — nothing about today\'s behaviour may regress');
  assert.equal(decide('', 'world', shippingRegionForCountry), 'world');
}
// And the bottle price itself must be reached through that region, not around it.
assert.equal(internationalPriceFor({ tierPrices: { overseas: 1260000 }, linePrice: 359000, region: 'asia' }), 790000,
  'the Southeast Asia bottle price must still be computed from retail at 2.2x');
assert.equal(ASIA_MULTIPLIER, 2.2, "Dekito's decision: the neighbours pay 2.2x, not the hand-set 3.5x");

console.log('priceFollowsTheDestination selfcheck OK (the destination decides the price, the whole total is '
  + 'on the page, every surface sends the same number, and the gap says why it exists)');
