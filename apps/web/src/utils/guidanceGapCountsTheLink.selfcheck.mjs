// `node src/utils/guidanceGapCountsTheLink.selfcheck.mjs`
//
// Both Studio dashboards show a "Celah panduan" / "Guidance gaps" card, and both cards NAVIGATE to the
// raw-materials screen. The card and the screen it opens disagreed.
//
// The dashboards each kept a private two-line predicate reading five denormalised columns on the
// raw_materials row and nothing else. But the guidance does not only live there:
// raw_material_reference_links joins a material to a material_reference_profiles row, and the
// raw-materials screen resolves guidance THROUGH that link — enrichMaterialsWithGuidance and
// getResolvedGuidanceValues both fall back to the linked profile for every one of those fields.
//
// Measured on production 2026-10-11, 774 raw materials:
//
//   666  have a primary reference link
//   589  satisfy the dashboards' five-column test
//   185  the card counted as a gap
//    83  of those 185 have a primary profile that really carries guidance — an ABC family, an impact, a
//        life in hours or an IFRA limit
//
// Same shape as isReadyToPack, which this codebase already fixed for orders: a card that promises what
// another screen will show has to count with that screen's rule.
process.env.TZ = 'Asia/Jakarta';

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { hasGuidanceCoverage, materialsWithoutGuidance } from './guidanceGap.js';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const stripComments = (source) => source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '').replace(/\{\/\*[\s\S]*?\*\/\}/g, '');
const read = (...parts) => stripComments(readFileSync(join(root, ...parts), 'utf8'));

// ── 1. The 83 that reported this ──────────────────────────────────────────────────────────────────
// A material whose own columns are empty, with a primary reference profile behind it.
const linkedOnly = { id: 'linked-only' };
assert.equal(hasGuidanceCoverage(linkedOnly), false,
  'with no link set, the five-column test is all there is — the old answer');
assert.equal(hasGuidanceCoverage(linkedOnly, new Set(['linked-only'])), true,
  'a material with a primary reference profile is not a guidance gap, whatever its own columns say');
assert.deepEqual(materialsWithoutGuidance([linkedOnly], new Set(['linked-only'])), [],
  'and it must not appear in the preview list under the count either');

// ── 2. The 7 that go the other way ────────────────────────────────────────────────────────────────
// Coverage is a link OR a column, not a link instead of one: 7 materials carry one of the five and have
// no link at all, and the resolver finds guidance for those too.
for (const [field, value] of [
  ['workbook_code', 'W-1024'],
  ['reference_abc_primary_family', 'Woody'],
  ['reference_impact', 42],
  ['reference_life_hours', 8],
  ['ifra_limit', 0.5],
]) {
  assert.equal(hasGuidanceCoverage({ id: 'x', [field]: value }, new Set()), true,
    `${field} alone is still guidance, with no link`);
}
// Zero is a value. `reference_impact: 0` is a measured impact, not a missing one.
assert.equal(hasGuidanceCoverage({ id: 'x', reference_impact: 0 }, new Set()), true,
  'an impact of 0 is an answer, not an absence');
assert.equal(hasGuidanceCoverage({ id: 'x', ifra_limit: 0 }, new Set()), true,
  'an IFRA limit of 0 is an answer too — it means the material is restricted to nothing');
// And nothing at all is a gap.
assert.deepEqual(materialsWithoutGuidance([{ id: 'bare' }], new Set()).map((m) => m.id), ['bare']);
// A missing set must not throw, and must not silently call everything covered.
assert.deepEqual(materialsWithoutGuidance([{ id: 'bare' }]).map((m) => m.id), ['bare']);
assert.deepEqual(materialsWithoutGuidance([{ id: 'bare' }], null).map((m) => m.id), ['bare']);

// ── 3. Neither dashboard keeps its own copy, and both ASK about the link ─────────────────────────
for (const file of ['pages/DashboardPage.jsx', 'pages/mobile/MobileDashboardPage.jsx']) {
  const source = read(...file.split('/'));
  assert.ok(
    !source.includes('const hasGuidanceCoverage'),
    `${file} has grown its own guidance-coverage rule again`,
  );
  assert.match(
    source,
    /materialsWithoutGuidance\(materials, matchedReferenceIds\)/,
    `${file} must count the gap with the shared rule, over the reference links`,
  );
  // The ids have to be LOADED, not merely passed: an empty set silently restores the old answer.
  //
  // Held to the CALL, not the name. The name also sits in the hook destructure and in the effect's
  // dependency array, so a regex for it alone stayed green when the loader line was deleted and
  // referenceSummary became undefined — the old count, back, with the guard none the wiser.
  assert.match(
    source,
    /fetchMaterialsReferenceSummary\(\)|runWith\w+\(fetchMaterialsReferenceSummary,/,
    `${file} names the reference-summary loader but never calls it`,
  );
  assert.match(
    source,
    /matchedReferenceIds \|\| new Set\(\)/,
    `${file} must take the ids from the reference summary`,
  );
  // And the count and the preview list must come from the same call.
  assert.match(
    source,
    /guidanceGapPreview[\s\S]{0,160}missingGuidanceMaterials/,
    `${file} must preview the same materials it counted`,
  );
}

// ── 4. The service really answers with them ──────────────────────────────────────────────────────
const service = read('services', 'rawMaterialsService.js');
assert.match(service, /matchedReferenceIds: new Set\(/,
  'getRawMaterialsReferenceSummary must return WHICH materials are matched, not only how many');
assert.match(service, /\.select\('raw_material_id'\)\s*\n\s*\.eq\('is_primary', true\)/,
  'and it must read them from the primary links');
assert.match(service, /if \(matchedRowsError\) \{/,
  'a failed read of the links must not pass as an empty set, which would restore the old count');

console.log('guidanceGapCountsTheLink: ok — one rule, both dashboards, and the link is part of it');
