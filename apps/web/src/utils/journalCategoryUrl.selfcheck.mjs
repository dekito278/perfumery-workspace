// The five material stories have an address, and that address survives a round trip.
//
// Before this, which tab a reader stood on was useState: /journal and nothing else. There was no way to
// send someone the raw-material posts, the back button did nothing, and a bookmark always reopened on
// All. The fix people reach for is a second page — /kelas-parfum listing the same five articles — which
// is a duplicate URL to keep in step and for search engines to choose between. The tab was already the
// index; it only lacked an address.
//
// So this guard RUNS the mapping instead of reading the page's shape. It imports the real
// journalCategoryUrl.js through a data: URL with its one '@/…' import replaced by the category list
// LIFTED OUT OF THE REAL SERVICE FILE — so the round trip is checked against the categories the editor
// actually offers, not against a copy in this file that would keep passing after the real list changed.

import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const read = (rel) => fs.readFileSync(path.resolve(HERE, rel), 'utf8');

// --- 1. Lift the real category list -------------------------------------------------------------------
const service = read('../services/journalPostsSupabaseService.js');
const listed = service.match(/export const JOURNAL_CATEGORIES = \[([\s\S]*?)\];/);
assert.ok(listed, 'could not lift JOURNAL_CATEGORIES out of the service — fix this guard, not the app');
const CATEGORIES = [...listed[1].matchAll(/\{\s*value:\s*'([^']+)',\s*label:\s*'([^']+)'\s*\}/g)]
  .map(([, value, label]) => ({ value, label }));
assert.ok(CATEGORIES.length >= 5,
  `only ${CATEGORIES.length} journal categories lifted — the parse lost them, fix this guard`);

// --- 2. Run the real module, with that list stood in for its import -----------------------------------
const source = read('./journalCategoryUrl.js')
  .replace(/^import \{ JOURNAL_CATEGORIES \}.*$/m, `const JOURNAL_CATEGORIES = ${JSON.stringify(CATEGORIES)};`);
assert.ok(!source.includes("from '@/"), 'journalCategoryUrl.js grew a second aliased import — teach this guard about it');
const {
  JOURNAL_ALL_TAB, JOURNAL_TAB_PARAM, journalCategoryLabelFromUrl, journalCategoryValue, journalTabPath,
} = await import(`data:text/javascript,${encodeURIComponent(source)}`);

// --- 3. Every category round-trips: label -> URL -> label ---------------------------------------------
// This is the whole promise. A link that comes back as a different tab sends the reader somewhere other
// than where the person who shared it was standing.
for (const { value, label } of CATEGORIES) {
  const url = journalTabPath(label);
  assert.equal(url, `/journal?${JOURNAL_TAB_PARAM}=${value}`, `${label} must address itself by its stored value`);
  const param = new URL(url, 'https://solivagantscent.com').searchParams.get(JOURNAL_TAB_PARAM);
  assert.equal(journalCategoryLabelFromUrl(param), label, `${label} does not survive the round trip`);
}

// The value, never the label: a reworded label must not break links people already shared.
for (const { value, label } of CATEGORIES) {
  assert.ok(!journalTabPath(label).includes(encodeURIComponent(label)) && !journalTabPath(label).includes(label),
    `${label} is addressed by its display text — reword the label and every shared link dies`);
  assert.equal(journalCategoryValue(label), value);
}

// --- 4. All is the plain page, and anything unrecognised lands there ----------------------------------
assert.equal(journalTabPath(JOURNAL_ALL_TAB), '/journal', 'All must stay the plain /journal, with no parameter');
for (const junk of ['', 'material_notes', 'Material Note', 'KELAS', '../../etc', null, undefined]) {
  assert.equal(journalCategoryLabelFromUrl(junk), JOURNAL_ALL_TAB,
    `an unrecognised ?${JOURNAL_TAB_PARAM}=${String(junk)} must fall back to All, not to an empty grid`);
}

// --- 5. The param name belongs to both shops ----------------------------------------------------------
// One component serves /journal and /en/journal. The first version read ?kategori=, which put Indonesian
// in the English shop's address bar; the i18n guard caught it. Keep it a plain ASCII identifier.
assert.match(JOURNAL_TAB_PARAM, /^[a-z][a-z_]*$/, 'the parameter name must be a plain lowercase identifier');

// --- 6. The page actually reads the URL, and the tabs are links ---------------------------------------
// Without this the mapping above could be perfect and unused. Checked on the real page file.
const page = read('../pages/PublicJournalPage.jsx');
assert.match(page, /useSearchParams/, 'PublicJournalPage must take the active tab from the URL, not from useState');
assert.ok(!/\[activeCategory, setActiveCategory\]\s*=\s*useState/.test(page),
  'the active tab is back in useState — the filtered views lost their address again');
assert.match(page, /<Link[\s\S]{0,200}to=\{journalTabPath\(cat\)\}/,
  'the tabs must be Links carrying journalTabPath — an index you cannot copy, open in a new tab or crawl is not an index');
assert.match(page, /aria-current=/, 'the current tab must be announced, not only coloured');
