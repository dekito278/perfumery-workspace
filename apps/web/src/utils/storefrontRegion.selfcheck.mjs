// `node src/utils/storefrontRegion.selfcheck.mjs`
//
// Which shop a visitor is looking at used to be decided entirely by guessing at their browser. The guess
// is a good one — a German customer has a German browser — but it could not be argued with: Dekito could
// not see his own international shop from Indonesia, a VPN does not change it (a VPN moves the IP, not
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
assert.match(hook, /let current = REGION_ID;/,
  'until that effect runs the answer is Indonesia, which is what the prerendered HTML already says');
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
  assert.match(app, /<Router basename=\{ROUTER_BASENAME\}>/,
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

// --- The boot screen must know the English shop exists too ---------------------------------------------
// index.html renders a per-route fallback synchronously, before React mounts — it is what every visitor
// sees while the bundle arrives, and all they ever see if it never does. It looked routes up by their
// literal pathname, so every /en address fell through to the "Page not found" default: 66 of them are in
// the live sitemap, hreflang-twinned and prerendered. The visitors told the shop does not exist were the
// overseas ones, on the slowest connections it serves.
//
// The shell's own resolver is RUN here rather than matched as text, so this fails on the behaviour and
// not on the spelling.
const shell = readFileSync(join(root, '..', 'index.html'), 'utf8');
const resolverSource = shell.match(/var EN_PREFIX[\s\S]*?\n\t*function getBootLinks\(\)[\s\S]*?\n\t\t\t\t\}/);
assert.ok(resolverSource, 'the boot fallback resolver could not be found in index.html — the derivation broke');
const resolveBoot = new Function('pathname',
  `${resolverSource[0]}; window = { location: { pathname: pathname } };`
  + ' return { content: getFallbackContent(), links: getBootLinks() };');

// EN_PREFIX in the shell is a copy — plain script cannot import the module that owns it.
const ownedPrefix = readFileSync(join(root, '..', 'tools', 'seo-artifacts.mjs'), 'utf8')
  .match(/export const EN_PREFIX = '([^']+)'/)[1];
assert.match(shell, new RegExp(`var EN_PREFIX = '${ownedPrefix}';`),
  `the shell's copy of EN_PREFIX has drifted from tools/seo-artifacts.mjs ('${ownedPrefix}')`);

// Derived from the routes the shop actually advertises, so a route added later is covered by being added
// there — the same list build.mjs checks against App.jsx before a deploy can ship a link to a 404.
const advertised = readFileSync(join(root, '..', 'tools', 'seo-artifacts.mjs'), 'utf8')
  .match(/STATIC_PUBLIC_ROUTES = \[([^\]]*)\]/)[1]
  .match(/'([^']+)'/g).map((entry) => entry.replace(/'/g, ''));
assert.ok(advertised.length >= 4, `only ${advertised.length} advertised routes parsed — the derivation broke`);

const lost = [];
for (const route of [ownedPrefix, ...advertised.map((r) => `${ownedPrefix}${r}`), `${ownedPrefix}/catalog/hug-n-1`]) {
  const { content, links } = resolveBoot(route);
  if (/not found/i.test(content.title)) lost.push(`${route}: "${content.title}"`);
  // And the way out has to stay inside the shop the visitor is in. Linking an English visitor to
  // /catalog hands them the Indonesian shop as the fix for a page that was never missing.
  for (const link of links) {
    assert.ok(link.href.startsWith(`${ownedPrefix}/`),
      `the boot screen on ${route} links to ${link.href}, which leaves the English shop`);
  }
}
assert.deepEqual(lost, [],
  'the boot screen tells these English visitors their page does not exist, while the bundle is still on '
  + `its way:\n  ${lost.join('\n  ')}`);

// The must-pass half: a genuinely unknown path still says so, and the Indonesian shop still links home.
const unknown = resolveBoot('/tidak-ada-halaman-ini');
assert.match(unknown.content.title, /not found/i, 'a real 404 must still read as one');
assert.equal(resolveBoot('/catalog').links[0].href, '/catalog',
  'and an Indonesian visitor must not be sent into the English shop');

console.log('storefrontRegion selfcheck OK (the address decides the shop for everyone; the switch moves between addresses and is never a gate)');
