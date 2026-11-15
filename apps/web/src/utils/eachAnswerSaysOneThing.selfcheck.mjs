// `node src/utils/eachAnswerSaysOneThing.selfcheck.mjs`
//
// Eleventh visitor audit, 15 Nov 2026, the last group:
//  B4  — the bespoke form said one refusal per tap: four empty fields, four taps. All at once now (see
//        bespokeSaysItBesideTheField for the mechanics).
//  B5  — the help page's Contact button read "Tanya soal paketmu" — a parcel question, for any question.
//  B6  — the English cart told buyers to check the recipient's name, address and phone "are correct", in
//        fields that no longer exist since ordering moved to WhatsApp; and the draft asked for name and
//        address, not the phone the courier needs.
//  B11 — the answers said tracking is on WhatsApp, the help page said order number; and the English help
//        sent buyers to an order-number lookup for orders that never get one.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { MESSAGES } from '../i18n/messages.js';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const read = (...parts) => readFileSync(join(root, ...parts), 'utf8');
const { id, en } = MESSAGES;

assert.match(read('pages', 'BespokePage.jsx'), /const validateAll = \(\) => \{/);

const help = read('pages', 'HelpPage.jsx');
assert.match(help, /<AskAtelierButton className="justify-self-start" labelKey="help\.contactCta" \/>/);
assert.match(id['help.contactCta'] + en['help.contactCta'], /WhatsApp.*WhatsApp/);
assert.match(help, /isInternational \? \(\s*<>\s*<p className="m-0">\{t\('help\.track'\)\}<\/p>\s*<AskAtelierButton/, 'the English help links to a lookup it cannot use');
assert.doesNotMatch(en['help.track'], /order number/i);

for (const lang of [id, en]) {
  assert.match(lang['intlQuote.recipient'], /WhatsApp/, 'the recipient note must point at the message, not at fields');
  for (const key of ['export.waCartDraft', 'export.waCartAsk']) assert.match(lang[key], /(nomor telepon saya|phone number):\n$/, key);
}
assert.match(id['answers.trackingA'], /WhatsApp/);
assert.match(id['answers.trackingA'], /nomor order/, 'the answer and the help page say the same about tracking');
console.log('eachAnswerSaysOneThing selfcheck OK (all refusals at once, a chat button, one story about tracking)');
