// `node src/utils/welcomeLanding.selfcheck.mjs`
//
// The greeting card in every parcel points at the site. /welcome is where it should point: one screen
// that thanks the buyer, says what signing in gives them, and offers the way in — on desktop and on the
// phone, which is where most cards get opened.
//
// Its copy claims exactly one thing about price: the member price. Whether the shop is cheaper than the
// marketplace has not been checked, and a landing page that lies once is not believed twice.
process.env.TZ = 'Asia/Jakarta';

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { isMobileCommercePath } from './mobileFirstScreen.js';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const stripComments = (source) => source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '').replace(/\{\/\*[\s\S]*?\*\/\}/g, '');
const read = (...parts) => stripComments(readFileSync(join(root, ...parts), 'utf8'));

// --- 1. Reachable on both surfaces, and a phone opening the desktop URL lands on the phone page -----------
const app = read('App.jsx');
assert.match(app, /<Route path="\/welcome" element=\{<WelcomePage \/>\} \/>/, 'desktop route');
assert.match(app, /<Route path="\/mobile\/welcome" element=\{<WelcomePage mobile \/>\} \/>/, 'phone route');
assert.match(app, /'\/welcome',\n\s*'\/track',/, '/welcome is a storefront route, so its loading fallback is the storefront one');
assert.match(read('utils', 'deviceRouting.js'), /\[\/\^\\\/welcome\$\/, '\/mobile\/welcome'\]/, 'a phone that opens the card URL must be sent to the phone page');
assert.equal(isMobileCommercePath('/mobile/welcome'), true, 'the phone page gets the wordmark splash, not "Loading workspace"');

// --- 2. The page itself ---------------------------------------------------------------------------------
const page = read('pages', 'WelcomePage.jsx');
assert.match(page, /<meta name="robots" content="noindex,follow" \/>/, 'a door for card holders is not a page to be found');
assert.match(page, /Masuk dengan Google — harga member/, 'the way in says what it is for');
assert.match(page, /loginWithGoogle\(`\$\{window\.location\.origin\}\$\{mobile \? '\/mobile\/customer' : '\/customer'\}`\)/, 'signing in lands on the account, on the right surface');
assert.match(page, /currentUser \? \(/, 'a buyer already signed in is not asked to sign in again');
assert.match(page, /<WhyBuyDirect mobile \/>/, 'the reasons come from the one shared source on the phone');
assert.match(page, /<WhyBuyDirect \/>/, 'and on desktop');
assert.match(page, /useScrollReveal\(\)/, 'the desktop shell has a reveal container — WhyBuyDirect carries data-reveal on desktop');

// --- 3. Price claims: true, as policy, never as a number or a name ---------------------------------------
// Dekito confirmed on 2026-09-15 that his marketplace listings are priced above the shop's retail, so
// "below the marketplace" is a true statement of policy. It stays a statement: a percentage goes stale the
// day a listing changes, and naming a competitor in a price claim is a legal and tone risk.
assert.match(page, /di bawah marketplace/, 'the verified claim is made — it is the strongest true thing the page can say');
assert.doesNotMatch(page, /shopee|tokopedia|lazada|tiktok shop/i, 'never name a marketplace in a price claim');
assert.doesNotMatch(page, /\d+\s*%|\d+ ?persen|termurah/i, 'never a number, never a superlative — those go stale or cannot be proven');
assert.doesNotMatch(page, /\d{9,}/, 'no phone number on the page; WhyBuyDirect carries the one source');

console.log('welcomeLanding selfcheck OK (a door for the card, on both surfaces, claiming only what is true)');
