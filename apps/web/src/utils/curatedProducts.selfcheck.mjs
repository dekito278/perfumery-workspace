// `node src/utils/curatedProducts.selfcheck.mjs`
//
// Both homes took the first N of the catalogue and the mapper forced the first three to read as featured,
// so the featured flag set in Studio decided nothing — "pilihan" was whatever sorted first, and all 18
// products carried a flag that had never been seen to do anything.
process.env.TZ = 'Asia/Jakarta';

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { MESSAGES } from '../i18n/messages.js';
import { CURATED_LIMIT_DESKTOP, CURATED_LIMIT_MOBILE, hasCuration, pickCuratedProducts } from './curatedProducts.js';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const stripComments = (source) => source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '').replace(/\{\/\*[\s\S]*?\*\/\}/g, '');
const read = (...parts) => stripComments(readFileSync(join(root, ...parts), 'utf8'));

const p = (slug, featured) => ({ slug, featured });
const catalog = [p('a', false), p('b', true), p('c', false), p('d', true), p('e', true), p('f', false), p('g', true), p('h', true), p('i', true), p('j', true)];

// --- 1. The flag is the curation --------------------------------------------------------------------
assert.deepEqual(pickCuratedProducts(catalog, 4).map((x) => x.slug), ['b', 'd', 'e', 'g'], 'flagged products, in catalogue order, capped');
assert.deepEqual(pickCuratedProducts(catalog, 6).map((x) => x.slug), ['b', 'd', 'e', 'g', 'h', 'i'], 'the cap is the cap');
assert.deepEqual(pickCuratedProducts(catalog, 100).map((x) => x.slug), ['b', 'd', 'e', 'g', 'h', 'i', 'j'], 'never more than are flagged');
assert.ok(pickCuratedProducts(catalog, 4).every((x) => x.featured === true), 'an unflagged product must not appear while flagged ones exist');

// --- 2. Nothing flagged: never an empty home, but honestly not a curation ---------------------------------
const none = catalog.map((x) => ({ ...x, featured: false }));
assert.deepEqual(pickCuratedProducts(none, 4).map((x) => x.slug), ['a', 'b', 'c', 'd'], 'fall back to the first N so the home is never empty');
assert.equal(hasCuration(none), false, 'and say so');
assert.equal(hasCuration(catalog), true);

// --- 3. Only a literal true counts ------------------------------------------------------------------------
const loose = [{ slug: 'x', featured: 'yes' }, { slug: 'y', featured: 1 }, { slug: 'z', featured: true }];
assert.deepEqual(pickCuratedProducts(loose, 3).map((x) => x.slug), ['z'], 'the mapper hands a boolean; anything else is not a flag');

// --- 4. Edges ----------------------------------------------------------------------------------------------
assert.deepEqual(pickCuratedProducts([], 4), []);
assert.deepEqual(pickCuratedProducts(undefined, 4), []);
assert.deepEqual(pickCuratedProducts(catalog, 0), [], 'a cap of zero shows nothing');
assert.deepEqual(pickCuratedProducts(catalog, 'abc'), [], 'garbage cap shows nothing rather than everything');
assert.ok(CURATED_LIMIT_DESKTOP >= 4 && CURATED_LIMIT_DESKTOP <= 6, 'desktop shows a curation, not the catalogue');
assert.ok(CURATED_LIMIT_MOBILE >= 2 && CURATED_LIMIT_MOBILE <= 4, 'the phone shows fewer');

// --- 5. The mapper carries the real flag, not a forced one -------------------------------------------------
const mapper = read('data', 'publicStorefront.js');
assert.match(mapper, /featured: Boolean\(product\.featured\),/, 'featured must be the flag as set in Studio');
assert.doesNotMatch(mapper, /index < 3/, 'the first three must not be forced to featured — that is what made the flag meaningless');

// --- 6. Both homes use the picker, with their own caps -------------------------------------------------------
const home = read('pages', 'HomePage.jsx');
assert.match(home, /pickCuratedProducts\(publicCatalog, CURATED_LIMIT_DESKTOP\)/, 'desktop home must curate by the flag');
assert.doesNotMatch(home, /publicCatalog\.slice\(0, 8\)/, 'and not take the first eight');
const mobile = read('pages', 'mobile', 'MobileStorefrontPage.jsx');
assert.match(mobile, /pickCuratedProducts\(publicCatalog, CURATED_LIMIT_MOBILE\)/, 'phone home must curate by the flag');
assert.doesNotMatch(mobile, /publicCatalog\.slice\(0, 4\)/, 'and not take the first four');

// --- 7. The hero says why, and offers the way in — on both homes, following the session -----------------
// The hero line moved into the message file when the storefront learned English. Both surfaces must
// still carry a reason to buy here, and the second CTA must still follow the session.
assert.match(home, /\{t\('home\.note'\)\}/, 'desktop hero must give the reason to buy here');
assert.match(mobile, /\{t\('home\.note'\)\}/, 'phone hero must give the reason too');
assert.match(MESSAGES.id['home.note'], /Harga member, langsung dari atelier\./, 'and in Indonesian it is the member price');
// In English it cannot be the member price: an international order does not get one. It still has to say
// something — a hero with no reason is the state this guard was written to prevent.
assert.doesNotMatch(MESSAGES.en['home.note'], /member/i, 'the English hero must not promise a member price');
assert.ok(MESSAGES.en['home.note'].length > 20, 'but it must still give a reason to buy here');

assert.match(home, /to="\/customer"[\s\S]{0,240}?\{t\(currentUser \? 'nav\.account' : 'nav\.accountSub'\)\.toUpperCase\(\)\}/, 'desktop hero second CTA follows the session');
assert.match(home, /\{t\('home\.seeCollection'\)\}/, 'the original CTA stays — the reason is added, not swapped in');
assert.match(mobile, /to="\/mobile\/customer"[\s\S]{0,240}?\{t\(currentUser \? 'nav\.account' : 'nav\.accountSub'\)\}/, 'phone hero second CTA follows the session');

console.log('curatedProducts selfcheck OK (the featured flag decides the home; the hero says why to buy here)');
