// The gift has to be visible where the decision is made — on EVERY product page, to EVERY buyer.
//
// Dekito built the free vial in September. The cart said so, the checkout said so, the order page said
// so; the product page said nothing, which is the one screen where knowing changes anything.
//
// This guard exists because of how I first wired it: I dropped <FreeVialNote> inside the
// `{exportPrice ? …}` block on both pages. On mobile that was invalid JSX and the build caught it. On
// desktop it compiled perfectly and was simply WRONG — the note would have appeared only for overseas
// readers, the one audience whose orders are quoted by hand on WhatsApp and never reach this cart. A
// green build proved nothing about which buyers could see it.
//
// So the rule is not "the component is imported somewhere". It is: present on every product page, and
// NOT nested inside a conditional that only some visitors satisfy.
//
// The subject is DERIVED — every *ProductDetailPage.jsx under src/pages, found by walking. A third
// product page (a tablet layout, an /en variant) is covered the day it is written, without anyone
// remembering to add it here. Hardcoding the two files I happened to touch is exactly the failure this
// repo keeps repeating: a guard whose promise is wider than the list it actually reads.

import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const PAGES = path.resolve(HERE, '../../pages');
const NOTE = path.resolve(HERE, 'FreeVialNote.jsx');

const walk = (dir) => fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
  const full = path.join(dir, entry.name);
  return entry.isDirectory() ? walk(full) : [full];
});

const productPages = walk(PAGES).filter((file) => /ProductDetailPage\.jsx$/.test(path.basename(file)));

// A floor, because a walk that finds nothing would otherwise pass every assertion below it by vacuity.
assert.ok(productPages.length >= 2,
  `only ${productPages.length} product detail page(s) found under src/pages — the walk lost them, fix this guard`);

/**
 * The span of a conditional block that starts at `{<test> ?`, by matching braces from that `{`.
 *
 * Crude on purpose: it counts braces and ignores strings, which is enough for JSX markup and cannot
 * silently pass — a miscount ends the span early or late, and either way the assertion still reads a
 * region of the real file rather than trusting a pattern.
 */
const conditionalSpans = (source, test) => {
  const spans = [];
  const opener = new RegExp(`\\{\\s*${test}\\s*\\?`, 'g');
  let match;
  while ((match = opener.exec(source))) {
    let depth = 0;
    for (let i = match.index; i < source.length; i += 1) {
      if (source[i] === '{') depth += 1;
      else if (source[i] === '}') {
        depth -= 1;
        if (depth === 0) { spans.push([match.index, i]); break; }
      }
    }
  }
  return spans;
};

// Conditions that are true for only SOME visitors. A note inside one of these is a note some buyers
// never see — which is how the desktop page shipped a gift notice visible only to people who cannot
// use this cart.
const AUDIENCE_GATES = ['exportPrice', 'isInternational', 'isMember', 'isReseller'];

for (const file of productPages) {
  const source = fs.readFileSync(file, 'utf8');
  const where = path.relative(path.resolve(HERE, '../../..'), file);

  assert.match(source, /import FreeVialNote from '@\/components\/storefront\/FreeVialNote\.jsx';/,
    `${where} does not import FreeVialNote — the gift is invisible on the screen where it would matter`);

  const rendered = source.indexOf('<FreeVialNote');
  assert.ok(rendered > 0, `${where} imports FreeVialNote and never renders it`);

  // It has to be fed the catalogue, or it can never find the vial product and silently renders nothing.
  assert.match(source.slice(rendered, rendered + 200), /products=\{/,
    `${where} renders <FreeVialNote> without a products prop, so it can never find the vial and shows nothing`);

  for (const gate of AUDIENCE_GATES) {
    for (const [start, end] of conditionalSpans(source, gate)) {
      assert.ok(rendered < start || rendered > end,
        `${where} renders <FreeVialNote> inside {${gate} ? …}, so only some buyers would see the gift`);
    }
  }
}

// And the note itself stays silent when there is nothing to give. freeVialChoices filters on stock
// (proved in freeVial.selfcheck.mjs step 10); what matters here is that the note reads THAT function
// rather than isFreeVialProduct alone, which would only prove the vial row exists and would promise a
// gift the checkout then fails to hand over.
const note = fs.readFileSync(NOTE, 'utf8');
assert.match(note, /freeVialChoices\([^)]*\)\.length === 0\) return null;/,
  'FreeVialNote must hide itself via freeVialChoices — a gift with no aroma left in stock is a promise, not an offer');

// The wording is the cart's own. A second copy of it here would be a second thing to translate and the
// first thing to drift, and the shop would then describe the same gift two slightly different ways.
assert.match(note, /t\('cart\.giftTitle'\)/, 'the note reuses the cart string');
assert.match(note, /t\('cart\.giftBody'\)/, 'the note reuses the cart string');
