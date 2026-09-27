// `node src/utils/mobileCanonical.selfcheck.mjs`
//
// The mobile storefront is a SECOND set of URLs for the same shop, and RootRedirect sends every phone
// to /mobile/dashboard. Google crawls mobile-first, so its crawler lands on the duplicate rather than
// on the prerendered page the sitemap advertises.
//
// Measured on the live site with an iPhone user agent: /mobile/dashboard, /mobile/catalog and
// /mobile/products/<slug> carried NO canonical and NO robots meta. And robots.txt matches from the
// start of a path, so "Disallow: /cart" never covered /mobile/cart — nor did anything cover the mobile
// Studio (batches, formulas, raw materials, production costing).
import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { desktopCanonicalPath } from './seo.js';

const webRoot = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const walkFiles = (dir) => readdirSync(dir, { withFileTypes: true }).flatMap((entry) => (
  entry.isDirectory() ? walkFiles(join(dir, entry.name)) : [join(dir, entry.name)]
));
const read = (...p) => readFileSync(join(webRoot, ...p), 'utf8');

// --- the mapping ------------------------------------------------------------------------------------
assert.equal(desktopCanonicalPath('/mobile/dashboard'), '/home', 'the phone landing page is a copy of /home');
assert.equal(desktopCanonicalPath('/mobile/home'), '/home');
assert.equal(desktopCanonicalPath('/mobile/catalog'), '/catalog');
assert.equal(desktopCanonicalPath('/mobile/bespoke'), '/bespoke');
assert.equal(desktopCanonicalPath('/mobile/articles'), '/journal');
assert.equal(desktopCanonicalPath('/mobile/products/maskumambang'), '/catalog/maskumambang',
  'the product twin must be the PRERENDERED url, the one the sitemap lists');
assert.equal(desktopCanonicalPath('/mobile/articles/kisah-x'), '/articles/kisah-x');
// Query strings and trailing slashes are the same page.
assert.equal(desktopCanonicalPath('/mobile/catalog?sort=new'), '/catalog');
assert.equal(desktopCanonicalPath('/mobile/catalog/'), '/catalog');
// A Studio page has no public twin and must never be handed one.
for (const studio of ['/mobile/batches', '/mobile/formulas/12', '/mobile/raw-materials', '/mobile/cart', '']) {
  assert.equal(desktopCanonicalPath(studio), '', `${studio || '(empty)'} has no desktop twin to point at`);
}

// --- the pages actually declare it --------------------------------------------------------------------
for (const [file, expected] of [
  ['MobileStorefrontPage.jsx', "desktopCanonicalPath('/mobile/dashboard')"],
  ['MobileCatalogPage.jsx', "desktopCanonicalPath('/mobile/catalog')"],
  ['MobileBespokePage.jsx', "desktopCanonicalPath('/mobile/bespoke')"],
]) {
  const source = read('src', 'pages', 'mobile', file);
  assert.ok(source.includes(expected), `${file} must declare its desktop canonical`);
  assert.match(source, /<link rel="canonical" href=\{toAbsoluteUrl\(/, `${file} must emit an absolute canonical`);
}
assert.match(read('src', 'pages', 'mobile', 'MobileProductDetailPage.jsx'),
  /desktopCanonicalPath\(`\/mobile\/products\/\$\{product\.slug\}`\)/,
  'the mobile product page must point at its prerendered desktop twin');

// --- robots: the mobile tree is private by default ----------------------------------------------------
const robots = read('public', 'robots.txt');
assert.match(robots, /^Disallow: \/mobile\/$/m,
  'the mobile tree must be closed by default — a new mobile Studio route would otherwise be crawlable');
// ...with exactly the public pages opened back up, and nothing else.
const allowed = [...robots.matchAll(/^Allow: (\/mobile\/\S*)$/gm)].map((m) => m[1]).sort();
assert.deepEqual(allowed,
  ['/mobile/articles', '/mobile/bespoke', '/mobile/catalog', '/mobile/dashboard', '/mobile/home', '/mobile/products/'],
  'only the storefront pages may be crawlable, and each one must have a canonical above');
// Every opened path must be one the mapping knows, or it would be crawled with no canonical to follow.
for (const path of allowed) {
  const probe = path.endsWith('/') ? `${path}x` : path;
  assert.ok(desktopCanonicalPath(probe), `${path} is crawlable but has no desktop twin — that is the duplicate again`);
}

// ...and a twin in the MAPPING is not a canonical on the PAGE. The list above checked four pages by
// hand while robots.txt opened six paths, and /mobile/articles was the one in the gap: crawlable, with
// a known desktop twin, and emitting no canonical at all. Exactly the state the three pages named in
// this guard's header were measured in.
//
// So the two halves are joined: the allowed paths ARE the subject, and each has to be declared by some
// page. Found by searching for the declaration rather than by naming files, because /mobile/dashboard
// and /mobile/home are one page and the three tabs live in one shell.
const pageSources = walkFiles(join(webRoot, 'src', 'pages'))
  .filter((file) => file.endsWith('.jsx'))
  .map((file) => readFileSync(file, 'utf8'));
const declared = new Set();
for (const source of pageSources) {
  for (const [, path] of source.matchAll(/desktopCanonicalPath\('([^']+)'\)/g)) declared.add(path);
  // The product page builds its path from the slug; record the prefix it stands for.
  if (/desktopCanonicalPath\(`\/mobile\/products\/\$\{/.test(source)) declared.add('/mobile/products/');
}
assert.ok(declared.size >= 5, `only ${declared.size} mobile canonicals are declared anywhere — the scan is broken`);

for (const path of allowed) {
  // /mobile/dashboard and /mobile/home are the same screen; declaring either covers both.
  const covered = declared.has(path)
    || (path === '/mobile/home' && declared.has('/mobile/dashboard'))
    || (path === '/mobile/dashboard' && declared.has('/mobile/home'));
  assert.ok(covered,
    `robots.txt opens ${path} to crawlers but no page declares its desktop canonical, so Google lands `
    + 'on the duplicate with nothing saying which address is the real one');
}

console.log(`mobileCanonical selfcheck OK (${allowed.length} mobile pages crawlable, each pointing at its desktop twin)`);
