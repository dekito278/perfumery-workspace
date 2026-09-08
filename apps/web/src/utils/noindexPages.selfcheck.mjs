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
];

for (const [file, why] of MUST_NOT_BE_INDEXED) {
  assert.match(read(file), NOINDEX, `${file} must tell crawlers not to index it — ${why}.`);
}

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

console.log(`noindexPages selfcheck OK (${MUST_NOT_BE_INDEXED.length} pages kept out of the index)`);
