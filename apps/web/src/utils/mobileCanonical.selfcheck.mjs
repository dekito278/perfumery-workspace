// `node src/utils/mobileCanonical.selfcheck.mjs`
//
// The mobile storefront was a SECOND set of URLs for the same shop, and Google crawls mobile-first, so
// its crawler landed on the duplicate rather than on the prerendered page the sitemap advertises.
// Measured on the live site with an iPhone user agent: /mobile/dashboard, /mobile/catalog and
// /mobile/products/<slug> carried NO canonical and NO robots meta.
//
// The phone storefront retired on 2026-10-31. A canonical on a page that no longer renders would be
// nothing, so the duplicate is closed the stronger way: every old address answers 308 at the edge with
// the page it always meant. What this holds:
//
//   1. every /mobile path robots.txt opens to crawlers is permanently redirected in vercel.json, in both
//      shops — a crawlable path that rendered the SPA shell would be the duplicate again;
//   2. each redirect lands where the router's own mapping lands, so the edge and the app cannot disagree;
//   3. no redirect reaches a Studio screen, and the mobile tree stays closed to crawlers by default.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { fromRetiredMobileStorefront } from './deviceRouting.js';

const webRoot = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const read = (...p) => readFileSync(join(webRoot, ...p), 'utf8');

const { redirects = [] } = JSON.parse(read('vercel.json'));
// path-to-regexp, the subset vercel.json uses here: :name and :name(a|b).
const toRegex = (source) => new RegExp(`^${source
  .replace(/:(\w+)\(([^)]+)\)/g, '(?<$1>$2)')
  .replace(/:(\w+)/g, '(?<$1>[^/]+)')}$`);
const edge = (path) => {
  for (const rule of redirects) {
    const match = path.match(toRegex(rule.source));
    if (!match) continue;
    const to = rule.destination.replace(/:(\w+)/g, (_, name) => match.groups?.[name] ?? '');
    return { to, permanent: rule.permanent === true };
  }
  return null;
};

// --- 1 + 2. The old phone addresses, at the edge and in the router -----------------------------------
const SAMPLES = ['/mobile', '/mobile/dashboard', '/mobile/home', '/mobile/catalog', '/mobile/articles',
  '/mobile/products/maskumambang', '/mobile/articles/kisah-x', '/mobile/bespoke', '/mobile/about',
  '/mobile/cart', '/mobile/checkout', '/mobile/payment', '/mobile/welcome', '/mobile/customer',
  '/mobile/customer/invoice/SOLI09232'];
for (const shop of ['', '/en']) {
  for (const path of SAMPLES) {
    const app = fromRetiredMobileStorefront(path);
    assert.ok(app, `${path} is not an old storefront address in the router — the sample list is stale`);
    const hop = edge(`${shop}${path}`);
    assert.ok(hop, `${shop}${path} is not redirected at the edge, so a crawler still gets the SPA shell there`);
    assert.ok(hop.permanent, `${shop}${path} must redirect permanently, or search keeps the old address`);
    assert.equal(hop.to, `${shop}${app}`, `${shop}${path}: the edge sends ${hop.to}, the router ${shop}${app}`);
  }
}
assert.equal(edge('/mobile/products/maskumambang').to, '/catalog/maskumambang',
  'the product twin must be the PRERENDERED url, the one the sitemap lists');

// --- 3. The Studio is never swept up ------------------------------------------------------------------
for (const studio of ['/mobile/studio', '/mobile/studio/orders/12', '/mobile/batches', '/mobile/formulas/12',
  '/mobile/raw-materials', '/mobile/login', '/mobile/journal/new', '/en/mobile/studio']) {
  assert.equal(edge(studio), null, `${studio} is a Studio screen and must not be redirected at the edge`);
}

const robots = read('public', 'robots.txt');
assert.match(robots, /^Disallow: \/mobile\/$/m,
  'the mobile tree must be closed by default — a new mobile Studio route would otherwise be crawlable');
assert.match(robots, /^Disallow: \/en\/mobile\/$/m, 'in the English shop too');
const allowed = [...robots.matchAll(/^Allow: ((?:\/en)?\/mobile\/\S*)$/gm)].map((m) => m[1]);
assert.ok(allowed.length >= 6, `only ${allowed.length} old phone paths left open — the 308s would be invisible to crawlers`);
for (const path of allowed) {
  const probe = path.endsWith('/') ? `${path}x` : path;
  const hop = edge(probe);
  assert.ok(hop?.permanent, `robots.txt opens ${path} to crawlers but nothing redirects it — that is the duplicate again`);
}

console.log(`mobileCanonical selfcheck OK (${SAMPLES.length * 2} old phone addresses 308 to their page in both shops, ${allowed.length} left crawlable so the redirect is seen)`);
