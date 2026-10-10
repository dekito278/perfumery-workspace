// `node src/utils/formulaWritesAreObserved.selfcheck.mjs`
//
// The same rule orderWrites.selfcheck.mjs holds over storefront_orders, for the formulas — which are
// this shop's core asset and had no such guard.
//
// PostgREST answers a write the policies refuse with 200 and error === null. A write that does not ask
// for its affected rows cannot tell that apart from success, and in this file two of them could not:
//
//   updateFormula   deleted the composition without .select(), then inserted the new one. A refused
//                   delete is WORSE than a no-op here: the insert lands on top and the formula carries
//                   both compositions, its percentages summing to 200.
//   deleteFormula   reported success on a refused delete, and the formula came back on the next refresh.
//
// And one asymmetry of the other kind: createFormula rolls its formula row back when the items insert
// fails — added in audit round 8, because the failure otherwise left an item-less formula behind and the
// perfumer's retry made a second one. duplicateFormula does the identical thing and never learned it.
//
// Measured on production 2026-10-11: 27 formulas, 680 items, every formula summing to 100% and not one
// item pointing at a material that no longer exists. Nothing has gone wrong yet; these are the paths by
// which it would, silently.
process.env.TZ = 'Asia/Jakarta';

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const source = readFileSync(join(root, 'services', 'formulasSupabaseService.js'), 'utf8');

// ── 1. Every mutation of either table observes its affected rows ──────────────────────────────────
// The subject is read from the code, so a write added tomorrow is checked the day it appears.
const TABLES = ['formulas', 'formula_items'];
let mutations = 0;
let exempt = 0;
for (const table of TABLES) {
  const pattern = new RegExp(`from\\('${table}'\\)\\s*\\n?\\s*\\.(update|delete)\\(`, 'g');
  for (const match of source.matchAll(pattern)) {
    mutations += 1;
    // The statement this mutation belongs to, up to its semicolon.
    const tail = source.slice(match.index, source.indexOf(';', match.index) + 1);
    // deleteFormula is the one registered exception; section 3 holds its reason.
    if (/\.eq\('id', formulaId\)/.test(tail) && !tail.includes('.select(')) {
      exempt += 1;
      continue;
    }
    assert.ok(
      tail.includes('.select('),
      `a .${match[1]}() on ${table} does not .select() its affected rows, so a refused write would look like success:\n${tail}`,
    );
  }
}
assert.ok(mutations >= 4, `expected the formula tables to still be written to, found ${mutations} mutations`);
assert.equal(exempt, 1, `expected exactly one registered exception, found ${exempt}`);

// ── 2. Replacing a composition proves the old rows went ───────────────────────────────────────────
assert.match(
  source,
  /if \(previousItems\.length && !\(deletedItems \|\| \[\]\)\.length\) \{/,
  'updateFormula must refuse to insert a new composition when the old rows were not actually deleted',
);
// And the snapshot the rollback depends on must itself be observed.
assert.match(
  source,
  /const \{ data: previousItems, error: previousItemsError \}/,
  'the pre-delete snapshot must observe its error — otherwise the rollback is silently impossible',
);
assert.match(
  source,
  /if \(previousItemsError\) \{/,
  'and act on it',
);

// ── 3. deleteFormula is a deliberate exception, and stays one ────────────────────────────────────
// I changed it to assert a row came back, and silentWrites.selfcheck.mjs failed with
// "ALLOWED lists functions that no longer write silently" — an allowlist keeping itself honest, and its
// reasoning was better than mine: this table is RLS'd on auth.uid() = user_id, so a refusal would mean
// deleting someone else's formula, which cannot arise from a list the user renders out of their own
// rows. What zero rows means here is that the formula is already gone — a double-tap, or a delete from
// a stale list — and throwing on that turns an idempotent delete into an error about nothing.
//
// So this one is exempt BY NAME, and the exemption has to stay registered where its reason lives.
const silentWrites = readFileSync(join(root, 'utils', 'silentWrites.selfcheck.mjs'), 'utf8');
assert.match(
  silentWrites,
  /'services\/formulasSupabaseService\.js:deleteFormula': 'user-scoped RLS/,
  'deleteFormula must stay on the silent-write allowlist with its reason, or be made loud deliberately',
);

// ── 4. Both half-made-copy paths clean up after themselves ────────────────────────────────────────
// create learned this in round 8; duplicate is the mirror. Held as a property of BOTH, so neither can
// lose it again.
for (const [name, start, end] of [
  ['createFormula', 'export const createFormula', 'export const updateFormula'],
  ['duplicateFormula', 'export const duplicateFormula', undefined],
]) {
  const body = source.slice(source.indexOf(start), end ? source.indexOf(end) : undefined);
  assert.match(
    body,
    /itemsError[\s\S]{0,800}from\('formulas'\)\.delete\(\)\.eq\('id'/,
    `${name} leaves an item-less formula behind when its items fail to insert`,
  );
}

// ── 5. The dead lineage retry is not load-bearing ─────────────────────────────────────────────────
// `isMissingLineageColumn` exists because 20260914140000_formula_revision_lineage.sql was applied by
// hand. It is in supabase/migrations/ now and both columns are live on production, so the retry can no
// longer run — and if it ever did it would silently create a revision with no ancestry. Left in place
// rather than deleted, but pinned to its premise: the day the migration moves out of migrations/, this
// says so instead of the fallback quietly becoming load-bearing again.
const { readdirSync } = await import('node:fs');
const migrations = readdirSync(join(root, '..', '..', '..', 'supabase', 'migrations'));
assert.ok(
  migrations.includes('20260914140000_formula_revision_lineage.sql'),
  'the formula lineage migration is no longer applied automatically, so the silent drop-the-columns retry in createFormula is load-bearing again — make it loud',
);

console.log(`formulaWritesAreObserved: ok — ${mutations} mutations on the formula tables, every one of them observed`);
