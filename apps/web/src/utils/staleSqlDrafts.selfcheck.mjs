// `node src/utils/staleSqlDrafts.selfcheck.mjs` — SQL that sits in docs/ is copy-paste material: nothing
// runs it automatically, so the only thing standing between a draft and production is a person reading
// the comment above it. A draft written before a hole was closed keeps proposing the weaker shape, and
// the comment that says "apply this" outlives the reason.
//
// The rule is not "drafts must carry a marker" — a marker is a label, and a label can be true while the
// SQL under it is wrong. The rule is that a RUNNABLE statement in docs/ may not contradict what a
// migration already established. Both sides are read from disk: the live shape comes from the newest
// migration that defines it, the draft side from every .sql file and every ```sql fence under docs/.
// Comment a dangerous draft out and it stops being runnable, which is the honest fix.
import assert from 'node:assert/strict';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const repo = join(here, '..', '..', '..', '..');
const migrationsDir = join(repo, 'supabase', 'migrations');
const docsDir = join(repo, 'docs');

// A line comment makes the rest of the line unrunnable. Everything left is what the SQL editor would do.
const runnable = (sql) => sql.split('\n').map((line) => line.replace(/--.*$/, '')).join('\n');

const walk = (dir) => readdirSync(dir).flatMap((entry) => {
  const full = join(dir, entry);
  return statSync(full).isDirectory() ? walk(full) : [full];
});

// Every piece of SQL a reader could copy out of docs/: whole .sql files, plus ```sql fences in markdown.
const docsSql = walk(docsDir).flatMap((file) => {
  if (file.endsWith('.sql')) return [{ file, sql: readFileSync(file, 'utf8') }];
  if (!file.endsWith('.md')) return [];
  return [...readFileSync(file, 'utf8').matchAll(/```sql\n([\s\S]*?)```/g)].map((m) => ({ file, sql: m[1] }));
});
assert.ok(docsSql.length >= 5, `only ${docsSql.length} SQL snippets found under docs/ — the scan is broken`);

// Read a `returns table ( ... )` column list by balancing parentheses; a regex stops at the first `)`,
// which inside `numeric(10,2)` is the wrong one.
const returnsTableColumns = (sql, from) => {
  const open = sql.toLowerCase().indexOf('returns table', from);
  if (open === -1) return null;
  const start = sql.indexOf('(', open);
  let depth = 0;
  let end = -1;
  for (let i = start; i < sql.length; i += 1) {
    if (sql[i] === '(') depth += 1;
    else if (sql[i] === ')') {
      depth -= 1;
      if (depth === 0) { end = i; break; }
    }
  }
  if (end === -1) return null;
  // Split on top-level commas only, then take each entry's first word.
  const inner = sql.slice(start + 1, end);
  const parts = [];
  let buf = '';
  depth = 0;
  for (const ch of inner) {
    if (ch === '(') depth += 1;
    if (ch === ')') depth -= 1;
    if (ch === ',' && depth === 0) { parts.push(buf); buf = ''; continue; }
    buf += ch;
  }
  parts.push(buf);
  return parts.map((p) => p.trim().split(/\s+/)[0]).filter(Boolean);
};

const definitions = (sql, name) => {
  const pattern = new RegExp(`create\\s+(?:or\\s+replace\\s+)?function\\s+public\\.${name}\\s*\\(`, 'gi');
  return [...sql.matchAll(pattern)].map((m) => returnsTableColumns(sql, m.index)).filter(Boolean);
};

const migrations = readdirSync(migrationsDir).filter((f) => f.endsWith('.sql')).sort();

// ---------------------------------------------------------------------------------------------------
// 1. storefront_lookup_customer — anon-callable, keyed on a 5-digit code. Round 7 cut it back to the
//    three fields a code guess may safely reveal. A draft that returns more than the live function is a
//    regression, not a hardening, however its header describes itself.
// ---------------------------------------------------------------------------------------------------
const lookupMigrations = migrations.filter((f) => definitions(readFileSync(join(migrationsDir, f), 'utf8'), 'storefront_lookup_customer').length > 0);
assert.ok(lookupMigrations.length > 0, 'no migration defines storefront_lookup_customer — update this guard');
const liveLookup = definitions(readFileSync(join(migrationsDir, lookupMigrations.at(-1)), 'utf8'), 'storefront_lookup_customer').at(-1);
assert.ok(liveLookup?.length >= 2, `could not read the live storefront_lookup_customer columns from ${lookupMigrations.at(-1)}`);

for (const { file, sql } of docsSql) {
  for (const columns of definitions(runnable(sql), 'storefront_lookup_customer')) {
    const extra = columns.filter((column) => !liveLookup.includes(column));
    assert.equal(
      extra.length,
      0,
      `${file.slice(repo.length + 1)} defines storefront_lookup_customer returning ${extra.join(', ')}, which ${lookupMigrations.at(-1)} deliberately removed `
      + `(live columns: ${liveLookup.join(', ')}). Anyone who runs this snippet re-opens the round-7 PII sweep. Comment it out.`,
    );
  }
}

// ---------------------------------------------------------------------------------------------------
// 2. storefront_orders INSERT — the CRITICAL of round 9. The live policy is admin-only; a runnable
//    `with check (true)` in docs/ (a rollback line, a "sketch") hands the hole straight back.
// ---------------------------------------------------------------------------------------------------
// A regex cannot read `with check (public.is_admin())` — it stops at the inner `)`. Balance instead.
const balanced = (sql, openIndex) => {
  let depth = 0;
  for (let i = openIndex; i < sql.length; i += 1) {
    if (sql[i] === '(') depth += 1;
    else if (sql[i] === ')') {
      depth -= 1;
      if (depth === 0) return sql.slice(openIndex + 1, i);
    }
  }
  return null;
};

const policyChecks = (sql) => [...sql.matchAll(/create\s+policy\s+"[^"]*"\s+on\s+public\.storefront_orders\b/gi)].flatMap((m) => {
  const tail = sql.slice(m.index, m.index + 600);
  if (!/\bfor\s+insert\b/i.test(tail)) return [];
  const check = tail.toLowerCase().indexOf('with check');
  if (check === -1) return [];
  const expression = balanced(tail, tail.indexOf('(', check));
  return expression === null ? [] : [expression.replace(/\s+/g, ' ').trim().toLowerCase()];
});

const policyMigrations = migrations.filter((f) => policyChecks(readFileSync(join(migrationsDir, f), 'utf8')).length > 0);
assert.ok(policyMigrations.length > 0, 'no migration creates an INSERT policy on storefront_orders — update this guard');
const liveCheck = policyChecks(readFileSync(join(migrationsDir, policyMigrations.at(-1)), 'utf8')).at(-1);
assert.notEqual(liveCheck, 'true', `the live INSERT policy on storefront_orders checks "${liveCheck}" — the anon hole is open in the repo itself`);

for (const { file, sql } of docsSql) {
  for (const check of policyChecks(runnable(sql))) {
    assert.equal(
      check,
      liveCheck,
      `${file.slice(repo.length + 1)} creates an INSERT policy on storefront_orders checking "${check}", but the live policy `
      + `(${policyMigrations.at(-1)}) checks "${liveCheck}". Running it re-opens the round-9 CRITICAL. Comment it out.`,
    );
  }
}

console.log(`staleSqlDrafts selfcheck OK (${docsSql.length} snippets; lookup columns: ${liveLookup.join('/')}; orders insert check: ${liveCheck})`);
