// `node src/utils/noindexPages.selfcheck.mjs`
//
// The app answers every URL with 200 and the same shell, so a page that does not exist looks exactly
// like one that does. Search engines only learn the difference from what the page says about itself.
// Measured live before this guard existed: /produk/apa-saja rendered "Halaman tidak ditemukan" under
// `robots: index,follow`, and /articles/<slug-that-does-not-exist> went further — it kept
// `rel="canonical"` pointing at itself, which asserts the ghost URL is the real home of an article.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const webRoot = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const read = (rel) => readFileSync(join(webRoot, rel), 'utf8');

const NOINDEX = /<meta name="robots" content="noindex,follow" \/>/;

const MUST_NOT_BE_INDEXED = [
  ['src/pages/NotFoundPage.jsx', 'the 404 itself, and where a missing product lands'],
  ['src/pages/PublicJournalArticlePage.jsx', 'a slug with no published article behind it'],
  ['src/pages/PublicTrackingPage.jsx', 'one URL per order code'],
  ['src/pages/CustomerInvoicePage.jsx', "one URL per order, holding a customer's invoice"],
  ['src/pages/WelcomePage.jsx', 'the greeting-card landing — a door for buyers who hold the card, not a page to be found'],
];

for (const [file, why] of MUST_NOT_BE_INDEXED) {
  assert.match(read(file), NOINDEX, `${file} must tell crawlers not to index it — ${why}.`);
}

// --- and the list is a floor, not the subject -----------------------------------------------------------
// Five pages named by hand, against a rule that is about EVERY page the shell answers. /reset-password was
// the one in the gap: routed, reachable by anyone, absent from the sitemap, and absent from robots.txt —
// which disallows /login and /en/login by name and never grew a twin for it. So it said nothing about
// itself and the shell's generic description stood in for it.
//
// The real subject is derivable: a page a stranger can open, that the build does not advertise and
// robots.txt does not close, has to say what it is.
const app = read('src/App.jsx');
const importedFrom = new Map([...app.matchAll(/(?:import\s+(\w+)\s+from|const\s+(\w+)\s*=\s*lazyRoute\(\(\)\s*=>\s*import\()\s*'@\/pages\/([^']+)'/g)]
  .map((m) => [m[1] || m[2], m[3]]));
assert.ok(importedFrom.size >= 30, `only ${importedFrom.size} page imports parsed from App.jsx`);

const robots = read('public/robots.txt');
const disallowed = robots.split('\n')
  .filter((line) => line.startsWith('Disallow:'))
  .map((line) => line.slice('Disallow:'.length).trim())
  .filter((path) => path && path !== '/');

// What the build tells search engines about, from the build's own list rather than a copy of it.
const advertised = new Set([...read('tools/seo-artifacts.mjs')
  .match(/STATIC_PUBLIC_ROUTES = \[([^\]]*)\]/)[1]
  .matchAll(/'([^']+)'/g)].map((m) => m[1]));
assert.ok(advertised.size >= 3, `only ${advertised.size} advertised routes parsed from seo-artifacts.mjs`);

let openPages = 0;
for (const [, path, outer, inner] of app.matchAll(/<Route\s+path="([^"]+)"\s+element=\{<(\w+)(?:><(\w+))?/g)) {
  if (/^\/(?:studio|mobile\/studio)/.test(path)) continue;
  // A parameterised route is one of many URLs; those pages are already named in the list above, where
  // the reason can say which branch of them matters.
  if (path.includes(':') || path.includes('*')) continue;
  const file = importedFrom.get(inner || outer);
  if (!file) continue; // a redirect or an inline component, not a page with a head of its own
  if (advertised.has(path)) continue;
  if (disallowed.some((prefix) => path.startsWith(prefix))) continue;
  openPages += 1;
  // Two ways to say what you are, and the first run of this rule only accepted one. /hug is a vanity
  // address for one bottle: it renders the ordinary product page, which declares
  // rel="canonical" -> /catalog/hug-n-1 — a page that IS advertised and prerendered. That is the right
  // answer for a second address, and a noindex there would be wrong, because the same component serves
  // /catalog/:slug. So a canonical counts as saying it.
  const source = read(`src/pages/${file}`);
  assert.ok(NOINDEX.test(source) || /rel="canonical"/.test(source),
    `${path} (${file}) is routed and open: the build does not advertise it and robots.txt does not close `
    + 'it, and it neither refuses indexing nor names a canonical. So the shell answers for it, and a '
    + 'search engine cannot tell it from a page that matters.');
}
assert.ok(openPages >= 2, `only ${openPages} open pages checked — the derivation lost them`);

// Both invoice branches (mobile and desktop) render their own head, so both have to say it.
assert.equal(
  read('src/pages/CustomerInvoicePage.jsx').match(new RegExp(NOINDEX.source, 'g'))?.length,
  2,
  'CustomerInvoicePage returns a separate tree for the mobile route; each one needs the meta.',
);

// A canonical URL is a claim that the page is real. The ghost-article branch must not make it.
const article = read('src/pages/PublicJournalArticlePage.jsx');
for (const line of article.split('\n')) {
  if (!line.includes('rel="canonical"')) continue;
  assert.match(
    line,
    /failed \?/,
    'PublicJournalArticlePage may only claim a canonical URL when the article was actually found:\n'
    + `  ${line.trim()}`,
  );
}

// Nothing in the shell may contradict the four pages above — the shell is in every one of them.
assert.doesNotMatch(
  read('index.html'),
  /name="robots"/,
  'index.html must not ship a robots meta: indexing is the default, and a blanket "index,follow" there '
  + 'ends up in the head of the very pages that just asked not to be indexed.',
);

console.log(`noindexPages selfcheck OK (${MUST_NOT_BE_INDEXED.length} named pages, ${openPages} open routes derived, all kept out of the index)`);
