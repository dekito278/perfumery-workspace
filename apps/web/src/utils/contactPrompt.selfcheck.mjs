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
import { readFileSync } from 'node:fs';
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

// --- 2. Every lead this page can open with, read from the module that picks them --------------------------
const leadKeys = [...new Set([...read('utils', 'trackingLead.js').matchAll(/'(track\.[\w.]+)'/g)].map((m) => m[1]))];
assert.ok(leadKeys.length >= 5, 'describeOrderKey must still choose between the order states');
for (const key of [...leadKeys, 'track.cancelledNotice']) {
  for (const language of ['id', 'en']) {
    assert.ok(MESSAGES[language][key], `${language}.${key} is missing — the page would print the key itself`);
  }
}

// --- 3. Adjacency: where such a sentence is rendered, the link is rendered too ----------------------------
// Walk the page's own render sites instead of naming them. A new one gets the rule for free.
const page = read('pages', 'PublicTrackingPage.jsx');
const WINDOW = 500;
const sites = [...page.matchAll(/t\((?:'(track\.[\w.]+)'|describeOrderKey\([^)]*\))\)/g)];
assert.ok(sites.length >= 2, 'expected the hero lead and the cancelled notice to be found');

let guarded = 0;
for (const site of sites) {
  const keys = site[1] ? [site[1]] : leadKeys;
  const asks = keys.some((key) => ['id', 'en'].some((language) => invitesWhatsApp(MESSAGES[language][key])));
  if (!asks) continue;
  guarded += 1;
  const after = page.slice(site.index, site.index + WINDOW);
  assert.match(after, /<AskAtelierButton/,
    `${site[0]} can print a sentence telling the buyer to message us, and no way to do it follows it — `
    + 'the footer is not beside the sentence');
}
assert.ok(guarded >= 2, 'both the lead and the cancelled notice must be covered by the rule');

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
