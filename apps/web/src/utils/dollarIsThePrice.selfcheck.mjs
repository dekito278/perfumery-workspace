// `node src/utils/dollarIsThePrice.selfcheck.mjs`
//
// An international buyer is shown the dollar, never the rupiah beside it.
//
// The two are not the same amount, on purpose: the rupiah is Dekito's export price and the dollar is
// that price converted at a rate held BELOW the market and rounded UP to the next $5, so what lands in
// his account is never less than the rupiah price.
//
// Printed side by side with no label, that cushion reads as the opposite. Dekito did the division
// himself on 1 Oct 2026 — Animal Farm showed "US$80  Rp 1.260.000", and US$80 is about Rp 1.43 juta at
// the real rate, so the shop looked like it was quoting one number and charging another. A buyer abroad
// reaches the same arithmetic and a worse conclusion.
//
// Labelling it "approx." would not have fixed it. Rp 1.260.000 genuinely is not the equivalent of US$80;
// it is a different number for a different purpose.
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { USD_PRICE_RATE, USD_PRICE_STEP, usdPriceFor } from './usdPrice.js';
import { DEFAULT_OVERSEAS_MULTIPLIER, overseasPriceFromRetail } from './memberPriceFill.js';
import { quotedInternationalPrice } from './overseasEnquiry.js';

const here = dirname(fileURLToPath(import.meta.url));
const src = join(here, '..');
const strip = (t) => t.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/^\s*\/\/.*$/gm, ' ').replace(/\{\/\*[\s\S]*?\*\/\}/g, ' ');

// --- the cushion is real, and it is why the two numbers must not sit together -------------------------
// Animal Farm, the bottle that prompted this, run through the real rules rather than restated.
const exportPrice = overseasPriceFromRetail(359000, DEFAULT_OVERSEAS_MULTIPLIER);
assert.equal(exportPrice, 1260000, 'the export price rule moved — check this guard still describes the shop');
const usd = usdPriceFor(exportPrice);
assert.equal(usd, 80);
assert.ok(usd * USD_PRICE_RATE > exportPrice,
  'the dollar price must be worth MORE than the rupiah price it came from — that cushion is the whole '
  + 'reason the two numbers differ, and if it ever inverts the buyer is being undercharged');
assert.ok(usd % USD_PRICE_STEP === 0, 'prices land on a clean step');

// --- no buyer-facing component prints both ------------------------------------------------------------
// Counted, not listed: the components are whichever convert a price to dollars. Each may fall BACK to
// rupiah when there is no dollar to show — that is a stand-in, not a pairing — so what is forbidden is
// rendering the rupiah of the same value alongside it.
const offenders = [];
const converters = [];
const walk = (dir) => {
  for (const entry of readdirSync(join(src, dir), { withFileTypes: true })) {
    const rel = `${dir}/${entry.name}`;
    if (entry.isDirectory()) { walk(rel); continue; }
    if (!/\.jsx$/.test(entry.name) || entry.name.includes('.selfcheck.')) continue;
    const source = strip(readFileSync(join(src, rel), 'utf8'));
    const call = source.match(/usdPriceFor\((\w+)\)/);
    if (!call) continue;
    converters.push(rel);
    const priced = call[1];
    // The rupiah of that same value may appear once, as the stand-in inside the same ternary as the
    // dollar. Two mentions means one of them is sitting beside it.
    const mentions = (source.match(new RegExp(`formatRupiah\\(${priced}\\)`, 'g')) || []).length;
    if (mentions > 1) offenders.push(`${rel} (${mentions}x)`);
  }
};
walk('components'); walk('pages');
assert.ok(converters.length >= 3,
  `only ${converters.length} component(s) convert a price to dollars — the derivation broke`);
assert.deepEqual(offenders, [],
  'these show an international buyer the rupiah beside the dollar, which invites exactly the division '
  + `that makes the shop look like it quotes one number and charges another:\n  ${offenders.join('\n  ')}`);

// --- and EVERY message that leaves the page carries the dollar -----------------------------------------
// The draft is the buyer's own words back to Dekito; a rupiah figure in it is a number he has to explain
// before he can quote a parcel.
//
// This check used to look at ONE component and pin the exact expression it happened to contain. Both
// mistakes cost something the same day. Scoped to that component it never saw the two STICKY BARS, which
// build their own drafts — and the phone's bar is the only button most buyers ever press, so the leak
// survived in the most-used path. Pinned to the spelling, it then failed the moment the three callers
// were given one shared helper, calling a correct change a regression.
//
// So: counted, not listed, and held as the rule.
const drafters = [];
const spellingTheirOwn = [];
const walkDrafters = (dir) => {
  for (const entry of readdirSync(join(src, dir), { withFileTypes: true })) {
    const rel = `${dir}/${entry.name}`;
    if (entry.isDirectory()) { walkDrafters(rel); continue; }
    if (!/\.jsx?$/.test(entry.name) || entry.name.includes('.selfcheck.')) continue;
    const source = strip(readFileSync(join(src, rel), 'utf8'));
    if (!/buildOverseasDraft\(\{/.test(source)) continue;
    drafters.push(rel);
    if (!/quotedInternationalPrice\(/.test(source)) spellingTheirOwn.push(rel);
  }
};
walkDrafters('components'); walkDrafters('pages');
assert.ok(drafters.length >= 3,
  `only ${drafters.length} enquiry draft(s) found (${drafters.join(', ')}) — the derivation broke, and the `
  + 'sticky bars are exactly what goes missing when it does');
assert.deepEqual(spellingTheirOwn, [],
  'these build a WhatsApp enquiry without going through quotedInternationalPrice, so an overseas buyer '
  + `sends Dekito a number in a currency he never quoted:\n  ${spellingTheirOwn.join('\n  ')}`);

// The helper itself, RUN: the dollar when there is one, rupiah only as a stand-in.
assert.equal(quotedInternationalPrice(1260000), 'US$80');
assert.equal(quotedInternationalPrice(0, 'Rp 359.000'), 'Rp 359.000', 'with no export price the caller label stands in');
assert.equal(quotedInternationalPrice(null, ''), '', 'and with nothing at all it says nothing');

console.log(`dollarIsThePrice selfcheck OK (${converters.length} components, dollar alone)`);
