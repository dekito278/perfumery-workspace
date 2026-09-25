// `node src/utils/studioReachable.selfcheck.mjs`
//
// A screen with a route and no way in is a screen nobody uses.
//
// The export shipping calculator is where an international order gets written down — the only screen in
// Studio that can do it. It shipped with a desktop route and a mobile route and NO menu entry on either
// side, so the only way to open it was to type the URL. Dekito went looking for it in the E-commerce
// sheet on his phone, found Produk, Orders, Fulfillment, Customer, Bespoke, Vouchers, Ongkir, Journal,
// Toko — and no calculator. A live international enquiry was waiting while he looked.
//
// The rule is not "these two menu objects contain these two strings". It is: wherever the router renders
// this page, a navigation menu on that side must point at it — and every path a menu points at must be a
// route. Move the page, rename the path, re-order the menus: this check follows. Drop it out of the menu
// and it fails.
process.env.TZ = 'Asia/Jakarta';

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
// A comment quoting the very expression being searched for has defeated a text check in this repo five
// times. Comments go first, every time.
const stripComments = (source) => source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '').replace(/\{\/\*[\s\S]*?\*\/\}/g, '');
const read = (...parts) => stripComments(readFileSync(join(root, ...parts), 'utf8'));

const app = read('App.jsx');
const desktopNav = read('components', 'AppShell.jsx');
const mobileNav = read('components', 'mobile', 'MobileBottomNavigation.jsx');

// --- 1. Where the router puts the calculator — read from the router, never listed by hand ---------------
const calculatorRoutes = [...app.matchAll(/<Route\s+path="([^"]+)"[\s\S]{0,200}?<ExportShippingCalculatorPage\b/g)]
  .map((match) => match[1]);
assert.ok(calculatorRoutes.length >= 2, 'the router must still render the export calculator on a desktop and a mobile route');

const mobileRoutes = calculatorRoutes.filter((path) => path.startsWith('/mobile'));
const desktopRoutes = calculatorRoutes.filter((path) => !path.startsWith('/mobile'));
assert.ok(mobileRoutes.length >= 1 && desktopRoutes.length >= 1, 'the calculator must stay reachable on both phone and desktop');

// --- 2. Every routed calculator screen is in the menu of its own side -----------------------------------
// The whole file is searched, not one named array: the menus get restructured, and a check that knows
// their shape fails on the day someone splits a group in two, which is not the rule.
for (const path of desktopRoutes) {
  assert.ok(desktopNav.includes(`'${path}'`), `desktop nav has no entry for ${path} — typing the URL is not navigation`);
}
for (const path of mobileRoutes) {
  assert.ok(mobileNav.includes(`'${path}'`), `mobile nav has no entry for ${path} — typing the URL is not navigation`);
}

// --- 3. And the reverse: a menu entry that is not a route is a 404 with a nice icon ---------------------
// The catch-all is dropped on purpose: it matches every string, so with it in the list a menu entry
// pointing at a path nobody renders would "match" the 404 route and pass.
const routePaths = [...app.matchAll(/<Route\s+path="([^"]+)"/g)].map((match) => match[1]).filter((route) => !route.endsWith('*'));
const matchesRoute = (path) => routePaths.some((route) => new RegExp(`^${route.replace(/:[^/]+/g, '[^/]+')}$`).test(path));
const navPaths = [...`${desktopNav}\n${mobileNav}`.matchAll(/path:\s*'(\/[^']*)'/g)].map((match) => match[1]);
assert.ok(navPaths.length > 20, 'the two navigation menus should still list the whole of Studio');
for (const path of navPaths) {
  assert.ok(matchesRoute(path), `menu points at ${path}, which the router does not render`);
}

// --- 4. Sabotage: the checks must fail when the menu entry is taken away --------------------------------
const withoutMobileEntry = mobileNav.replace(new RegExp(`'${mobileRoutes[0]}'`, 'g'), "'/mobile/studio/orders'");
assert.ok(!withoutMobileEntry.includes(`'${mobileRoutes[0]}'`), 'sabotage must actually remove the mobile entry');
const withoutDesktopEntry = desktopNav.replace(new RegExp(`'${desktopRoutes[0]}'`, 'g'), "'/studio/orders'");
assert.ok(!withoutDesktopEntry.includes(`'${desktopRoutes[0]}'`), 'sabotage must actually remove the desktop entry');
// And when a menu points somewhere the router does not go.
assert.ok(!matchesRoute('/studio/export-shipping-typo'), 'a path with no route must not pass as routed');

console.log('studioReachable selfcheck OK —', calculatorRoutes.join(', '), 'reachable from both menus;', navPaths.length, 'menu entries all routed');
