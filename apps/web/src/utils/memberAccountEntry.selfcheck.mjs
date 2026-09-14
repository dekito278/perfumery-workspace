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

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const stripComments = (source) => source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '').replace(/\{\/\*[\s\S]*?\*\/\}/g, '');
const read = (...parts) => stripComments(readFileSync(join(root, ...parts), 'utf8'));

// --- 1. Desktop header: one door, on every page, that changes with the session ----------------------
const header = read('components', 'storefront', 'PublicHeader.jsx');
assert.match(header, /useAuth\(\)/, 'the header must know whether the visitor is signed in');
assert.match(header, /to="\/customer"[\s\S]{0,400}?aria-label=\{currentUser \? 'Akun member' : 'Masuk untuk harga member'\}/,
  'the header must link to the account, labelled "Masuk untuk harga member" when signed out and "Akun member" when in');
assert.match(header, /\{ label: 'Akun member', to: '\/customer' \}/, 'the mega menu must list the account too');
assert.match(header, /Lacak Pesanan/, 'tracking stays available — it just stops being the only door');

// --- 2. Phone nav: "Akun", not "Cek Order" -------------------------------------------------------------
const mobileNav = read('layouts', 'MobileCommerceLayout.jsx');
assert.match(mobileNav, /\{ path: '\/mobile\/customer', label: 'Akun', icon: UserRound \}/, 'the phone tab must be "Akun"');
assert.doesNotMatch(mobileNav, /Cek Order/, '"Cek Order" framed the account as tracking; it must not come back');

// --- 3. The portal sells the price, not the code ------------------------------------------------------
const portal = read('pages', 'CustomerPortalPage.jsx');
assert.equal((portal.match(/Masuk dengan Google — harga member/g) || []).length, 2,
  'both sign-in buttons (desktop and phone) must say what signing in is for');
assert.doesNotMatch(portal, /Dashboard tampil di sini/, 'the empty state must not describe a dashboard nobody asked for');
assert.equal((portal.match(/Harga member menunggu/g) || []).length, 2, 'both empty states must lead with the price');
assert.doesNotMatch(portal, /'Masukkan kode SOLI', 'Kode muncul setelah checkout pertama/, 'step one is signing in, not typing a code');

// --- 4. "Harga member aktif" is a claim, so it comes from the server-resolved tier -----------------------
assert.match(portal, /const \{ tier: priceTier \} = useTierPrices\(\);/, 'the badge must read the tier the server resolved');
assert.match(portal, /const memberActive = priceTier === 'member' \|\| priceTier === 'reseller';/,
  'and must not be inferred from merely being signed in');
assert.match(portal, /memberActive \? <span[^>]*>Harga member aktif<\/span> : null/, 'the badge is gated on it');

console.log('memberAccountEntry selfcheck OK (a door to the account on every page, framed around the price)');
