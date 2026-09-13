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

// 1. The prerenderer decides where the file lands.
const seo = read('tools', 'seo-artifacts.mjs');
assert.match(seo, /path\.join\(distRoot, 'catalog', product\.slug\)/,
  'the prerenderer writes dist/catalog/<slug>/index.html; every other name below follows from that');
// 2. ...the sitemap must point at the same place, or Google indexes a URL with no file behind it.
assert.match(seo, /urlEntry\(abs\(siteUrl, `\/catalog\/\$\{p\.slug\}`\)/, 'the sitemap must list the prerendered path');
// 3. ...and so must the canonical baked into that file.
assert.match(seo, /abs\(siteUrl, `\/catalog\/\$\{product\.slug\}`\)/, 'the prerendered canonical must agree');

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

// 5. The old URL must heal rather than linger as an indexable duplicate with no canonical of its own.
const vercel = JSON.parse(readFileSync(join(webRoot, 'vercel.json'), 'utf8'));
const redirect = (vercel.redirects || []).find((r) => r.source === '/products/:slug');
assert.ok(redirect, 'links already shared to /products/<slug> must be redirected, not left on the shell');
assert.equal(redirect.destination, '/catalog/:slug');
assert.equal(redirect.permanent, true, 'a permanent redirect is what consolidates the duplicate for search engines');
// The mobile route must not be swept up: /mobile/products/<slug> has a different prefix and its own page.
assert.ok(!'/mobile/products/x'.startsWith('/products/'), 'sanity: the redirect source cannot match the mobile path');

console.log('productPublicUrl selfcheck OK (prerender, sitemap, canonical and links all say /catalog/<slug>)');
