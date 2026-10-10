// `node src/utils/buyerLinksStayInTheirShop.selfcheck.mjs`
//
// The English shop lives under /en: routerBasename() returns '/en' there and '' in the Indonesian one
// and in Studio. React Router adds it to every <Link to>, so only RAW absolute links — href={...} and
// window.open(...) — have to carry it themselves.
//
// buildPublicTrackingUrl did not. It was origin + path, so the English portal and the English invoice
// handed an English customer solivagantscent.com/track/<code>: a valid route, in Indonesian. /track is
// one of the storefront prefixes mounted under /en, so the English page exists and simply was never
// linked to. productShareUrl, built for the same job on the product page, has taken a basename from the
// start — this is the sibling that never got one.
//
// Latent rather than live: all 35 orders this shop has taken came from the Indonesian storefront, so
// nobody has been sent to the wrong language yet. The portal is the one screen where an international
// buyer would meet it first.
process.env.TZ = 'Asia/Jakarta';

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { Buffer } from 'node:buffer';
import { EN_PATH_PREFIX, routerBasename } from './storefrontRegion.js';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const stripComments = (source) => source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '').replace(/\{\/\*[\s\S]*?\*\/\}/g, '');
const read = (...parts) => stripComments(readFileSync(join(root, ...parts), 'utf8'));

// ── 1. The builder, run ──────────────────────────────────────────────────────────────────────────
// publicTrackingService imports the supabase client, which cannot load outside a browser build, so the
// two pure builders are lifted out and executed. The same shim pattern readyToPack uses.
const serviceSource = readFileSync(join(root, 'services', 'publicTrackingService.js'), 'utf8');
const lifted = [
  serviceSource.match(/const normalizeLookup[\s\S]*?;\n/)?.[0],
  serviceSource.match(/export const buildPublicTrackingPath[\s\S]*?\n};\n/)?.[0],
  serviceSource.match(/export const buildPublicTrackingUrl[\s\S]*?\n};\n/)?.[0],
];
assert.ok(lifted.every(Boolean), "could not lift the tracking URL builders — this guard's parse is broken");
// BOTH branches, because the function has two and only one of them runs in the shop.
//
// The first version of this guard ran the builder with no `window`, so it only ever exercised the
// server branch. Deleting ${basename} from the BROWSER branch — the one every buyer meets — walked
// straight past it. A test that covers the branch nobody runs is not a test.
const loadBuilder = async (origin) => {
  const stub = origin === null
    ? "const routerBasename = () => '';\nconst window = undefined;\n"
    : `const routerBasename = () => '';\nconst window = { location: { origin: ${JSON.stringify(origin)} } };\n`;
  const module = await import(
    `data:text/javascript;base64,${Buffer.from(stub + lifted.join('\n'), 'utf8').toString('base64')}`
  );
  return module.buildPublicTrackingUrl;
};

const ORIGIN = 'https://www.solivagantscent.com';
for (const [label, origin, prefix] of [['in the browser', ORIGIN, ORIGIN], ['on the server', null, '']]) {
  const build = await loadBuilder(origin);
  assert.equal(build('DKT-ABC', { basename: EN_PATH_PREFIX }), `${prefix}/en/track/DKT-ABC`,
    `${label}: the English shop's tracking link must stay in the English shop`);
  assert.equal(build('DKT-ABC', { basename: '' }), `${prefix}/track/DKT-ABC`,
    `${label}: and the Indonesian one must not grow a prefix`);
  assert.equal(build('DKT-ABC'), `${prefix}/track/DKT-ABC`,
    `${label}: the default is the reader's own shop — '' in Studio and in the Indonesian storefront`);
  assert.equal(build(''), `${prefix}/track`,
    `${label}: no order number still goes to the lookup form`);
  // Encoded exactly once, whatever the basename.
  assert.equal(build('DKT ABC', { basename: EN_PATH_PREFIX }), `${prefix}/en/track/DKT%20ABC`,
    `${label}: the order code must be encoded once`);
}

// ── 2. The builder asks for the reader's shop by default ─────────────────────────────────────────
assert.match(
  serviceSource,
  /buildPublicTrackingUrl = \(orderNumber = '', \{ basename = routerBasename\(\) \} = \{\}\)/,
  'buildPublicTrackingUrl must default to the basename of the shop the reader is standing in',
);
assert.match(
  serviceSource,
  /^import \{ routerBasename \} from '@\/utils\/storefrontRegion\.js';$/m,
  'and take it from the one function that knows which shop that is',
);

// ── 3. /track really is mounted in the English shop ──────────────────────────────────────────────
// The link would be a 404 rather than a translation if it were not, so the premise is checked instead
// of assumed.
const app = read('App.jsx');
const prefixes = app.match(/const storefrontRoutePrefixes = \[([\s\S]*?)\n\];/);
assert.ok(prefixes, "could not find the storefront route prefixes — this guard's parse is broken");
assert.ok(
  [...prefixes[1].matchAll(/'([^']+)'/g)].map((match) => match[1]).includes('/track'),
  '/track is not mounted in the English shop, so a /en/track link would 404 — mount it or stop linking there',
);
assert.equal(routerBasename('/en/catalog'), EN_PATH_PREFIX, 'routerBasename must still read the shop off the path');
assert.equal(routerBasename('/catalog'), '', 'and answer empty for the Indonesian one');

// ── 4. No buyer-facing page may hand out a raw link built without a basename ─────────────────────
// The subject is read from the code: every raw href/window.open on a buyer's screen whose value comes
// from a *Url( builder. Each such builder has to be one that takes a basename.
const BUYER_PAGES = ['pages/CustomerPortalPage.jsx', 'pages/CustomerInvoicePage.jsx', 'pages/PublicProductDetailPage.jsx'];
const BASENAME_AWARE = ['buildPublicTrackingUrl', 'productShareUrl'];
let rawLinks = 0;
for (const file of BUYER_PAGES) {
  const source = read(...file.split('/'));
  for (const match of source.matchAll(/(?:href=\{|window\.open\()\s*(\w+Url)\(/g)) {
    rawLinks += 1;
    assert.ok(
      BASENAME_AWARE.includes(match[1]),
      `${file} hands a buyer a raw link from ${match[1]}(), which does not take a basename — an English `
      + 'customer would be sent to the Indonesian shop',
    );
  }
}
assert.ok(rawLinks >= 2, `only ${rawLinks} raw buyer links found — the scan is broken, not the pages`);

console.log(`buyerLinksStayInTheirShop: ok — ${rawLinks} raw buyer links, every one of them basename-aware`);
