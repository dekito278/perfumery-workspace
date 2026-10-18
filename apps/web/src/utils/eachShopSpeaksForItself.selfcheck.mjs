// `node src/utils/eachShopSpeaksForItself.selfcheck.mjs`
//
// The English shop was asking Google to delete it.
//
// Every runtime canonical was built as toAbsoluteUrl('/catalog') — the INDONESIAN path, with no region
// anywhere in the expression. So the tag React writes on /en/catalog said its canonical home was
// /catalog. The prerendered dist/en/*/index.html files carry the right canonical, which is exactly why
// this never showed in the built output: it is the tag written afterwards that is wrong, and Google runs
// the JavaScript.
//
// The journal is the one page that SHOULD point across shops: journal_posts has no English columns, so
// /en/journal would be a second address for the same Indonesian articles, and robots.txt keeps crawlers
// off it. That exemption is derived from the PATH the canonical names, not from a list of files — a file
// list is what let eight pages drift in the first place.
process.env.TZ = 'Asia/Jakarta';

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join, relative } from 'node:path';
import { MESSAGES } from '../i18n/messages.js';
import { buyerSurfaces } from './buyerSurfaces.mjs';
import { shopCanonicalUrl } from './seo.js';

const src = join(dirname(fileURLToPath(import.meta.url)), '..');
const ORIGIN = 'https://www.solivagantscent.com';

// --- 1. The signature, before anything leans on it ----------------------------------------------------
// This comes first because dropping the region parameter makes the calls below throw rather than fail,
// and a ReferenceError out of seo.js says nothing about what broke. toAbsoluteUrl is still right for
// og:image and the sitemap; it is only a CANONICAL that has to know which shop it is in.
const seo = readFileSync(join(src, 'utils', 'seo.js'), 'utf8');
assert.match(seo, /export const shopCanonicalUrl = \(path, region/,
  'shopCanonicalUrl must keep taking the region — without it every caller silently returns Indonesian');

// --- 2. The helper, run --------------------------------------------------------------------------------
assert.equal(shopCanonicalUrl('/catalog', 'id', ORIGIN), `${ORIGIN}/catalog`);
assert.equal(shopCanonicalUrl('/catalog', 'en', ORIGIN), `${ORIGIN}/en/catalog`,
  'the English shop is its own address, or it is a duplicate of the Indonesian one');
assert.equal(shopCanonicalUrl('/catalog/la-tulipe', 'en', ORIGIN), `${ORIGIN}/en/catalog/la-tulipe`);
assert.equal(shopCanonicalUrl('about', 'en', ORIGIN), `${ORIGIN}/en/about`, 'a missing slash is tolerated');
assert.equal(shopCanonicalUrl('', 'en', ORIGIN), '', 'no path, no url — never a bare origin');
// An unknown or absent region is Indonesian, which is the shop at the bare address.
for (const region of [undefined, null, '', 'xx', 'ID']) {
  assert.equal(shopCanonicalUrl('/catalog', region, ORIGIN), `${ORIGIN}/catalog`,
    `region ${JSON.stringify(region)} must fall back to the Indonesian address, not invent a prefix`);
}

// --- 2. Every buyer canonical, and the one rule ------------------------------------------------------
const JOURNAL = /journal|articles/i;
const surfaces = buyerSurfaces({ src, exclude: new Set(['PwaUpdatePrompt', 'ConfirmHost', 'Toaster']) });
let checked = 0;
let journalExempt = 0;
for (const file of surfaces.files) {
  const source = readFileSync(file, 'utf8');
  for (const match of source.matchAll(/rel="canonical"\s+href=\{([^}]*(?:\{[^}]*\}[^}]*)*)\}/g)) {
    const expression = match[1].trim();
    const line = source.slice(0, match.index).split('\n').length;
    const where = `${relative(src, file)}:${line}`;
    checked += 1;
    // What the expression resolves to has to be read from the page, because the canonical is usually a
    // const declared earlier: find its initialiser and judge that.
    // The canonical is usually a const declared earlier, and that const is sometimes built from ANOTHER
    // const: PublicJournalArticlePage reads `toAbsoluteUrl(canonicalPath, …)` where canonicalPath is
    // `/articles/${post.slug}`. One level of resolution called that page shop-blind; the path only
    // appears two levels down. So it follows identifiers until it stops finding one, which is how the
    // exemption stays derived from the PATH rather than from the file's name.
    let resolved = expression;
    for (let depth = 0; depth < 4 && /^[A-Za-z_$][\w$]*$/.test(resolved.trim()); depth += 1) {
      const next = (source.match(new RegExp(`const ${resolved.trim()}\\s*=\\s*([^;]+);`)) || [])[1];
      if (!next) break;
      resolved = next.trim();
      if (JOURNAL.test(resolved)) break;
      const inner = resolved.match(/^\w+\(\s*([A-Za-z_$][\w$]*)\s*[,)]/);
      if (inner) resolved = inner[1];
    }
    if (JOURNAL.test(resolved)) { journalExempt += 1; continue; }
    const initialiser = resolved;
    assert.match(initialiser, /shopCanonicalUrl\(/,
      `${where} builds its canonical without the shop: ${initialiser.replace(/\s+/g, ' ').slice(0, 72)}. `
      + 'On /en that names the Indonesian url, which asks a crawler to drop the English page');
  }
}
assert.ok(checked >= 12, `only ${checked} canonicals were found on buyer surfaces — the sweep used to `
  + 'find 13, so it has gone blind and this check passes on nothing');
assert.ok(journalExempt >= 1 && journalExempt < checked,
  `${journalExempt} of ${checked} canonicals were treated as the journal — if that is all of them, the `
  + 'exemption has swallowed the rule');

// --- 4. The Indonesian prerender speaks Indonesian ---------------------------------------------------
// The copy in tools/build.mjs was written for search results and is English. It went out on BOTH
// addresses, so an Indonesian searcher met an Indonesian shop — lang="id", x-default in the sitemap —
// described to them in English. Each page object now names the message key its Indonesian half reads,
// and the words are the ones the live page already shows through t(), so the two cannot drift.
const build = readFileSync(join(src, '..', 'tools', 'build.mjs'), 'utf8');
const pageBlocks = [...build.matchAll(/\{\s*route: '([^']+)',([\s\S]*?)\n  \}/g)]
  .map(([, route, body]) => ({ route, body }));
assert.ok(pageBlocks.length >= 5, `only ${pageBlocks.length} prerendered pages parsed out of build.mjs`);
let bilingual = 0;
for (const { route, body } of pageBlocks) {
  // The journal is English in both shops by a written decision in IDENTICAL_ON_PURPOSE, and has no
  // English twin at all, so it is the one page that may describe itself in one language.
  if (JOURNAL.test(route)) continue;
  const key = (body.match(/idDescriptionKey: '([^']+)'/) || [])[1];
  assert.ok(key, `${route} is prerendered on both addresses with one description — it needs an `
    + 'idDescriptionKey so the Indonesian page stops borrowing the English sentence');
  const indonesian = MESSAGES.id[key];
  const english = (body.match(/description: '((?:[^'\\]|\\.)*)'/) || [])[1];
  assert.ok(indonesian, `${route} names ${key}, which is not in the message file`);
  assert.ok(english, `${route} has no English description literal left to compare against`);
  assert.notEqual(indonesian, english.replace(/\\'/g, "'"),
    `${route}: the Indonesian description is the English one — ${key} is not doing anything`);
  assert.notEqual(MESSAGES.id[key], MESSAGES.en[key],
    `${route}: ${key} reads the same in both shops, so wiring it changed nothing`);
  bilingual += 1;
}
assert.ok(bilingual >= 4, `only ${bilingual} prerendered pages describe themselves per shop`);

console.log(`eachShopSpeaksForItself: ok (${checked} buyer canonicals, ${journalExempt} Indonesian on `
  + `purpose because there is no English journal; ${bilingual} prerendered pages describe themselves in `
  + 'their own language)');
