// `node src/utils/bespokeBriefIsWhole.selfcheck.mjs`
//
// A bespoke brief is what the customer asked for. Four Studio screens showed it, each with its own
// hand-written row list, and the four disagreed about two things.
//
// Language: the desktop order list labelled them in English — "Preferred aroma", "Occasion", "Bottle",
// "Reference scent" — while its three siblings used Indonesian. Studio is Indonesian on purpose.
//
// Content, which is the half that matters: avoidedNotes appeared on the desktop LIST and nowhere else.
// Not on either order detail page — the screens where a brief is actually read before the perfume is
// made. It is stored on every bespoke order, and it is the one line that describes what ruins the
// result rather than what it should aim for.
//
// The rule: every field of the stored brief reaches the screen, and Studio says it in Studio's language.
// Derived from the writer — the bespoke object in orderService.js — rather than from a list beside the
// reader, because a list beside the reader is what drifted four ways.
import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { Buffer } from 'node:buffer';

const src = dirname(fileURLToPath(import.meta.url)).replace(/\/utils$/, '');

const workflow = readFileSync(join(src, 'utils', 'orderWorkflow.js'), 'utf8')
  .replace(/^import\b[\s\S]*?from '[^']+';\n/gm, '');
const stubs = 'const getBespokeItem = () => null;\nconst isBespokeOrder = () => false;\n'
  + 'const getOrderReservationExpiresAt = () => "";\nconst PAYMENT_RESERVATION_TTL_HOURS = 24;\n';
const { bespokeBriefRows } = await import(
  `data:text/javascript;base64,${Buffer.from(stubs + workflow, 'utf8').toString('base64')}`
);

// --- 1. The rows, built ------------------------------------------------------------------------------
const brief = {
  perfumeName: 'Untuk Ibu', preferredNotes: 'melati, vanila', avoidedNotes: 'oud, tembakau',
  occasion: 'ulang tahun', size: '30 ml', bottleType: 'Bening', capDesign: 'Kayu',
  labelDesign: 'Tulis tangan', exoticMaterial: 'Ambergris', budget: 'Rp 2 juta',
  referenceProductName: 'La Rose', story: 'Wangi rumah nenek',
};
const rows = bespokeBriefRows(brief);
const labels = rows.map(([label]) => label);

assert.ok(labels.includes('Aroma dihindari'),
  'the aromas the customer asked NOT to have are missing. Every other line says what to aim for; this '
  + 'is the only one that says what ruins it');
assert.equal(rows.find(([label]) => label === 'Aroma dihindari')[1], 'oud, tembakau');
// Empty lines are dropped, or a brief with three answers renders twelve rows of nothing.
assert.deepEqual(bespokeBriefRows({ occasion: 'ulang tahun' }), [['Momen', 'ulang tahun']]);
assert.deepEqual(bespokeBriefRows({}), [], 'an empty brief is no rows');
assert.deepEqual(bespokeBriefRows(), [], 'and a missing one must not throw on a list screen');
// scentDescription and preferredNotes are the same answer stored twice; either alone must fill the row.
assert.equal(bespokeBriefRows({ scentDescription: 'hangat' })[0][1], 'hangat');

// Studio's language. The rows are Studio-only — the buyer's portal translates its own.
for (const english of ['Preferred aroma', 'Occasion', 'Bottle', 'Reference scent', 'Avoided notes']) {
  assert.ok(!labels.includes(english),
    `Studio is Indonesian on purpose and this row is labelled "${english}"`);
}

// --- 2. Every field the brief STORES reaches a row ------------------------------------------------------
const service = readFileSync(join(src, 'services', 'orderService.js'), 'utf8');
const start = service.indexOf('  bespoke: {');
const stored = service.slice(start, service.indexOf('\n  },', start))
  .match(/^\s{4}(\w+):/gm)
  .map((line) => line.trim().replace(':', ''));
assert.ok(stored.length >= 8, `expected the stored brief fields, found ${stored.join(', ')}`);

// Kept out on purpose, each for a reason rather than by oversight.
const NOT_A_ROW = new Set([
  'optionIds',              // the raw option ids behind Botol/Cap/Label, already shown as their labels
  'referenceProductSlug',   // a link target; the name beside it is what a person reads
  'preorderAcknowledged',   // a checkbox the buyer ticked, not part of what they asked for
  'notes',                  // legacy alias of preferredNotes, read as a fallback inside the row
  'scentDescription',       // ditto
]);
const rowsSource = readFileSync(join(src, 'utils', 'orderWorkflow.js'), 'utf8');
const briefBlock = rowsSource.slice(rowsSource.indexOf('export const bespokeBriefRows'));
const unshown = stored.filter((field) => !NOT_A_ROW.has(field) && !briefBlock.includes(`item?.${field}`));
assert.deepEqual(unshown, [],
  'the brief stores something Studio never shows. A bespoke order is made from this text and nothing '
  + `else: ${unshown.join(', ')}`);

// --- 3. And no screen writes its own list again -----------------------------------------------------------
const screens = [];
const walk = (dir) => {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) walk(full);
    else if (entry.name.endsWith('.jsx')) screens.push(full);
  }
};
walk(join(src, 'pages'));

const studioBriefScreens = screens.filter((file) => {
  const text = readFileSync(file, 'utf8');
  return /bespokeBriefRows\(|const bespokeDetailRows = /.test(text) && !/CustomerPortalPage/.test(file);
});
assert.ok(studioBriefScreens.length >= 4,
  `expected the four Studio screens that show a brief, found ${studioBriefScreens.length}`);
for (const file of studioBriefScreens) {
  const where = file.slice(src.length + 1);
  assert.doesNotMatch(readFileSync(file, 'utf8'), /const bespokeDetailRows = /,
    `${where} has grown its own row list again — four of those drifted into two languages and lost a field`);
}

console.log(`bespokeBriefIsWhole selfcheck OK (${stored.length} stored fields, ${labels.length} rows, `
  + `${studioBriefScreens.length} Studio screens reading the same brief)`);
