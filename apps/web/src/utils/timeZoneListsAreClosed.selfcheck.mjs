// `node src/utils/timeZoneListsAreClosed.selfcheck.mjs`
//
// Every hand-written list of IANA time zones in this app, checked against the engine rather than against
// someone's memory of what the zones are called.
//
// A browser reports its clock as a string, and this app compares that string to a list. IANA renames
// zones and keeps the old name as a link — and ICU builds do not agree on which spelling is canonical.
// Measured: on this repo's Node, Intl resolves Asia/Yangon BACKWARDS to Asia/Rangoon, while a current
// browser reports Asia/Yangon. ASIA_TIME_ZONES carried only one of the two, so a buyer in Yangon was
// quoted the 3.5x world price instead of 2.2x — a 59% surcharge (#369).
//
// Asia/Saigon was in that list from the start for exactly this reason. The fix existed; the rule did not.
//
// THE LISTS ARE SWEPT, NOT LISTED. The whole reason this file exists rather than an assertion inside the
// two chains that happen to know about these lists: the next list someone writes has to be caught by
// this, not by the next audit. A list named in a guard is a list the guard stops looking for.
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const srcRoot = join(dirname(fileURLToPath(import.meta.url)), '..');

const files = [];
const walk = (dir) => {
  for (const entry of readdirSync(join(srcRoot, dir), { withFileTypes: true })) {
    const rel = dir ? `${dir}/${entry.name}` : entry.name;
    if (entry.isDirectory()) { walk(rel); continue; }
    // .mjs excluded: a selfcheck's own fixtures are allowed to name a zone that is deliberately absent
    // from a list, which is how several of them prove the list refuses an outsider.
    if (/\.jsx?$/.test(entry.name)) files.push(rel);
  }
};
walk('');

// An IANA zone as a browser reports one: Region/City, optionally Region/Area/City.
const ZONE = /'([A-Z][A-Za-z_-]+(?:\/[A-Za-z_+-]+){1,2})'/g;
// Only arrays, and only arrays with more than one zone in them: a single zone in isolation is a constant,
// not a list that can fall out of step with the engine.
const ARRAY = /\[([^[\]]*?)\]/gs;

const lists = [];
for (const rel of files) {
  const source = readFileSync(join(srcRoot, rel), 'utf8')
    .replace(/\/\*[\s\S]*?\*\//g, ' ')
    .replace(/^\s*\/\/.*$/gm, ' ');
  for (const array of source.matchAll(ARRAY)) {
    const zones = [...array[1].matchAll(ZONE)].map((m) => m[1]);
    if (zones.length < 2) continue;
    // Real zones only: Intl is the judge of that too, so a list of CSS classes or route paths that
    // happens to look like Region/City cannot wander in.
    const real = zones.filter((zone) => {
      try { new Intl.DateTimeFormat('en-US', { timeZone: zone }); return true; } catch { return false; }
    });
    if (real.length !== zones.length || real.length < 2) continue;
    lists.push({ file: rel, zones: real });
  }
}

assert.ok(lists.length >= 2,
  `expected to find the app's time zone lists by sweeping; found ${lists.length}. Either they moved out `
  + 'of array literals, or this sweep stopped matching them.');

// Printed, because a derived guard that cannot name what it found is a guard nobody can check. #356 went
// green while missing a whole screen; the fix is to read the list out loud.
for (const { file, zones } of lists) console.log(`  ${file}: ${zones.length} zones`);

// The files whose lists decide money or which shop a reader sees. Not the subject of the rule — the rule
// is over everything swept — but a floor under the sweep: if either stops being found, the sweep broke.
for (const required of ['utils/shippingRegion.js', 'utils/overseasVisitor.js']) {
  assert.ok(lists.some((entry) => entry.file === required),
    `${required} holds a time zone list that decides a price, and this sweep no longer sees it`);
}

const canonical = (zone) => {
  try {
    return new Intl.DateTimeFormat('en-US', { timeZone: zone }).resolvedOptions().timeZone;
  } catch {
    return zone;
  }
};

// BOTH DIRECTIONS, and both asked of the engine.
//
// 1. A listed zone whose canonical spelling is NOT in its own list. This is the Yangon case: the engine
//    reports Asia/Rangoon, the list said Asia/Yangon, the reader fell out of the list.
// 2. A spelling the engine CAN report which resolves INTO the list but is not in it. The mirror, and the
//    half a first version of this rule could not see: it only walked zones that were already listed.
//
// Intl.supportedValuesOf('timeZone') is what makes the second one finite — 418 zones here, and anything
// outside it cannot reach this app from this engine at all. That is also what closed the one open question
// this rule raised: Asia/Ujung_Pandang, the legacy name for Asia/Makassar, is absent from that set, so no
// Indonesian in Sulawesi can be mistaken for an overseas visitor by a spelling. Measured, not assumed.
const reportable = typeof Intl.supportedValuesOf === 'function' ? Intl.supportedValuesOf('timeZone') : [];
assert.ok(reportable.length > 300, `expected this engine to enumerate its zones; got ${reportable.length}`);

let examined = 0;
let renamed = 0;
const unlisted = [];
const missingAlias = [];
for (const { file, zones } of lists) {
  for (const zone of zones) {
    examined += 1;
    const spelling = canonical(zone);
    if (spelling === zone) continue;
    renamed += 1;
    if (!zones.includes(spelling)) unlisted.push(`${file}: ${zone} -> ${spelling}`);
  }
  for (const zone of reportable) {
    if (zones.includes(zone)) continue;
    if (zones.includes(canonical(zone))) missingAlias.push(`${file}: ${zone} -> ${canonical(zone)}`);
  }
}

assert.deepEqual(unlisted, [],
  'this engine reports these zones under a spelling their own list does not carry, so a reader whose '
  + 'device reports it falls out of the list and is priced as if they were somewhere else:\n  '
  + unlisted.join('\n  '));
assert.deepEqual(missingAlias, [],
  'this engine can report these spellings, and each resolves to a zone that IS in the list — but the '
  + 'spelling itself is not, so the raw string comparison misses it:\n  ' + missingAlias.join('\n  '));

// Counted, because "no violators" is true of an empty sweep — the first version of this rule passed a
// sabotage that walked nothing at all.
assert.equal(examined, lists.reduce((sum, entry) => sum + entry.zones.length, 0),
  'every zone found must be examined, not some of them');
assert.ok(renamed >= 2,
  `this engine should report at least two of these zones under a second spelling; found ${renamed}. `
  + 'Either the aliases were dropped from a list, or this loop stopped looking.');

// And the entries that exist FOR OTHER ENGINES must survive a tidy-up. Asia/Macao, Asia/Ho_Chi_Minh and
// Asia/Yangon are all absent from this Node's reportable set — a reader of this file could reasonably
// conclude they are dead weight and delete them, which would break exactly the browsers that report them.
const forOtherEngines = lists.flatMap(({ file, zones }) => zones
  .filter((zone) => !reportable.includes(zone))
  .map((zone) => `${file}: ${zone}`));
assert.ok(forOtherEngines.length >= 3,
  'the second spelling of each renamed zone is carried for engines OTHER than this one and must not be '
  + `tidied away; expected at least 3 such entries, found ${forOtherEngines.length}`);
console.log(`  carried for other engines (unreportable here, do not delete): ${forOtherEngines.join(', ')}`);

console.log(`timeZoneListsAreClosed selfcheck OK (${lists.length} lists, ${examined} zones, ${renamed} renamed, ${reportable.length} reportable spellings checked both ways)`);
