// `node src/utils/theBrandIsSaidOnce.selfcheck.mjs`
//
// The house name appears ONCE in a title.
//
// Live on 2026-10-24, on all five of Dekito's new material articles:
//
//     <title>Gaharu dan oud: dari pohon yang terluka — Solivagant - SOLIVAGANT</title>
//
// Both templates append it — the prerendered article head adds " - SOLIVAGANT", the journal page adds
// " - Solivagant Journal" — and the SEO titles ended with "— Solivagant", so it shipped twice.
//
// I wrote those five strings, but the trap is the FIELD, not the strings: the box is labelled "SEO
// Title" with the hint "Kosongkan untuk memakai title utama" and says nothing about a suffix being
// added afterwards. Anyone writing one will sign it with the brand. Editing those five would leave the
// next one to fall in, so the suffix is stripped where the titles are built.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { SITE_NAME, stripTrailingBrand } from './seo.js';

const here = dirname(fileURLToPath(import.meta.url));
const read = (...parts) => readFileSync(join(here, ...parts), 'utf8');

// --- 1. The trailing mention goes, however it was punctuated ----------------------------------------
for (const written of [
  'Gaharu dan oud: dari pohon yang terluka — Solivagant',
  'Gaharu dan oud: dari pohon yang terluka - Solivagant',
  'Gaharu dan oud: dari pohon yang terluka | SOLIVAGANT',
  'Gaharu dan oud: dari pohon yang terluka solivagant',
  'Gaharu dan oud: dari pohon yang terluka — Solivagant   ',
]) {
  assert.equal(stripTrailingBrand(written), 'Gaharu dan oud: dari pohon yang terluka',
    `"${written}" still carries the brand, so the template's own suffix makes it twice`);
}

// --- 2. And the full title is then said once --------------------------------------------------------
const built = `${stripTrailingBrand('Nilam Jawa: yang paling salah dimengerti — Solivagant', SITE_NAME)} - ${SITE_NAME}`;
assert.equal(built, 'Nilam Jawa: yang paling salah dimengerti - SOLIVAGANT');
assert.equal((built.toLowerCase().match(/solivagant/g) || []).length, 1,
  `the house name appears more than once: ${built}`);

// --- 3. What must NOT be stripped --------------------------------------------------------------------
// Only a trailing whole-word mention. A line NAMED after the house keeps its name.
assert.equal(stripTrailingBrand('Ambar Segara — Solivagant Reserve'), 'Ambar Segara — Solivagant Reserve',
  'the Reserve line is called Solivagant Reserve; stripping there renames the line');
assert.equal(stripTrailingBrand('Kenapa Solivagant memakai oud Malinau'),
  'Kenapa Solivagant memakai oud Malinau', 'a mid-sentence mention is part of the sentence');
assert.equal(stripTrailingBrand('Solivagant'), 'Solivagant',
  'a title that is ONLY the house name is a real title — stripping it leaves nothing');
assert.equal(stripTrailingBrand(''), '');
assert.equal(stripTrailingBrand(null), '');

// --- 4. Both places that build a title actually use it ------------------------------------------------
// Counted from the files, because the prerendered head is what a crawler and a WhatsApp preview read,
// while the journal page is what a reader sees in their tab. Fixing one and not the other was the
// shape of this bug in the first place.
const prerender = read('..', '..', 'tools', 'seo-artifacts.mjs');
assert.match(prerender, /stripTrailingBrand\(post\.seoTitle \|\| post\.title/,
  'the prerendered article head still pastes the raw SEO title in front of its own brand suffix');
const page = read('..', 'pages', 'PublicJournalArticlePage.jsx');
assert.match(page, /stripTrailingBrand\(/,
  'the journal page still builds its tab title from the raw SEO title');
// And it must be IMPORTED, not merely called. The first version of this section only grepped for the
// call and went green while the page had no import for it at all — a page that would have thrown on
// render. A guard that proves the wrong half is worse than none, because it is believed.
assert.match(page, /import \{[^}]*\bstripTrailingBrand\b[^}]*\} from '@\/utils\/seo\.js';/,
  'the journal page calls stripTrailingBrand without importing it — the page throws on render');
assert.match(prerender, /import \{[^}]*\bstripTrailingBrand\b[^}]*\} from '\.\.\/src\/utils\/seo\.js';/,
  'the prerender script calls it without importing it');

console.log('theBrandIsSaidOnce selfcheck OK (trailing mention stripped, Reserve kept, both builders use it)');
