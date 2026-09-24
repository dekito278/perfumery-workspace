// `node src/utils/memberAccountEntry.selfcheck.mjs`
//
// The account had one door on the storefront: "Lacak Pesanan" in the menu, "Cek Order" on the phone —
// both framed as tracking, which is what an account DOES, not why anyone opens one. The reason is the
// price. This guard holds the door open on every storefront page and keeps the portal talking about the
// price rather than about codes.
//
// Structural throughout: there is no pure logic here, only copy and wiring, and the thing that regresses
// is somebody putting "Cek Order" back.
process.env.TZ = 'Asia/Jakarta';

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { MESSAGES } from '../i18n/messages.js';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const stripComments = (source) => source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '').replace(/\{\/\*[\s\S]*?\*\/\}/g, '');
const read = (...parts) => stripComments(readFileSync(join(root, ...parts), 'utf8'));

// --- 1. Desktop header: one door, on every page, that changes with the session ----------------------
const header = read('components', 'storefront', 'PublicHeader.jsx');
assert.match(header, /useAuth\(\)/, 'the header must know whether the visitor is signed in');
// The labels moved into the message file when the storefront learned English. What still has to hold is
// that the header link CHANGES with the session — an "Akun member" label shown to a signed-out visitor
// hides the reason to sign in, which is the whole point of the link.
assert.match(header, /to="\/customer"[\s\S]{0,400}?aria-label=\{t\(currentUser \? 'nav\.account' : 'nav\.accountSub'\)\}/,
  'the header must link to the account, labelled "Masuk untuk harga member" when signed out and "Akun member" when in');
assert.match(header, /\{ labelKey: 'nav\.account', to: '\/customer' \}/, 'the mega menu must list the account too');
assert.match(header, /labelKey: 'nav\.trackOrder'/, 'tracking stays available — it just stops being the only door');
// Both labels have to exist in both languages, or the English header shows a raw key where the reason
// to sign in should be.
for (const key of ['nav.account', 'nav.accountSub', 'nav.trackOrder']) {
  assert.ok(MESSAGES.id[key] && MESSAGES.en[key], `${key} exists in both languages`);
}
assert.match(MESSAGES.id['nav.accountSub'], /harga member/, 'and the Indonesian one still names the price');

// --- 2. Phone nav: "Akun", not "Cek Order" -------------------------------------------------------------
const mobileNav = read('layouts', 'MobileCommerceLayout.jsx');
assert.match(mobileNav, /\{ path: '\/mobile\/customer', labelKey: 'nav\.accountShort', icon: UserRound \}/, 'the phone tab must be the account');
assert.match(MESSAGES.id['nav.accountShort'], /Akun/, 'and it is still called "Akun" in Indonesian');
assert.doesNotMatch(mobileNav, /Cek Order/, '"Cek Order" framed the account as tracking; it must not come back');

// --- 3. The portal sells the price, not the code ------------------------------------------------------
// The sentences moved into the message file when the account page learned English, so the guard now
// checks the WIRING on the page and the WORDS in the messages — the pair is what the buyer reads.
const portal = read('pages', 'CustomerPortalPage.jsx');
assert.equal((portal.match(/\{t\('cust\.signInMember'\)\}/g) || []).length, 2,
  'both sign-in buttons (desktop and phone) must say what signing in is for');
assert.match(MESSAGES.id['cust.signInMember'], /harga member/, 'and the Indonesian button still names the price');
// The English half of this rule ENDED when the English shop stopped having a checkout. A member price
// cannot be spent there — there is no cart and no catalogue checkout — so naming it on the button is
// selling something the shop cannot hand over. The Indonesian shop still can, and still does.
assert.doesNotMatch(MESSAGES.en['cust.signInMember'], /member price/i,
  'the English button offers a member price the English shop has no way to charge');
assert.doesNotMatch(portal, /Dashboard tampil di sini/, 'the empty state must not describe a dashboard nobody asked for');
assert.equal((portal.match(/t\('cust\.memberWaiting'\)/g) || []).length, 2, 'both empty states must lead with the price');
assert.match(MESSAGES.id['cust.memberWaiting'], /Harga member/, 'and that empty state is about the price in Indonesian');
assert.doesNotMatch(MESSAGES.en['cust.memberWaiting'], /Member price/i,
  'the English empty state still leads with a price that cannot be spent in that shop');

// --- 3b. The English portal may offer the cart, and may not offer the member price ---------------------
// This rule is INVERTED, not deleted, and the reason it used to read the other way is the point.
//
// It used to forbid any English message from mentioning the cart at all: "every promise on this page has
// to survive a shop with no checkout". That was true for months. It stopped being true when /en got a
// cart and a checkout, and the rule outlived its premise — which is how the reorder button ended up
// hidden from returning overseas customers, and the cart icon hidden from the whole English header,
// long after both worked.
//
// What survives is the half that was always about money rather than about plumbing: a member price is a
// domestic loyalty price and cannot be charged on an order going abroad. So an English message may
// mention the cart freely, and may mention a member price only while saying where it applies.
for (const [key, value] of Object.entries(MESSAGES.en)) {
  if (!key.startsWith('cust.') || !/member price/i.test(value)) continue;
  assert.match(value, /Indonesia/i,
    `${key} names a member price without saying it is Indonesian: "${value}" — an overseas reader takes `
    + 'it as a discount on the order they are about to place');
}
assert.doesNotMatch(portal, /'Masukkan kode SOLI', 'Kode muncul setelah checkout pertama/, 'step one is signing in, not typing a code');

// --- 4. "Harga member aktif" is a claim, so it comes from the server-resolved tier -----------------------
assert.match(portal, /const \{ tier: priceTier \} = useTierPrices\(\);/, 'the badge must read the tier the server resolved');
assert.match(portal, /const memberActive = priceTier === 'member' \|\| priceTier === 'reseller';/,
  'and must not be inferred from merely being signed in');
assert.match(portal, /memberActive \? <span[^>]*>\{t\('cust\.memberActive'\)\}<\/span> : null/, 'the badge is gated on it');
assert.match(MESSAGES.id['cust.memberActive'], /Harga member aktif/, 'and the badge still says the member price is on');

// --- 5. The hero and the tab title are the FIRST thing on the page, and they lead too ------------------
// Found from a live screenshot after the rest had shipped: the empty state below said "harga member" while the
// hero above it still said "Cek order dengan kode unik" and the tab read "Cek Order". A page that changes its
// mind halfway down is read as the thing it says first.
assert.doesNotMatch(portal, /Cek order dengan kode unik/, 'the hero must not lead with tracking');
assert.doesNotMatch(portal, /<title>Cek Order - Solivagant<\/title>/, 'the tab title must not call the account "Cek Order"');
assert.equal((portal.match(/<title>\{t\('cust\.tab'\)\}<\/title>/g) || []).length, 2, 'both variants title the page as the member account');
assert.match(MESSAGES.id['cust.tab'], /Akun Member/, 'and the tab is named for the account, not for tracking');
assert.match(portal, /\{t\('cust\.heroTitle'\)\}/, 'the hero leads with what signing in does to the price');
assert.match(MESSAGES.id['cust.heroTitle'], /harga member/, 'and says so in Indonesian');
// English leads with what the account DOES there instead: following an order. A member price is real,
// and it is real in Indonesia — not because the English shop has no checkout (it has one), but because
// the discount is a domestic loyalty price that deliberately does not travel.
assert.doesNotMatch(MESSAGES.en['cust.heroTitle'], /member price/i,
  'the English hero opens on a member price that does not apply to the order it is about to take');
assert.match(MESSAGES.en['cust.heroBody'], /Indonesia/i,
  'and must say where a member price does apply, rather than leaving it unexplained');
assert.match(MESSAGES.en['cust.heroBody'], /do not apply|does not apply|not apply/i,
  'and must say plainly that it does not apply to an order going abroad');
// The sentence that used to live here said an order from abroad is arranged on WhatsApp. It is not any
// more, and nothing on this page may say so: the checkout takes it.
assert.doesNotMatch(MESSAGES.en['cust.heroBody'], /arranged on WhatsApp/i,
  'the account page still tells an overseas reader their order happens on WhatsApp — it happens at the '
  + 'checkout, and pointing them at the slower path is the thing this project replaced');
// The rule is that someone holding an old code is still told the box is down there — not the wording.
// Pinned to the sentence, this failed the day the label was corrected: the field resolves the CUSTOMER
// code (SOLI...), and calling it an order code is what sent buyers holding DKT-... into a dead end.
assert.match(MESSAGES.id['cust.heroBody'], /[Kk]ode customer lama/, 'and still points the code-holder somewhere');
assert.match(MESSAGES.id['cust.heroBody'], /di bawah/, 'saying where the box is');

console.log('memberAccountEntry selfcheck OK (a door to the account on every page — framed around the price in the shop the discount applies to, and around the order everywhere else))');
