// `node src/utils/productShare.selfcheck.mjs`
//
// Sharing a bottle with a friend. Every product page already prerenders its own og:title, og:description
// and og:image — the card WhatsApp draws is finished work — but until now there was no door: the journal
// article page had a share card, the product page did not. On a phone that meant leaving the page to copy
// the address bar, which is where most people stop.
//
// The rules below are about the LINK, because a share button that hands over the wrong address is worse
// than none: the friend opens a phone-only duplicate on a laptop, or an English reader forwards the
// Indonesian card.
process.env.TZ = 'Asia/Jakarta';

import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { productShareUrl } from './productShare.js';
import { EN_PATH_PREFIX } from './storefrontRegion.js';
import { MESSAGES } from '../i18n/messages.js';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
// A comment carrying the very text being searched for has defeated a check in this repo five times.
const stripComments = (source) => source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '').replace(/\{\/\*[\s\S]*?\*\/\}/g, '');
const read = (...parts) => stripComments(readFileSync(join(root, ...parts), 'utf8'));

// --- 1. The shared address is a product page the router answers -----------------------------------------
const app = read('App.jsx');
const productRoutes = [...app.matchAll(/<Route\s+path="([^"]+)"\s+element=\{<PublicProductDetailPage\b[^}]*\}\s*\/>/g)]
  .map((match) => match[1])
  .filter((path) => path.includes(':'));
assert.ok(productRoutes.length >= 1, 'the router must still answer a product page by slug');

const ORIGIN = 'https://www.solivagantscent.com';
const shared = productShareUrl('hug-n-1', { origin: ORIGIN, basename: '' });
const sharedPath = shared.slice(ORIGIN.length);
assert.ok(productRoutes.some((route) => new RegExp(`^${route.replace(/:[^/]+/g, '[^/]+')}$`).test(sharedPath)),
  `the link a buyer sends is ${sharedPath}, which is not a product route — the friend gets a 404`);

// --- 2. It is the shop the reader is actually in --------------------------------------------------------
// /en exists precisely so the English page can carry its own English share card. A reader of the English
// shop who shares the Indonesian address hands their friend a card in a language they were never shown.
const sharedEn = productShareUrl('hug-n-1', { origin: ORIGIN, basename: EN_PATH_PREFIX });
assert.equal(sharedEn, `${ORIGIN}${EN_PATH_PREFIX}${sharedPath}`, 'the English shop shares its own address');
assert.ok(!shared.includes('/mobile/') && !sharedEn.includes('/mobile/'),
  'never the phone-only duplicate: opened on a laptop it is the wrong layout, and it is not the address the share card was prerendered for');

// A missing slug must produce NOTHING, not a link to the catalogue root pretending to be a bottle.
assert.equal(productShareUrl('', { origin: ORIGIN }), '');
assert.equal(productShareUrl(null), '');
assert.equal(productShareUrl(' la tulipe/1 ', { origin: ORIGIN }), `${ORIGIN}/catalog/la%20tulipe%2F1`,
  'a slug is encoded — a stray character must not silently change which page the link opens');

// --- 3. Wherever the shop shows ONE bottle, it can be shared ---------------------------------------------
// Read the surfaces from the code, never from a list kept by hand: every page that offers the overseas
// enquiry is a page presenting a single product to a buyer. A new one gets this rule for free.
const pageFiles = [];
for (const dir of ['pages', join('pages', 'mobile')]) {
  for (const name of readdirSync(join(root, dir))) {
    if (name.endsWith('.jsx')) pageFiles.push([dir, name]);
  }
}
const productSurfaces = pageFiles.filter(([dir, name]) => read(dir, name).includes('<OverseasInquiryButton'));
assert.ok(productSurfaces.length >= 3, 'expected the desktop, phone and immersive product pages to be found');
for (const [dir, name] of productSurfaces) {
  assert.match(read(dir, name), /<ShareProductButton/,
    `${dir}/${name} shows a buyer one bottle but gives them no way to send it to anyone`);
}

// --- 4. The button itself --------------------------------------------------------------------------------
const button = read('components', 'storefront', 'ShareProductButton.jsx');
assert.match(button, /navigator\.share/, 'the native sheet is the whole point on a phone: one tap to WhatsApp');
assert.match(button, /copyTextToClipboard/, 'and where there is no sheet, the link goes to the clipboard instead');
assert.match(button, /AbortError/,
  'closing the share sheet must not be reported as a failure — that is someone changing their mind');
assert.match(button, /routerBasename\(\)/, 'the link is built for the shop being read, not for a fixed one');
assert.doesNotMatch(button, /window\.location\.href|location\.pathname/,
  'the address bar is not the link to share: on a phone it is the /mobile duplicate');

// --- 5. In both languages -------------------------------------------------------------------------------
for (const key of ['pdp.share', 'pdp.shareCopied', 'pdp.shareFailed']) {
  for (const language of ['id', 'en']) {
    assert.ok(MESSAGES[language][key], `${language}.${key} is missing`);
  }
  assert.match(button, new RegExp(`t\\('${key.replace('.', '\\.')}'\\)`), `${key} must be read through t()`);
}

console.log('productShare selfcheck OK (one tap to send a bottle to someone, in the right shop)');
