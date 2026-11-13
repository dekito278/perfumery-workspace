// `node src/utils/storefrontRegion.selfcheck.mjs`
//
// Which shop a visitor is looking at used to be decided entirely by guessing at their browser. The guess
// is a good one — a German customer has a German browser — but it could not be argued with: Dekito could
// not see the international shop from Indonesia, a VPN does not change it (a VPN moves the IP, not
// the clock or the language), and a visitor read wrong had no way to say so.
//
// Then the visitor could choose, and the choice won. Since 2026-11-02 the ADDRESS decides — /en/... is the
// English shop, every other address the Indonesian one — because a stored choice and the guess could turn
// /catalog/l-iris English for a US browser, the one Google crawls with: English words and US$95 on an
// address declared hreflang="id", with two canonicals and two prices. Dekito chose "alamat = bahasa".
process.env.TZ = 'Asia/Jakarta';

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { MESSAGES } from '../i18n/messages.js';
import {
  REGION_EN,
  REGION_ID,
  isValidRegion,
  resolveRegion,
  readRegionFromUrl,
  readRegionFromPath,
  regionHref,
  routerBasename,
  barePathname,
} from './storefrontRegion.js';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const stripComments = (source) => source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '').replace(/\{\/\*[\s\S]*?\*\/\}/g, '');
const read = (...parts) => stripComments(readFileSync(join(root, ...parts), 'utf8'));

// --- 1. The address decides, for everyone -------------------------------------------------------------------
assert.equal(resolveRegion('/en/catalog/l-iris'), REGION_EN, 'the English address is the English shop');
assert.equal(resolveRegion('/en'), REGION_EN);
for (const indonesian of ['/catalog/l-iris', '/', '/home', '/english', '/catalog/english-oak', '']) {
  assert.equal(resolveRegion(indonesian), REGION_ID, `${JSON.stringify(indonesian)} is the Indonesian shop, whatever the browser`);
}
assert.equal(resolveRegion.length, 1, 'one input — the address. A second one is how the guess got its say back');
assert.equal(isValidRegion('ID'), false, 'regions are lowercase; a stray case is not a region');

// --- 2. Nothing but the address reaches the answer -----------------------------------------------------------
const util = read('utils', 'storefrontRegion.js');
const hook = read('hooks', 'useStorefrontRegion.js');
assert.doesNotMatch(`${util}\n${hook}`, /localStorage|detectOverseasVisitor|navigator\./,
  'no stored choice and no guess — either one turns an Indonesian address English for somebody, Googlebot included');

// --- 3. One shared answer, not one per component ------------------------------------------------------------
// Each component resolving its own would let the header say Indonesia while the price panel says
// international, and the two would disagree for a whole page view.
assert.match(hook, /const listeners = new Set\(\);/, 'one value, published to every subscriber');
{
  const effectAt = hook.indexOf('useEffect(() => {');
  assert.notEqual(effectAt, -1, 'the region is still resolved in an effect');
  const effectBody = hook.slice(effectAt, hook.indexOf('}, []);', effectAt));
  assert.match(effectBody, /const here = resolveRegion\(\);[\s\S]*?publish\(here\)/, 'the address is read and published');
  // ?lang links were sent abroad for weeks. They move to the address that IS that shop; they no longer
  // turn the address they arrived on into the other language.
  assert.match(effectBody, /asked && asked !== here \? regionHref\(asked\) : null;[\s\S]{0,80}?window\.location\.replace\(href\)/,
    'an old ?lang=en link lands on the /en address');
}
// The first render is in the address's shop, because each address's prerendered HTML already is: starting
// Indonesian on /en flashed Indonesian and the domestic price notice, then shifted the header (2026-11-02).
assert.match(hook, /let current = typeof window === 'undefined' \? REGION_ID : resolveRegion\(\);/,
  'the first render reads the address — Indonesia only where there is no window to read');
assert.equal(readRegionFromUrl('?lang=en'), 'en', 'the parameter is read');
assert.equal(readRegionFromUrl('?lang=zz'), null, 'a value we do not have is no answer at all');
assert.equal(readRegionFromUrl('?utm_source=ig'), null, 'and an address without it is no answer either');

// --- 4c. The English shop has its OWN ADDRESS, not just its own parameter ---------------------------------
// ?lang=en made the shop shareable. It could not make it *previewable*: one prerendered HTML file carries
// one title, one description and one og:image, so /catalog/hug-n-1?lang=en handed WhatsApp and Instagram
// the Indonesian card — a link sent abroad previewing in a language its reader does not read. /en/... is
// a second file, so it can say its own English words, and Google can index it as its own page.
assert.equal(readRegionFromPath('/en'), REGION_EN, 'the English shop is at /en');
assert.equal(readRegionFromPath('/en/catalog/hug-n-1'), REGION_EN, 'and everything under it');
assert.equal(readRegionFromPath('/catalog'), null, 'the Indonesian shop keeps the bare paths');
for (const notEn of ['/english', '/end', '/enterprise', '/', '', '/id/en']) {
  assert.equal(readRegionFromPath(notEn), null, `${JSON.stringify(notEn)} is not the English shop`);
}
// The prefix reaches the 68 <Link to="/..."> through the router, not through 68 edits. If this stops
// being the basename, every link inside the English shop silently drops back to the Indonesian one.
assert.equal(routerBasename('/en/catalog'), '/en');
assert.equal(routerBasename('/catalog'), '');
{
  const at = (pathname, search = '') => ({ pathname, search, hash: '' });
  assert.equal(regionHref(REGION_EN, at('/catalog/hug-n-1')), '/en/catalog/hug-n-1', 'the switch crosses to the twin page');
  assert.equal(regionHref(REGION_ID, at('/en/catalog/hug-n-1')), '/catalog/hug-n-1', 'and back to it');
  assert.equal(regionHref(REGION_EN, at('/')), '/en', 'the home page has a twin too');
  assert.equal(regionHref(REGION_ID, at('/en')), '/', 'and it comes back');
  assert.equal(regionHref(REGION_EN, at('/en/catalog')), null, 'already there is not a navigation');
  // ?lang is dropped on the way across: the path says which shop this is, and an address carrying both
  // would argue with itself the moment someone copied it.
  assert.equal(regionHref(REGION_EN, at('/catalog', '?lang=id&sort=new')), '/en/catalog?sort=new',
    'the parameter goes, the rest of the query stays');
  assert.equal(regionHref('zz', at('/catalog')), null, 'a region we do not have is not an address');
  // Only at the FRONT. A plain .replace('/en','') would eat the middle of /catalog/english-oak and send
  // the visitor to a product that does not exist — from a switch that looked like it worked.
  assert.equal(regionHref(REGION_EN, at('/catalog/english-oak')), '/en/catalog/english-oak',
    'a slug that happens to contain /en is not a prefix');
  assert.equal(regionHref(REGION_ID, at('/en/catalog/english-oak')), '/catalog/english-oak',
    'and only the leading one comes off on the way back');
}
assert.equal(barePathname('/en/mobile/home'), '/mobile/home', 'the router sees the route, not the address');
assert.equal(barePathname('/mobile/home'), '/mobile/home');
assert.equal(barePathname('/en'), '/');
assert.equal(barePathname('/english'), '/english', 'not every path starting with those letters is the prefix');
assert.equal(barePathname('/catalog/english-oak'), '/catalog/english-oak', 'and never the middle of one');
// Switching shops is a NAVIGATION, not a re-render: the router's basename is fixed at mount, so a
// client-side switch would leave every link in the page pointing at the other shop.
{
  const setterAt = hook.indexOf('setRegion: (next)');
  assert.notEqual(setterAt, -1, 'the switch still hands back a setter');
  const setterBody = hook.slice(setterAt);
  assert.match(setterBody, /regionHref\(next\)[\s\S]{0,260}?window\.location\.assign\(/,
    'the switch takes the visitor to the other shop\'s address');
}

// And the router is actually mounted under it. Without this the /en addresses still LOAD — the SPA
// fallback serves them — but the router matches /en/catalog against no route and the visitor gets the
// 404 page at an address that works, which is the kind of break that looks like a content problem.
{
  const app = read('App.jsx');
  assert.match(app, /const ROUTER_BASENAME = routerBasename\(\);/,
    'the basename is read once at module scope, not per render');
  assert.match(app, /createBrowserRouter\([\s\S]{0,200}?\{ basename: ROUTER_BASENAME \}/,
    'and handed to the router, or every /en address renders the 404 page');
}

// --- 4d. Every robots.txt rule needs its /en twin --------------------------------------------------------
// robots.txt matches from the START of the path, so "Disallow: /checkout" says nothing about
// /en/checkout. The /mobile tree already fell into this trap once. Enforced as the mirror rather than as
// a list, so a rule added later cannot ship with its English half missing.
{
  const robots = readFileSync(join(root, '..', 'public', 'robots.txt'), 'utf8');
  const rules = robots
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => /^(Allow|Disallow): \//.test(line) && line !== 'Allow: /');
  assert.ok(rules.length > 8, 'robots.txt still lists the private paths');
  const present = new Set(rules);
  for (const rule of rules) {
    const [verb, path] = rule.split(': ');
    if (path.startsWith('/en/') || path === '/en') continue;
    assert.ok(present.has(`${verb}: /en${path}`),
      `robots.txt covers ${path} but not /en${path} — the English shop would expose it`);
  }
}

// --- 5. The price panel follows the REGION, not the raw guess ---------------------------------------------------
const priceHook = read('hooks', 'useOverseasPrice.js');
assert.match(priceHook, /const \{ isInternational: overseasVisitor \} = useStorefrontRegion\(\);/,
  'the export price panel reads the chosen region');
assert.doesNotMatch(priceHook, /detectOverseasVisitor/,
  'and no longer detects for itself — the guess reaches it only through the region');

// --- 6. A control, not a gate ---------------------------------------------------------------------------------
// A question before the shop costs visitors who would have looked, and an Indonesian who taps
// "international" by mistake is shown prices 3,5x higher and leaves.
const widget = read('components', 'storefront', 'RegionSwitch.jsx');
assert.doesNotMatch(widget, /Dialog|Modal|overlay|fixed inset-0/,
  'the switch must never become a gate in front of the shop');
assert.match(widget, /aria-pressed=\{region === option\.value\}/, 'the current choice is announced, not just coloured');
assert.match(widget, /aria-label=\{t\('region\.label'\)\}/, 'the switch is labelled from the message file');
// Both labels name BOTH languages, because this is the one control a reader of either has to find while
// the rest of the page is in the other one.
assert.match(MESSAGES.id['region.label'], /Wilayah harga/);
assert.match(MESSAGES.id['region.label'], /Pricing region/);
assert.match(MESSAGES.en['region.label'], /Pricing region/);
assert.match(MESSAGES.en['region.label'], /Wilayah harga/);

// On both storefronts. Desktop and mobile drifting apart is this repo's commonest defect, and a switch on
// one of them teaches the visitor the other surface has no choice.
assert.match(read('components', 'storefront', 'PublicHeader.jsx'), /<RegionSwitch /, 'in the desktop header');
// The phone's own header retired with the phone storefront (2026-10-31): the header above is the phone's too.

// --- The boot screen, before the bundle arrives -----------------------------------------------------------
// index.html paints #root synchronously, before React mounts: what every visitor sees while a slow phone
// fetches the bundle, and the recovery screen if it never arrives. Until 2026-11-03 a shop visitor got
// Studio's "APP INITIALIZATION / Loading workspace / Menyiapkan halaman…" over a sidebar skeleton, in
// Indonesian on the English shop too, while a per-route table of headlines beside it (guarded here, and
// never shown) still promised "Pre-order 7-14 hari". The shell's own functions are RUN against a fake page,
// so this fails on what a visitor sees and not on the spelling.
const shell = readFileSync(join(root, '..', 'index.html'), 'utf8');
const bootSource = shell.match(/var EN_PREFIX[\s\S]*?(?=\n\t*renderPublicBootFallback\(\);)/);
const recoverySource = shell.match(/function renderManualRecovery\(\) \{[\s\S]*?\n\t\t\t\t\}/);
assert.ok(bootSource && recoverySource, 'the boot screen could not be found in index.html — the derivation broke');
const bootAt = (pathname, { shop, noscript = '' }) => {
  const page = { innerHTML: '', querySelector: (selector) => (selector === 'noscript' && noscript ? { textContent: noscript } : null) };
  // Enough of an element for the boot script to read a heading and a lead out of the <noscript> markup.
  const createElement = () => ({
    html: '',
    set innerHTML(value) { this.html = value; },
    querySelector(selector) {
      const found = selector === 'h1' ? this.html.match(/<h1>([\s\S]*?)<\/h1>/) : this.html.match(/class="app-boot-description">([\s\S]*?)<\/p>/);
      return found ? { innerHTML: found[1] } : null;
    },
  });
  const fakeDocument = { getElementById: () => page, createElement, documentElement: { classList: { contains: (name) => shop && name === 'boot-shop' } } };
  const run = new Function('window', 'document', `${bootSource[0]}\n${recoverySource[0]}\n`
    + 'renderPublicBootFallback(); var boot = arguments[2].innerHTML; renderManualRecovery();'
    + ' return { boot: boot, recovery: arguments[2].innerHTML };');
  const html = run({ location: { pathname } }, fakeDocument, page);
  const text = (markup) => markup.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
  return { boot: text(html.boot), recovery: text(html.recovery) };
};
for (const path of ['/home', '/en/home', '/en/catalog/hug-n-1', '/cart']) {
  assert.equal(bootAt(path, { shop: true }).boot, 'SOLIVAGANT',
    `${path} must open on the shop's wordmark alone — no Studio words, nothing in the other shop's language`);
}
// Fifth audit, 13 Nov 2026: a prerendered page shows its own headline and lead under the wordmark while the
// bundle loads — the words the build wrote for it, in its language. The second line ("needs JavaScript") is not.
const prerendered = '<main class="app-boot-fallback" aria-label="SOLIVAGANT" data-boot-page><div><h1>Koleksi</h1>'
  + '<p class="app-boot-description">Objek parfum terbatas.</p><p class="app-boot-description">Toko ini butuh JavaScript.</p></div></main>';
assert.equal(bootAt('/catalog', { shop: true, noscript: prerendered }).boot, 'SOLIVAGANT Koleksi Objek parfum terbatas.',
  'a prerendered page says where the buyer is while it loads');
assert.equal(bootAt('/catalog', { shop: true, noscript: prerendered.replace(' data-boot-page', '') }).boot, 'SOLIVAGANT',
  'and only a page the build marked as its own — the generic shell keeps the wordmark alone');
assert.match(bootAt('/studio', { shop: false }).boot, /Memuat Studio/, 'the Studio keeps its own boot screen');
assert.match(bootAt('/en/catalog', { shop: true }).recovery, /^The page did not load/, 'the English shop recovers in English');
assert.doesNotMatch(bootAt('/en/catalog', { shop: true }).recovery, /Cache perlu|berhasil/, 'with no Indonesian in it');
assert.match(bootAt('/catalog', { shop: true }).recovery, /^Cache perlu direset/, 'and the Indonesian shop in Indonesian');

// EN_PREFIX in the shell is a copy — plain script cannot import the module that owns it.
const ownedPrefix = readFileSync(join(root, '..', 'tools', 'seo-artifacts.mjs'), 'utf8')
  .match(/export const EN_PREFIX = '([^']+)'/)[1];
assert.match(shell, new RegExp(`var EN_PREFIX = '${ownedPrefix}';`),
  `the shell's copy of EN_PREFIX has drifted from tools/seo-artifacts.mjs ('${ownedPrefix}')`);

console.log('storefrontRegion selfcheck OK (the address decides the shop for everyone; the switch moves between addresses and is never a gate)');
