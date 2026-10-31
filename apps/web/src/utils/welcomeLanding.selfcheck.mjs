// `node src/utils/welcomeLanding.selfcheck.mjs`
//
// The greeting card in every parcel points at the site. /welcome is where it should point: one screen
// that thanks the buyer, says what signing in gives them, and offers the way in — on desktop and on the
// phone, which is where most cards get opened.
//
// Its copy claims two things about price, and both are held below: the member price, and that the shop
// is already under the marketplace. The second one was checked — Dekito confirmed on 2026-09-15 that his
// marketplace listings sit above the shop's retail — and it stays a statement of policy rather than a
// number or a name, for the reasons written beside the assertion. A landing page that lies once is not
// believed twice, so what it may say is pinned rather than trusted.
process.env.TZ = 'Asia/Jakarta';

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { MESSAGES } from '../i18n/messages.js';
import { fromRetiredMobileStorefront, toMobilePath } from './deviceRouting.js';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const stripComments = (source) => source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '').replace(/\{\/\*[\s\S]*?\*\/\}/g, '');
const read = (...parts) => stripComments(readFileSync(join(root, ...parts), 'utf8'));

// --- 1. One page for every screen; the old phone address still lands on it -----------------------------
const app = read('App.jsx');
assert.match(app, /<Route path="\/welcome" element=\{<WelcomePage \/>\} \/>/, 'desktop route');
// The phone storefront retired on 2026-10-31. Cards printed before that carry the old address, so it has
// to keep landing on the page rather than on a 404.
assert.match(app, /<Route path="\/mobile\/welcome" element=\{<RetiredMobileStorefront \/>\} \/>/, 'the old phone address redirects');
assert.equal(fromRetiredMobileStorefront('/mobile/welcome'), '/welcome', 'and it redirects to the welcome page');
assert.match(app, /'\/welcome',\n\s*'\/track',/, '/welcome is a storefront route, so its loading fallback is the storefront one');
assert.equal(toMobilePath('/welcome'), null, 'a phone that opens the card URL stays on the one responsive page');

// --- 2. The page itself ---------------------------------------------------------------------------------
const page = read('pages', 'WelcomePage.jsx');
assert.match(page, /const \{ t \} = useTranslate\(\);/, 'the page reads its copy from the message file');
assert.match(page, /<meta name="robots" content="noindex,follow" \/>/, 'a door for card holders is not a page to be found');
// The copy now lives in the message file, because this page speaks two languages. The rules below
// therefore check the MESSAGES, not the JSX — a claim moved into a data file is a claim that escaped
// its guard unless the guard follows it.
assert.match(MESSAGES.id['welcome.signIn'], /harga member/, 'the Indonesian way in says what it is for');
// On the right surface AND in the right shop. Built from the origin alone, an English visitor who
// signed in from /en/welcome came back to the Indonesian /customer, leaving the /en address behind.
assert.match(page, /loginWithGoogle\(\s*`\$\{window\.location\.origin\}\$\{shopPrefixForRegion\(region\)\}\/customer`/,
  'signing in lands on the account, in the shop the visitor came from');
assert.match(page, /currentUser \? \(/, 'a buyer already signed in is not asked to sign in again');
assert.match(page, /<WhyBuyDirect \/>/, 'the reasons come from the one shared source');
assert.match(page, /useScrollReveal\(\)/, 'the page has a reveal container — WhyBuyDirect carries data-reveal');

// --- 3. Price claims: true, as policy, never as a number or a name ---------------------------------------
// Dekito confirmed on 2026-09-15 that his marketplace listings are priced above the shop's retail, so
// "below the marketplace" is a true statement of policy. It stays a statement: a percentage goes stale the
// day a listing changes, and naming a competitor in a price claim is a legal and tone risk.
assert.match(MESSAGES.id['welcome.lead'], /di bawah marketplace/,
  'the verified claim is made — it is the strongest true thing the page can say');

// Every rule below now has to hold in BOTH languages. The English copy is a second place the same claim
// could go wrong, and it is the one Dekito cannot proofread as easily.
for (const language of ['id', 'en']) {
  for (const key of Object.keys(MESSAGES[language]).filter((k) => k.startsWith('welcome.'))) {
    const text = MESSAGES[language][key];
    assert.doesNotMatch(text, /shopee|tokopedia|lazada|tiktok shop/i, `${language}.${key}: never name a marketplace in a price claim`);
    assert.doesNotMatch(text, /termurah|cheapest|lowest price/i, `${language}.${key}: never a superlative — it cannot be proven`);
    assert.doesNotMatch(text, /\d{9,}/, `${language}.${key}: no phone number; WhyBuyDirect carries the one source`);
  }
}
// A percentage goes stale the day a price changes. The Indonesian page says "harga member" without a
// figure on purpose; the English one must not introduce one.
for (const key of Object.keys(MESSAGES.en).filter((k) => k.startsWith('welcome.'))) {
  assert.doesNotMatch(MESSAGES.en[key], /\d+\s*%/, `en.${key}: never a number in a price claim`);
}
assert.doesNotMatch(MESSAGES.id['welcome.lead'], /\d+\s*%|\d+ ?persen/, 'nor the Indonesian lead');
assert.doesNotMatch(page, /\d{9,}/, 'no phone number hardcoded in the page either');

console.log('welcomeLanding selfcheck OK (a door for the card, on both surfaces, claiming only what is true)');
