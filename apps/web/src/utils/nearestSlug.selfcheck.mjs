// `node src/utils/nearestSlug.selfcheck.mjs`
//
// An address that is almost right reaches the page it can only mean; anything less certain stays "not
// found" (utils/nearestSlug.js). The slugs below are production's, read on 13 Nov 2026.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { nearestSlug } from './nearestSlug.js';

const src = join(dirname(fileURLToPath(import.meta.url)), '..');
const read = (...parts) => readFileSync(join(src, ...parts), 'utf8');

const products = ['animal-farm', 'aquilaria-tuberosa', 'ayang-ayang', 'hug-n-1', 'j-adore-la-vetiver', 'jason-voorhees',
  'jata-bhumi', 'l-iris', 'la-rose', 'la-tulipe', 'lintang-asmoro', 'maskumambang', 'pantura', 'patchouli-so-sexy',
  'soli-extended-j-adore-la-vanille', 'sudra', 'vanille-planifolia', 'wayback', 'wongka'];
const articles = ['kisah-jason-vorhees-32209a44', 'namanya-aja-akar-wangi-yang-wangi-ya-akarnya-97390150',
  'vanila-itu-buah-dari-bunga-anggrek-b3ee43f8', 'gaharu-tidak-lahir-dari-pohon-yang-baik-baik-saja-6d7e35dc'];

for (const [typed, list, expected, why] of [
  ['j-adore-la-vanille', products, 'soli-extended-j-adore-la-vanille', "the perfume's own name reaches it (audit)"],
  ['la-rosee', products, 'la-rose', 'one slip of a letter'],
  ['animal-farms', products, 'animal-farm', 'a stray plural'],
  ['l-iris', products, 'l-iris', 'a real address is itself'],
  ['vanille', products, '', 'one word is the tail of one perfume and the head of another: not a guess'],
  ['hug', products, '', 'too short to mean one perfume'],
  ['patchouli', products, '', 'a word, not an address'],
  ['kisah-jason-voorhees', articles, 'kisah-jason-vorhees-32209a44', 'the CORRECT spelling finds the misspelled article (audit)'],
  ['kisah-jason-vorhees', articles, 'kisah-jason-vorhees-32209a44', 'nobody types the id on the end'],
  ['vanila-itu-buah-dari-bunga-anggrek', articles, 'vanila-itu-buah-dari-bunga-anggrek-b3ee43f8', 'without its id'],
  ['gaharu', articles, '', 'one word is a search'],
]) assert.equal(nearestSlug(typed, list), expected, `${typed}: ${why}`);
assert.equal(nearestSlug('la-rose', ['la-rose', 'la-rosa']), 'la-rose', 'an exact match wins over a near one');
assert.equal(nearestSlug('la-rosx', ['la-rose', 'la-rosa']), '', 'two equally near: not a guess');

const pdp = read('pages', 'PublicProductDetailPage.jsx');
assert.match(pdp, /const near = nearestSlug\(slug, visibleProducts\.map\(\(item\) => item\.slug\)\);\s*if \(near && near !== slug\) return <Navigate to=\{`\/catalog\/\$\{near\}`\} replace \/>;\s*(?:\/\/[^\n]*\s*)*return <NotFoundPage \/>;/,
  'the product page follows a certain guess, among VISIBLE products only, before saying not found — in place, '
  + 'keeping the address the buyer typed (third audit, 13 Nov 2026: it used to move to /not-found)');
const notFound = read('pages', 'NotFoundPage.jsx');
assert.match(notFound, /navigate\(q \? `\/catalog\?q=\$\{encodeURIComponent\(q\)\}` : '\/catalog'\)/, 'the 404 page searches the collection');
assert.match(read('pages', 'CatalogPage.jsx'), /useState\(\(\) => searchParams\.get\('q'\) \|\| ''\)/, 'and the catalogue starts from that search');
const article = read('pages', 'PublicJournalArticlePage.jsx');
assert.match(article, /nearestSlug\(slug, \(await getPublishedJournalPosts\(\)\.catch\(\(\) => \[\]\)\)\.map\(\(item\) => item\.slug\)\)/,
  'the article page guesses among PUBLISHED articles only, and a failed list is just "not found"');
assert.match(article, /active = false;\s*navigate\(`\/articles\/\$\{near\}`, \{ replace: true \}\)/,
  'replacing the wrong address in history, and staying "loading" meanwhile — finishing the load with no article '
  + 'and no failure crashed the page into "Halaman ini gagal tampil" (seen in the running app)');

console.log('nearestSlug selfcheck OK (an almost-right address reaches the one page it can mean)');
