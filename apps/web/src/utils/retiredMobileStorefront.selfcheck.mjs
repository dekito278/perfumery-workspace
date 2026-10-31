// `node src/utils/retiredMobileStorefront.selfcheck.mjs`
//
// The phone storefront retired on 2026-10-31 (one responsive shop). Its addresses live on in messages
// already sent, parcel QR codes and installed home-screen icons, so each one must land on the page it
// meant — and the Studio's phone screens must not be swept up with them.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { fromRetiredMobileStorefront, toMobilePath } from './deviceRouting.js';

const cases = {
  '/mobile': '/home',
  '/mobile/dashboard': '/home',
  '/mobile/home': '/home',
  '/mobile/catalog': '/catalog',
  '/mobile/articles': '/journal',
  '/mobile/products/maskumambang': '/catalog/maskumambang',
  '/mobile/articles/gaharu-abc': '/articles/gaharu-abc',
  '/mobile/cart': '/cart',
  '/mobile/checkout': '/checkout',
  '/mobile/payment': '/payment',
  '/mobile/bespoke': '/bespoke',
  '/mobile/customer': '/customer',
  '/mobile/welcome': '/welcome',
  '/mobile/about': '/about',
  '/mobile/customer/invoice/DKT-1': '/customer/invoice/DKT-1',
};
for (const [from, to] of Object.entries(cases)) {
  assert.equal(fromRetiredMobileStorefront(from), to, `${from} must land on ${to}`);
}
for (const studio of ['/mobile/studio', '/mobile/studio/orders/1', '/mobile/login', '/mobile/formulas', '/mobile/journal/new']) {
  assert.equal(fromRetiredMobileStorefront(studio), null, `${studio} is a Studio screen and must not be redirected`);
}

// A phone opening the shop stays on the shop's own address now.
for (const shop of ['/', '/home', '/catalog', '/catalog/maskumambang', '/cart', '/checkout', '/bespoke', '/journal', '/customer']) {
  assert.equal(toMobilePath(shop), null, `${shop} must no longer send a phone to a /mobile twin`);
}
assert.equal(toMobilePath('/studio/orders'), '/mobile/studio/orders', 'the Studio keeps its phone screens');

// Every retired address is still a route, so the redirect is reachable at all.
const app = readFileSync(join(dirname(fileURLToPath(import.meta.url)), '..', 'App.jsx'), 'utf8');
for (const from of ['/mobile', '/mobile/dashboard', '/mobile/catalog', '/mobile/products/:slug', '/mobile/articles/:slug', '/mobile/cart', '/mobile/checkout', '/mobile/payment', '/mobile/customer', '/mobile/customer/invoice/:orderNumber']) {
  const line = app.split('\n').find((entry) => entry.includes(`path="${from}"`));
  assert.ok(line, `App.jsx has no route for ${from}`);
  assert.match(line, /<RetiredMobileStorefront \/>/, `${from} must redirect, not render a page`);
}
console.log(`retiredMobileStorefront selfcheck OK (${Object.keys(cases).length} old phone addresses land on their page; the Studio keeps its own)`);
