// `node src/utils/nothingInventedOnTheShelf.selfcheck.mjs`
//
// Eleventh visitor audit, 15 Nov 2026:
//  - three new perfumes, their copy not yet written, showed "A custom product entry managed from Studio."
//    and a pyramid of "Opening note / Heart note / Base note" — words the shop invented for Dekito, on the
//    page, in the search preview and in the share text. Empty now stays empty, and the page hides it.
//  - the catalogue opened on two SOLD OUT cards (new rows come first). What can be bought comes first.
//  - "Mungkin kamu suka · Signature tenang lainnya" above a row of LIMITED bottles.
//  - the English home told search engines the brand in Indonesian.
//  - the generated covers printed Dekito's name, outside the brand line.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { MESSAGES } from '../i18n/messages.js';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const read = (...parts) => readFileSync(join(root, ...parts), 'utf8');

// Quoted strings only — the comments that explain the fix may name them.
const INVENTED = /['"`](?:Opening note|Heart note|Base note|A custom product entry|Opening impression|Lasting trace|A quiet SOLIVAGANT fragrance object for skin|A public SOLIVAGANT fragrance composed)/;
for (const file of [['services', 'productCatalogService.js'], ['data', 'publicStorefront.js']]) {
  const code = read(...file).split('\n').filter((line) => !/^\s*(\/\/|\*)/.test(line));
  const found = code.filter((line) => INVENTED.test(line));
  assert.deepEqual(found, [], `${file.join('/')} invents copy for an empty product again`);
}
assert.match(read('components', 'storefront', 'ScentPyramid.jsx'), /if \(!tiers\.length\) return null;/, 'an empty pyramid must hide');

const catalog = read('pages', 'CatalogPage.jsx');
assert.match(catalog, /soldOut: product\.publicStatus !== 'Available'/);
// (Since 19 Nov 2026 perfumes also come before discovery sets inside each half; since 26 Nov 2026 bottles with a
// photograph come before label cards inside that; still stable — the index is the last tie-break.)
assert.match(catalog, /\.sort\(\(a, b\) => \(Number\(a\.soldOut\) - Number\(b\.soldOut\)\) \|\| \(Number\(a\.set\) - Number\(b\.set\)\)\s*\|\| \(Number\(a\.card\) - Number\(b\.card\)\) \|\| \(a\.index - b\.index\)\)/,
  'the catalogue no longer puts what can be bought first (stable, nothing else moves)');

assert.doesNotMatch(MESSAGES.id['pdp.youMayLikeSub'] + MESSAGES.en['pdp.youMayLikeSub'], /tenang|quiet signature/i);
assert.match(read('utils', 'seo.js'), /description: region === 'en' \? SITE_TAGLINE_EN : SITE_TAGLINE,/);
assert.match(read('pages', 'HomePage.jsx'), /buildOrganizationJsonLd\(siteOrigin, undefined, region\)/);
assert.doesNotMatch(MESSAGES.id['bsp.perfumeNameHint'] + MESSAGES.en['bsp.perfumeNameHint'], /studio/i, '"studio" is the name of the admin tool');

console.log('nothingInventedOnTheShelf selfcheck OK (no invented copy, buyable first, each shop in its own words)');
