// `node src/utils/productPublicUrl.selfcheck.mjs`
//
// A product has one public URL and FOUR things have to agree on it: the prerenderer that writes the
// file, the sitemap that tells Google where it is, the canonical tag the page declares, and the helper
// the app uses to build links. Three agreed on /catalog/<slug>. The helper said /products/<slug>.
//
// That route exists and renders the same page, so nothing looked broken — but no file is prerendered
// there, so the server hands back the generic app shell. WhatsApp and Facebook do not run JavaScript,
// which meant a link copied from Studio's "Salin link produk" previewed as the site's own title and a
// stock photo instead of the perfume. Measured on the live site: /catalog/maskumambang returned
// "Maskumambang - SOLIVAGANT" with two JSON-LD blocks; /products/maskumambang returned the home shell,
// byte-identical to "/", with none.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const webRoot = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const strip = (s) => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
const read = (...parts) => strip(readFileSync(join(webRoot, ...parts), 'utf8'));

const PUBLIC_PREFIX = '/catalog/';

// 1. The prerenderer decides where the file lands. Held as "everyone names the same route", not as the
// exact expressions that did so: pinning the shape made adding the English twin — which moved the
// canonical behind a `route` constant and the sitemap behind a pair list — look like a regression while
// the rule it protects was never broken. The rule is that four places agree on /catalog/<slug>.
const seo = read('tools', 'seo-artifacts.mjs');
assert.match(seo, /const route = `\/catalog\/\$\{product\.slug\}`;/,
  'the product route is named ONCE in the prerenderer, so the file, the canonical and the alternates '
  + 'cannot drift apart from each other');
assert.match(seo, /path\.join\(distRoot,[\s\S]{0,80}?'catalog', product\.slug\)/,
  'the prerenderer writes dist/[en/]catalog/<slug>/index.html; every other name below follows from that');
// 2. ...the sitemap must point at the same place, or Google indexes a URL with no file behind it.
assert.match(seo, /`\/catalog\/\$\{p\.slug\}`/, 'the sitemap must list the prerendered path');
// 3. ...and so must the canonical baked into that file, which is built from that one route constant.
{
  const writer = seo.slice(seo.indexOf('export const writeProductPages'), seo.indexOf('export const writeJournalPages'));
  assert.match(writer, /const canonical = abs\(siteUrl,[^;]*\broute\b[^;]*\);/,
    'the prerendered canonical is derived from that same route, not spelled out a second time');
  assert.match(writer, /upsertCanonical\(html, canonical\)/, 'and it is what the page claims as its canonical');
}

// 4. The helper the app builds links with. This is the one that drifted.
const service = read('src', 'services', 'productCatalogService.js');
const helper = service.slice(service.indexOf('export const getProductStorefrontPath'), service.indexOf('export const getProductStorefrontPath') + 400);
assert.match(helper, /`\/catalog\/\$\{slug\}`/, 'the public link helper must point at the prerendered URL');
assert.doesNotMatch(helper.replace(/mobile \? `\/mobile\/products\/\$\{slug\}`/, ''), /\/products\/\$\{slug\}/,
  'only the mobile path may still say /products/ — there is no /mobile/catalog/:slug route and those '
  + 'pages are neither prerendered nor indexed');

// The page's own canonical, for the hydrated case.
assert.match(read('src', 'pages', 'PublicProductDetailPage.jsx'), /toAbsoluteUrl\(`\/catalog\/\$\{product\.slug\}`/,
  'the live page must declare the same canonical the prerendered file does');

// 5. The old URL must heal rather than linger as an indexable duplicate with no canonical of its own —
// in BOTH shops. Only the Indonesian half was redirected, so /products/<slug> healed to a prerendered
// page while /en/products/<slug> fell through Vercel's catch-all to the generic shell: lang="id", the
// site's own title, no description, no JSON-LD. Measured on the live site before the fix:
//
//   /catalog/ayang-ayang      -> "Ayang-ayang (ꦲꦪꦤ꧀ꦒ꧀​ꦲꦪꦤ꧀ꦒ꧀) - SOLIVAGANT"
//   /en/catalog/ayang-ayang   -> "Ayang-ayang (ꦲꦪꦤ꧀ꦒ꧀​ꦲꦪꦤ꧀ꦒ꧀) - SOLIVAGANT"
//   /en/products/ayang-ayang  -> "SOLIVAGANT - Artisan Perfumery Atelier"   <- the shell
//
// Held as "every shop heals the same way" rather than as two hard-coded entries, because the asymmetry
// is the bug: one shop having a rule the other does not is exactly how this arrived.
const vercel = JSON.parse(readFileSync(join(webRoot, 'vercel.json'), 'utf8'));
for (const prefix of ['', '/en']) {
  const redirect = (vercel.redirects || []).find((r) => r.source === `${prefix}/products/:slug`);
  assert.ok(redirect,
    `links already shared to ${prefix}/products/<slug> must be redirected, not left on the generic shell`);
  assert.equal(redirect.destination, `${prefix}/catalog/:slug`,
    `${prefix}/products/<slug> must heal to its OWN shop's prerendered page, not the other shop's`);
  assert.equal(redirect.permanent, true, 'a permanent redirect is what consolidates the duplicate for search engines');
}
// Vercel matches redirects in order and the English path also begins with a segment the Indonesian
// source does not accept, so the two cannot collide — but the mobile route shares the word "products"
// and must not be swept up by either: it has its own page and its own canonical.
for (const mobile of ['/mobile/products/x', '/en/mobile/products/x']) {
  for (const prefix of ['', '/en']) {
    assert.ok(!mobile.startsWith(`${prefix}/products/`),
      `sanity: ${prefix}/products/:slug must not match ${mobile}`);
  }
}

console.log('productPublicUrl selfcheck OK (prerender, sitemap, canonical and links all say /catalog/<slug>)');
