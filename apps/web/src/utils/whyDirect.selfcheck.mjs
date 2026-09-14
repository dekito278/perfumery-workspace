// `node src/utils/whyDirect.selfcheck.mjs`
//
// The greeting card in every parcel sends buyers to this site. Once they arrive, this is what tells them
// why to buy here rather than go back to the marketplace: one data source, one component, two homes, and
// the atelier's WhatsApp reachable from the footer of every page.
//
// The number lives in ONE place. A second copy is how the collaboration button on the home page came to
// hardcode it — and a hardcoded number is one SIM change away from sending buyers to a stranger.
process.env.TZ = 'Asia/Jakarta';

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { readdirSync } from 'node:fs';
import { WHY_DIRECT_REASONS, whyDirectReasons } from '../data/whyDirect.js';
import { MESSAGES } from '../i18n/messages.js';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const stripComments = (source) => source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '').replace(/\{\/\*[\s\S]*?\*\/\}/g, '');
const read = (...parts) => stripComments(readFileSync(join(root, ...parts), 'utf8'));

// --- 1. The reasons ------------------------------------------------------------------------------------
assert.ok(WHY_DIRECT_REASONS.length >= 3 && WHY_DIRECT_REASONS.length <= 5, 'three to five reasons — fewer is thin, more is a list nobody reads');

// The copy moved into the message file; what stays here is the shape and the destinations. Every reason
// is checked in BOTH languages, because the English is the half Dekito cannot proofread as easily.
for (const region of ['id', 'en']) {
  for (const reason of whyDirectReasons(region)) {
    assert.ok(reason.key && reason.titleKey && reason.bodyKey && reason.ctaKey,
      `${reason.key || '?'}: every reason has a key, title, body and cta`);
    for (const key of [reason.titleKey, reason.bodyKey, reason.ctaKey]) {
      assert.ok(MESSAGES[region][key], `${region}.${key} must exist — a missing one renders a raw key on the home page`);
    }
    assert.ok(reason.whatsapp || String(reason.to || '').startsWith('/'), `${reason.key}: a reason links somewhere, or is the WhatsApp one`);
    const copy = MESSAGES[region][reason.titleKey] + MESSAGES[region][reason.bodyKey];
    assert.doesNotMatch(copy, /\d{9,}/, `${region}.${reason.key}: no phone number in the copy — the number has one source`);
    assert.doesNotMatch(copy, /shopee|tokopedia|lazada|tiktok shop/i, `${region}.${reason.key}: never name a marketplace`);
    assert.doesNotMatch(copy, /\d+\s*%|\d+ ?persen|termurah|cheapest/i, `${region}.${reason.key}: never a number, never a superlative`);
  }
}

// The Indonesian first card offers the member price and leads to the account.
const idReasons = whyDirectReasons('id');
assert.ok(idReasons.some((r) => r.key === 'member' && r.to === '/customer'), 'the member price reason must lead to the account');
assert.match(MESSAGES.id[idReasons[0].bodyKey], /di bawah marketplace/, 'the strongest true claim — prices below the marketplace — must be made');

// The English one cannot. An international order does not get the member discount — outside Indonesia the
// price is the export price and signing in does not lower it — so this card must neither promise one nor
// send the reader to a sign-in that does nothing for them. This is a money promise, so it is asserted.
const enFirst = whyDirectReasons('en')[0];
assert.notEqual(enFirst.to, '/customer', 'the English first card must not lead to a sign-in that changes nothing for them');
assert.doesNotMatch(MESSAGES.en[enFirst.bodyKey] + MESSAGES.en[enFirst.titleKey], /member|discount/i,
  'nor promise a member price an international order cannot get');
assert.doesNotMatch(MESSAGES.en[enFirst.bodyKey], /below the marketplace|cheaper than/i,
  'and it must not repeat a marketplace claim that is about Indonesian listings');

assert.ok(WHY_DIRECT_REASONS.some((r) => r.whatsapp === true), 'the WhatsApp reason must exist');
assert.equal(new Set(WHY_DIRECT_REASONS.map((r) => r.key)).size, WHY_DIRECT_REASONS.length, 'keys are unique (they are React keys)');

// --- 2. One component, both homes ----------------------------------------------------------------------
const comp = read('components', 'storefront', 'WhyBuyDirect.jsx');
assert.match(comp, /getStorefrontWhatsAppNumber\(\)/, 'the number comes from the one source');
assert.match(comp, /filter\(\(reason\) => !reason\.whatsapp \|\| whatsapp\)/, 'the WhatsApp card is hidden when no number is configured');
assert.match(comp, /to=\{`\$\{prefix\}\$\{reason\.to\}`\}/, 'links are prefixed for the phone');
assert.match(comp, /whyDirectReasons\(region\)/, 'the component asks for the reasons of the shop being read');
assert.doesNotMatch(comp, /\d{9,}/, 'no hardcoded number in the component');
assert.match(read('pages', 'HomePage.jsx'), /<WhyBuyDirect \/>/, 'desktop home renders it');
assert.match(read('pages', 'mobile', 'MobileStorefrontPage.jsx'), /<WhyBuyDirect mobile \/>/, 'phone home renders it, as mobile');

// --- 3. The footer reaches the atelier, from the same source -------------------------------------------
const footer = read('components', 'storefront', 'StorefrontFooter.jsx');
assert.match(footer, /const whatsapp = getStorefrontWhatsAppNumber\(\);/, 'footer reads the one source');
assert.match(footer, /whatsapp \? \(\s*<a href=\{`https:\/\/wa\.me\/\$\{whatsapp\}`\}/, 'and renders the link only when configured');
assert.match(footer, /\{ labelKey: 'nav\.account', to: '\/customer' \}/, 'the account is reachable from the footer too');
assert.doesNotMatch(footer, /\d{9,}/, 'no hardcoded number in the footer');

// --- 4. The home page no longer carries its own copy of the number --------------------------------------
const home = read('pages', 'HomePage.jsx');
assert.doesNotMatch(home, /wa\.me\/\d/, 'the collaboration button must build its link from the shared source, not a literal number');
assert.match(home, /buildWhatsAppCheckoutUrl\(t\('home\.collabMessage'\)\)/, 'and still say what the chat is about');
// In the language the visitor was reading when they pressed it: someone who has just read an English
// page and gets an Indonesian draft has to translate their own message before they can send it, which is
// where most of them stop.
assert.match(MESSAGES.id['home.collabMessage'], /Halo Dekito/);
assert.match(MESSAGES.en['home.collabMessage'], /Hello Dekito/);

// --- 5. data-reveal only where something will reveal it ------------------------------------------------
// [data-reveal] starts a section at opacity 0. The desktop home has a useScrollReveal container; the phone
// home does not, and the safety net only rescues what is already on screen at 1.2/3/6 s. A section below
// the fold on the phone therefore stayed invisible for good — found live, from computed style, after this
// had shipped. Fourth time for this class of bug (see revealSafetyNet.js for the first three).
assert.match(comp, /data-reveal=\{mobile \? undefined : true\}/, 'the phone variant must not start hidden — nothing on that page would reveal it');

// Generalised: no page under pages/mobile may put data-reveal on anything but a LineDivider (which observes
// itself) unless the page has a useScrollReveal container.
const mobileDir = join(root, 'pages', 'mobile');
const offenders = [];
for (const name of readdirSync(mobileDir)) {
  if (!/\.jsx$/.test(name)) continue;
  const text = read('pages', 'mobile', name);
  const nonDividerReveals = text.split('\n').filter((line) => /data-reveal/.test(line) && !/LineDivider|LineMark/.test(line));
  if (nonDividerReveals.length && !/useScrollReveal\(/.test(text)) offenders.push(name);
}
assert.deepEqual(offenders, [], `these phone pages hide sections with data-reveal but have no useScrollReveal container to show them again: ${offenders.join(', ')}`);

console.log('whyDirect selfcheck OK (one set of reasons on both homes; the atelier number has one source)');
