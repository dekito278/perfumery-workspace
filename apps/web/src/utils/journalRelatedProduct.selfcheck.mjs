// `node src/utils/journalRelatedProduct.selfcheck.mjs`
//
// "Kisah Jason Vorhees" tells the story of a perfume that is in the catalogue, and the page it was told
// on had no link to it at all — zero product links, no buy button. A reader finished and had nowhere to
// go.
//
// related_formula_id already existed and was already FILLED IN for that article, which is what made this
// look like a dropped field at first. It is not: it points at a formula in Studio, and
// storefront_products carries no formula column, so there was no chain of data to follow. This is the
// column that can, and it stores the SLUG, because /catalog/<slug> is already the product's address.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { MESSAGES } from '../i18n/messages.js';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const strip = (s) => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '').replace(/\{\/\*[\s\S]*?\*\/\}/g, '');
const read = (...parts) => strip(readFileSync(join(root, ...parts), 'utf8'));

// --- 1. The field survives the trip out of the database ---------------------------------------------
// This repo's most expensive recurring bug is a field written in Studio, stored correctly, and dropped
// on the way out by a hand-written field list. The journal service had three such lists, and they were
// ALREADY one column behind — none of them named related_formula_id. They select '*' now, and
// toAppRecord spreads the row, so a column added later arrives on its own.
const service = read('services', 'journalPostsSupabaseService.js');
assert.doesNotMatch(service, /select\('id, title, category/,
  'the journal service must not hand-list its columns — that list was already missing a field, and '
  + 'the next one added would be dropped in silence too');
assert.ok((service.match(/\.select\('\*'\)/g) || []).length >= 8,
  'every journal read takes the whole row');
// And the write side carries it, or Studio cannot set it.
assert.match(service, /related_product_slug: postData\.related_product_slug/,
  'saving an article must store the product it is about');

// --- 2. Both surfaces offer it, from ONE component ---------------------------------------------------
// Desktop and mobile drifting apart is this repo's commonest defect, and an article that offers the
// perfume on one and not the other is the kind nobody reports.
const page = read('pages', 'PublicJournalArticlePage.jsx');
assert.match(page, /<JournalRelatedProduct post=\{post\} mobile \/>/, 'the phone shows it');
assert.match(page, /<JournalRelatedProduct post=\{post\} \/>/, 'and so does the desktop');

// --- 3. A missing or stale link renders NOTHING ------------------------------------------------------
// A product can be unpublished or re-slugged long after the article was written. A dead link under a
// story is worse than no link.
const card = read('components', 'journal', 'JournalRelatedProduct.jsx');

// The price on the card comes from the component that prices every other card in the shop. Written by
// hand it read `product.price`, which is the Indonesian one — Rp 297.000 on an English article whose
// product page charges Rp 1.040.000. A reader clicked through and watched the number quadruple.
assert.match(card, /<CardPrice product=\{product\}/,
  'the related-product card prices itself instead of asking CardPrice, so the English shop gets the Indonesian number');
assert.doesNotMatch(card, /\{product\.price\}/, 'and it must not go back to printing the domestic price directly');
assert.match(card, /if \(!slug\) return null;/, 'no product named, nothing rendered');
assert.match(card, /if \(!product\) return null;/, 'a slug that matches nothing renders nothing');
assert.match(card, /if \(!path\) return null;/, 'and a product with no address renders nothing');
// The address comes from the shared helper, so the phone gets /mobile/products/<slug> for free.
assert.match(card, /getProductStorefrontPath\(product, \{ mobile \}\)/,
  'the link is built by the one helper that knows both surfaces');

// --- 4. Both languages, from the message file --------------------------------------------------------
for (const key of ['journal.relatedProductEyebrow', 'journal.relatedProductCta']) {
  for (const language of ['id', 'en']) {
    assert.ok(MESSAGES[language][key], `${key} is missing in ${language}`);
  }
  assert.notEqual(MESSAGES.id[key], MESSAGES.en[key], `${key} must actually be translated`);
}
assert.doesNotMatch(card, /Parfum dalam|Lihat parfum/, 'no copy written into the component');

console.log('journalRelatedProduct selfcheck OK (an article about a perfume offers the perfume, on both surfaces, and never a dead link)');
