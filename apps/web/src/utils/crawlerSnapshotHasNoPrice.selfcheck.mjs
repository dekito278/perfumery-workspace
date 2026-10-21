// `node src/utils/crawlerSnapshotHasNoPrice.selfcheck.mjs`
//
// The English address was publishing the Indonesian price list.
//
// tools/build.mjs writes a <noscript> snapshot per route so a crawler sees the catalogue without running
// JavaScript, and it listed every product with `Rp ${priceNumber}`. That snapshot is written ONCE per
// route and served to every IP, so /en/catalog carried twelve rupiah figures — Rp 429.000, Rp 750.000,
// Rp 359.000 — four times the export price, readable by any crawler and by anyone opening the source.
// A stockist abroad found exactly those numbers and read them as the real price. Geo cannot fix it: one
// prerendered file answers everybody.
//
// Measured before and after, on a build that really did fetch (38 product pages, 12 products in the
// snapshot): 24 occurrences of "Rp" across dist, then 0.
//
// A second reason no price belongs here, and it outlives the first: from 12 Nov 2026 the domestic prices
// are scheduled, so a figure baked into HTML at build time would go on showing the old price to crawlers
// until somebody deployed again.
//
// Dekito's decision, 2026-10-21, chosen over rendering per geo at the edge.
process.env.TZ = 'Asia/Jakarta';

import assert from 'node:assert/strict';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const web = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const build = readFileSync(join(web, 'tools', 'build.mjs'), 'utf8');

// --- 1. The snapshot's catalogue rows name no price ---------------------------------------------------
const mapper = build.match(/const catalogSections = products[\s\S]*?\]\);/);
assert.ok(mapper, 'the catalogue snapshot mapper could not be found — this guard is reading nothing');
assert.doesNotMatch(mapper[0], /price|Rp|US\$|USD/i,
  'the crawler snapshot lists a price again. One file per route answers every IP, so a rupiah here is '
  + `the Indonesian price list published on the English address:\n  ${mapper[0].replace(/\s+/g, ' ')}`);
// It must still say something, or the snapshot stops being worth writing.
assert.match(mapper[0], /product\.name/, 'the snapshot still lists the products by name');
assert.match(mapper[0], /description|concentration/, 'and says something about each one');

// --- 2. No currency anywhere in the page objects ------------------------------------------------------
// The titles and descriptions above the mapper are prose, and a price written into one of them would
// land in the same HTML by another door.
const pageTable = build.slice(build.indexOf('const staticPublicPages'), build.indexOf('const renderStaticFallback'));
assert.ok(pageTable.length > 500, 'the prerendered page table could not be sliced out');
for (const match of pageTable.matchAll(/(Rp ?[0-9.]{3,}|US\$ ?[0-9]+)/g)) {
  assert.fail(`the prerendered page copy quotes a price — ${match[1]} — which goes to both shops`);
}

// --- 3. And the built output, when there is one to read ----------------------------------------------
// The real proof, run whenever dist exists AND that build actually fetched the catalogue. A build whose
// Supabase fetch failed writes a snapshot with no products in it, and the scan would then pass on
// nothing — that happened three times while this was being measured. So it is detected and SKIPPED
// rather than failed: build.mjs deliberately tolerates a failed fetch so an outage cannot block an
// urgent deploy, and a guard that turns that tolerance into a red gate is a worse bargain than a
// reported skip.
const dist = join(web, 'dist');
const htmlFiles = existsSync(dist)
  ? (function walk(dir) {
    return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
      const full = join(dir, entry.name);
      return entry.isDirectory() ? walk(full) : (entry.name.endsWith('.html') ? [full] : []);
    });
  }(dist))
  : [];
const catalogSnapshot = htmlFiles.find((file) => file.endsWith(join('catalog', 'index.html')));
const headings = catalogSnapshot
  ? (readFileSync(catalogSnapshot, 'utf8').match(/<h3>/g) || []).length
  : 0;
// Two hand-written sections are always there; the products come on top of them.
const fetched = headings >= 6;
let scanned = 0;
if (fetched) {
  for (const file of htmlFiles) {
    const html = readFileSync(file, 'utf8');
    scanned += 1;
    for (const currency of ['Rp ', 'US$']) {
      assert.ok(!html.includes(currency),
        `${file.replace(`${web}/`, '')} carries ${currency.trim()} — a prerendered file is served to `
        + 'every IP, so one currency in it is the wrong currency for half the visitors');
    }
  }
  assert.ok(scanned >= 40, `only ${scanned} prerendered files were scanned; a full build writes about 50`);
}

const verdict = fetched
  ? `${scanned} prerendered file(s) scanned, both currencies absent`
  : `dist ${htmlFiles.length ? 'built without a catalogue fetch' : 'absent'} — source rules only, output unproven`;

console.log(`crawlerSnapshotHasNoPrice: ok (snapshot names products without a price; ${verdict})`);
