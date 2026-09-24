// `node src/utils/contactPrompt.selfcheck.mjs`
//
// "Nomor resinya belum masuk ke sistem — tanya lewat WhatsApp kalau kamu butuh sekarang."
//
// That sentence has been the opening line of the tracking page for every shipped parcel this shop has
// sent, and the page carried no WhatsApp link at all. The instruction was true and impossible to follow:
// the only number was in the footer, below the timeline, the search form and the whole order card. Same
// for the cancelled notice — "hubungi kami lewat WhatsApp", with nothing to tap.
//
// The rule is adjacency, and it is derived from the SENTENCES rather than from a list of statuses: if a
// line this page can show tells the reader to message us, the way to message us is beside it.
process.env.TZ = 'Asia/Jakarta';

import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { invitesWhatsApp } from './contactPrompt.js';
import { MESSAGES } from '../i18n/messages.js';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
// Comments first: a comment quoting the sentence has defeated a text check in this repo five times.
const stripComments = (source) => source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '').replace(/\{\/\*[\s\S]*?\*\/\}/g, '');
const read = (...parts) => stripComments(readFileSync(join(root, ...parts), 'utf8'));

// --- 1. The question itself ------------------------------------------------------------------------------
assert.equal(invitesWhatsApp('tanya lewat WhatsApp kalau kamu butuh sekarang'), true);
assert.equal(invitesWhatsApp('message us on WhatsApp if you need it now'), true);
assert.equal(invitesWhatsApp('Paket sudah diterima. Terima kasih sudah memesan SOLIVAGANT.'), false,
  'a sentence that asks nothing must not summon a button');
assert.equal(invitesWhatsApp(''), false);
assert.equal(invitesWhatsApp(null), false);
// Mentioning WhatsApp is not asking for it. Both of these are real sentences in the shop: one describes
// how overseas orders work, the other labels a field for the BUYER's own number. A rule that demanded a
// chat button beside them would be a rule nobody keeps.
assert.equal(invitesWhatsApp('an order from abroad is arranged on WhatsApp'), false);
assert.equal(invitesWhatsApp('Nomor WhatsApp wajib diisi.'), false);

// --- 2. Every lead this page can open with, read from the module that picks them --------------------------
const leadKeys = [...new Set([...read('utils', 'trackingLead.js').matchAll(/'(track\.[\w.]+)'/g)].map((m) => m[1]))];
assert.ok(leadKeys.length >= 5, 'describeOrderKey must still choose between the order states');
for (const key of [...leadKeys, 'track.cancelledNotice']) {
  for (const language of ['id', 'en']) {
    assert.ok(MESSAGES[language][key], `${language}.${key} is missing — the page would print the key itself`);
  }
}

// --- 3. Adjacency: wherever such a sentence is rendered, the link is rendered too --------------------
// Every buyer surface, not just the page that was caught. Walking the render sites means a new page, or
// a new sentence on an old page, is covered the day it is written. Measured when this was widened: eight
// message keys in the shop actually ask the reader to message us, printed on three files, and every one
// of them passes — so the rule starts honest rather than with a list of exceptions.
const surfaces = [];
for (const dir of [['pages'], ['pages', 'mobile'], ['components', 'storefront']]) {
  for (const name of readdirSync(join(root, ...dir))) {
    if (name.endsWith('.jsx')) surfaces.push([...dir, name]);
  }
}
const WINDOW = 500;
const AFFORDANCE = /<AskAtelierButton|<OverseasInquiryButton|buildWhatsAppCheckoutUrl|wa\.me/;

let guarded = 0;
for (const parts of surfaces) {
  const source = read(...parts);
  const rel = parts.join('/');
  for (const site of source.matchAll(/t\((?:'([\w.]+)'|describeOrderKey\([^)]*\))\)/g)) {
    const keys = site[1] ? [site[1]] : leadKeys;
    const asks = keys.some((key) => ['id', 'en'].some((language) => invitesWhatsApp(MESSAGES[language][key])));
    if (!asks) continue;
    guarded += 1;
    // Both directions: HomePage puts the label INSIDE the link, so its href is written above the
    // sentence rather than below it. Adjacency is what matters, not which side it fell on.
    assert.match(source.slice(Math.max(0, site.index - WINDOW), site.index + WINDOW), AFFORDANCE,
      `${rel}: ${site[0]} can print a sentence telling the buyer to message us, and no way to do it `
      + 'follows it — the footer is not beside the sentence');
  }
}
assert.ok(guarded >= 3, `the scan found only ${guarded} asking sentence(s) — it is no longer looking at the right thing`);

// --- 3b. The account page, where WhatsApp is help again and not the checkout ------------------------------
// INVERTED, with the reason kept. This used to require both buttons to be labelled "arrange an
// international order", because the English shop took no orders and a reader abroad had nowhere else to
// go. /en has a checkout now, so that label sent the buyer down the slower path this project replaced —
// and it sat under a hero sentence that told them the same untrue thing.
//
// The buttons stay, because an account page with no way to reach a person is its own defect. What
// changed is the errand: they ask a question now instead of taking an order, and they belong to both
// shops, because a buyer in Jakarta may also want to reach a human from this page.
const portal = read('pages', 'CustomerPortalPage.jsx');
// BOTH heroes. The page returns a different tree for /mobile, and the first version of this shipped to
// the desktop one only — measured on production: /en/customer on a phone redirects to /en/mobile/customer
// and had no WhatsApp link at all, which is the surface nearly every overseas reader is on. The phone
// hero does not even carry the sentence about arranging an order, so nothing would have complained.
const portalButtons = [...portal.matchAll(/<AskAtelierButton[\s\S]{0,240}?\/>/g)].map((m) => m[0]);
assert.equal(portalButtons.length, 2,
  `the account page has a phone tree and a desktop tree; found ${portalButtons.length} contact button(s), expected one in each`);
for (const button of portalButtons) {
  assert.doesNotMatch(button, /labelKey="intl\.noticeCta"/,
    'the account page still labels its contact button as the way to arrange an international order. The '
    + 'checkout takes the order; this button is how you reach a person');
}
assert.equal((portal.match(/\{isInternational \? \(\s*<AskAtelierButton/g) || []).length, 0,
  'the contact button is gated on the shop again — reaching a person is not an international-only need');

// --- 4. The button keeps its promise ---------------------------------------------------------------------
const button = read('components', 'storefront', 'AskAtelierButton.jsx');
assert.match(button, /buildWhatsAppCheckoutUrl/, 'it opens WhatsApp');
assert.match(button, /if \(!phoneNumber\) return null;/,
  'and disappears when no number is configured — a chat with nobody is worse than no button');
assert.match(button, /'track\.waDraft'/, 'the draft comes from the message file, in the shop\'s language');
assert.match(button, /\{ order: orderNumber \}/,
  'and names the order, so the first thing the atelier reads is the number it needs');
for (const language of ['id', 'en']) {
  assert.match(MESSAGES[language]['track.waDraft'], /\{order\}/, `${language} draft must carry the order number`);
  assert.ok(MESSAGES[language]['track.askAtelier'], `${language}.track.askAtelier is missing`);
  assert.ok(MESSAGES[language]['track.waDraftNoOrder'], `${language}.track.waDraftNoOrder is missing`);
}

console.log('contactPrompt selfcheck OK (an instruction to message us always arrives with the way to do it)');
