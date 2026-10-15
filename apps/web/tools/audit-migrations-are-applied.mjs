#!/usr/bin/env node
//
// Does production actually have what the migrations in this repo declare?
//
//   node apps/web/tools/audit-migrations-are-applied.mjs
//
// Every selfcheck in this repo reads source. None of them can see the database, and that gap has bitten
// twice: audit round 6 shipped a storage lockdown whose migration was never applied, and round 9 closed
// an anon-INSERT hole whose proof had to be run by hand in the SQL editor. 94 chains green, production
// still saying no. This asks the database instead, read-only, and it exits non-zero when something a
// migration declares is not there.
//
// Measured when it was written (2026-10-16, 121 migration files): 33 tables, 1 view, 107 columns and 29
// callable functions declared — all present. So the answer today is yes, and this exists so the answer
// stays checkable rather than remembered.
//
// WHAT IT CANNOT SEE, and nothing here pretends otherwise: 195 `create policy` statements and 106
// indexes. PostgREST exposes neither. The RLS half is probed from the other side instead — with the anon
// key that ships in the browser bundle — which proves what a stranger can READ. It never writes, so an
// anon INSERT policy still has to be checked by hand (the BLOK 3 item).
//
// Three parsing traps, each of which produced a wrong answer before it produced a right one:
//   1. An `alter table X ... add column Y` must be read ONE STATEMENT AT A TIME. A 400-character window
//      paired four columns with the wrong table and reported them all missing — including
//      storefront_vouchers.auth_user_id, which really belongs to storefront_voucher_usage_records.
//   2. A function that RETURNS TRIGGER is never an RPC: PostgREST does not list it, so its absence from
//      the OpenAPI document says nothing. Three were reported missing before this was understood.
//   3. `alter function ... rename to` creates a name that no `create function` statement mentions. Two
//      live RPCs looked like they came from nowhere; both are round 7 renames, in version control.

import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';

const DEFAULT_ENV_PATH = path.resolve('apps/web/.env');
const MIGRATIONS_DIR = path.resolve('supabase/migrations');

const readEnvFile = (targetPath) => {
  if (!fs.existsSync(targetPath)) return {};
  return Object.fromEntries(
    fs.readFileSync(targetPath, 'utf8')
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter((line) => line && !line.startsWith('#') && line.includes('='))
      .map((line) => {
        const at = line.indexOf('=');
        return [line.slice(0, at), line.slice(at + 1)];
      }),
  );
};

/**
 * What the migrations say the database should contain.
 *
 * Exported so the parser — the part that has been wrong three times — can be tested without a database.
 */
export const declaredByMigrations = (files) => {
  const tables = new Map();
  const views = new Map();
  const columns = new Map();
  const callableFunctions = new Map();
  const triggerFunctions = new Set();
  // A name that was created and later dropped, where the parser cannot tell whether the whole function
  // went or just one overload of it. storefront_release_voucher_usage is the live example: created with
  // two signatures, and 20260920160000 drops only the ambiguous (uuid, text, text) one — the PGRST203
  // incident. Name-only tracking cannot decide that, so it says so instead of guessing.
  const ambiguousFunctions = new Map();
  let policies = 0;
  let indexes = 0;

  for (const [name, sql] of files) {
    // Trap 5: every one of these files ends with its rollback written out as real SQL inside a /* ... */
    // block. Stripping only the -- lines left those drops looking executed, which silently removed five
    // columns of storefront_products from the check — the English product copy, which production has.
    const body = sql.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/--[^\n]*/g, ' ');

    // Trap 4: a drop is not final, and WITHIN one file a create can follow a drop. The lockdown pattern
    // does exactly that — `drop function ... ; create function ...` two lines apart — so scanning all
    // creates and then all drops let the drop win and lost two live functions. accords, accord_items,
    // batches and batch_usage_records are the same story across files: dropped in April, re-created in
    // later migrations, and live today. So every statement is collected with its OFFSET and applied in
    // the order it appears. Offsets rather than split(';'), because a function body is full of
    // semicolons inside its $$ quotes.
    const events = [];
    const add = (offset, run) => events.push({ offset, run });
    for (const match of body.matchAll(/create\s+table\s+(?:if\s+not\s+exists\s+)?(?:public\.)?([a-z0-9_]+)/gi)) {
      add(match.index, () => tables.set(match[1], name));
    }
    for (const match of body.matchAll(/drop\s+table\s+(?:if\s+exists\s+)?(?:public\.)?([a-z0-9_]+)/gi)) {
      add(match.index, () => tables.delete(match[1]));
    }
    for (const match of body.matchAll(/create\s+(?:or\s+replace\s+)?view\s+(?:public\.)?([a-z0-9_]+)/gi)) {
      add(match.index, () => views.set(match[1], name));
    }
    for (const match of body.matchAll(/drop\s+view\s+(?:if\s+exists\s+)?(?:public\.)?([a-z0-9_]+)/gi)) {
      add(match.index, () => views.delete(match[1]));
    }
    // Trap 2: a function that RETURNS TRIGGER is never an RPC — PostgREST does not list it, so its
    // absence from the OpenAPI document says nothing about whether the migration ran.
    for (const match of body.matchAll(/create\s+(?:or\s+replace\s+)?function\s+(?:public\.)?([a-z0-9_]+)([\s\S]{0,600}?)\breturns\s+([a-z_ ]+)/gi)) {
      add(match.index, () => {
        // A create after the drop settles it: the name is declared again, so it is no longer ambiguous.
        ambiguousFunctions.delete(match[1]);
        if (/trigger/i.test(match[3])) triggerFunctions.add(match[1]);
        else callableFunctions.set(match[1], name);
      });
    }
    for (const match of body.matchAll(/drop\s+function\s+(?:if\s+exists\s+)?(?:public\.)?([a-z0-9_]+)/gi)) {
      add(match.index, () => {
        if (callableFunctions.has(match[1])) ambiguousFunctions.set(match[1], name);
        callableFunctions.delete(match[1]);
        triggerFunctions.delete(match[1]);
      });
    }
    // Trap 1: an `add column` must be paired with the table of ITS OWN statement. A 400-character window
    // pinned four columns on the wrong table and reported them all missing — including
    // storefront_vouchers.auth_user_id, which belongs to storefront_voucher_usage_records.
    let cursor = 0;
    for (const statement of body.split(';')) {
      const offset = cursor;
      cursor += statement.length + 1;
      const table = statement.match(/alter\s+table\s+(?:if\s+exists\s+)?(?:public\.)?([a-z0-9_]+)/i);
      if (!table) continue;
      for (const match of statement.matchAll(/add\s+column\s+(?:if\s+not\s+exists\s+)?([a-z0-9_]+)/gi)) {
        add(offset + match.index, () => columns.set(`${table[1]}.${match[1]}`, name));
      }
      for (const match of statement.matchAll(/drop\s+column\s+(?:if\s+exists\s+)?([a-z0-9_]+)/gi)) {
        add(offset + match.index, () => columns.delete(`${table[1]}.${match[1]}`));
      }
    }
    events.sort((left, right) => left.offset - right.offset);
    for (const event of events) event.run();

    policies += (body.match(/create\s+policy/gi) || []).length;
    indexes += (body.match(/create\s+(?:unique\s+)?index/gi) || []).length;
  }

  return { tables, views, columns, callableFunctions, ambiguousFunctions, triggerFunctions, policies, indexes };
};

const main = async () => {
  const envPath = path.resolve(process.argv.find((arg) => arg.startsWith('--env-path='))?.split('=')[1] || DEFAULT_ENV_PATH);
  const fileEnv = readEnvFile(envPath);
  const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || fileEnv.SUPABASE_URL || fileEnv.VITE_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || fileEnv.SUPABASE_SERVICE_ROLE_KEY;
  const anonKey = process.env.VITE_SUPABASE_ANON_KEY || fileEnv.VITE_SUPABASE_ANON_KEY;
  if (!url || !serviceKey) {
    console.error(`Missing Supabase URL or SUPABASE_SERVICE_ROLE_KEY. Checked ${envPath}.`);
    process.exit(2);
  }

  const files = fs.readdirSync(MIGRATIONS_DIR)
    .filter((name) => name.endsWith('.sql'))
    .sort()
    .map((name) => [name, fs.readFileSync(path.join(MIGRATIONS_DIR, name), 'utf8')]);
  const declared = declaredByMigrations(files);

  const headers = (key) => ({ apikey: key, Authorization: `Bearer ${key}` });
  const relationState = async (name, key) => {
    const response = await fetch(`${url}/rest/v1/${name}?select=*&limit=1`, { headers: headers(key) });
    if (response.status === 200) return { ok: true, rows: (await response.json()).length };
    return { ok: false, status: response.status, body: (await response.text()).slice(0, 120) };
  };
  const columnState = async (table, column) => {
    const response = await fetch(`${url}/rest/v1/${table}?select=${column}&limit=0`, { headers: headers(serviceKey) });
    if (response.status === 200) return { ok: true };
    const body = await response.text();
    if (/42703/.test(body)) return { ok: false, why: 'column missing' };
    if (response.status === 404) return { ok: false, why: 'table not exposed' };
    return { ok: false, why: `status ${response.status}` };
  };

  const openapi = await (await fetch(`${url}/rest/v1/`, { headers: headers(serviceKey) })).json();
  const liveRpcs = new Set(Object.keys(openapi.paths || {}).filter((p) => p.startsWith('/rpc/')).map((p) => p.slice(5)));

  const missing = [];
  for (const [name, file] of declared.tables) {
    const state = await relationState(name, serviceKey);
    if (!state.ok) missing.push(`table ${name} (${file}) -> ${state.status}`);
  }
  for (const [name, file] of declared.views) {
    const state = await relationState(name, serviceKey);
    if (!state.ok) missing.push(`view ${name} (${file}) -> ${state.status}`);
  }
  for (const [key, file] of declared.columns) {
    const [table, column] = key.split('.');
    const state = await columnState(table, column);
    if (!state.ok) missing.push(`column ${key} (${file}) -> ${state.why}`);
  }
  for (const [name, file] of declared.callableFunctions) {
    // Trap 3: a renamed function keeps working under its new name; only a name nothing live answers to
    // is a problem.
    if (!liveRpcs.has(name)) missing.push(`function ${name} (${file}) -> not exposed as an RPC`);
  }

  console.log(`${files.length} migration file(s) declare: ${declared.tables.size} table(s), ${declared.views.size} view(s), `
    + `${declared.columns.size} column(s), ${declared.callableFunctions.size} callable function(s).`);
  console.log(`Not visible through PostgREST, so not checked here: ${declared.policies} policy statement(s), ${declared.indexes} index(es).`);

  // Not a failure, but worth seeing: a function production answers to that no `create function` in this
  // repo declares. Two of them are round 7 renames (`alter function ... rename to`), which is why a
  // name can be live and uncreated; anything else on this list would be a function made by hand in the
  // SQL editor, which a fresh database could not be brought up to match.
  const uncreated = [...liveRpcs].filter((name) => !declared.callableFunctions.has(name));
  if (uncreated.length) {
    console.log(`\nLive RPC(s) no create statement declares — renames, or made by hand: ${uncreated.join(', ')}`);
  }
  if (declared.ambiguousFunctions.size) {
    console.log(`Function name(s) dropped after being created, where only an overload may have gone, so `
      + `the parser leaves them unchecked: ${[...declared.ambiguousFunctions.keys()].join(', ')}`);
  }

  if (anonKey) {
    const readable = [];
    const filtered = [];
    for (const name of [...declared.tables.keys(), ...declared.views.keys()].sort()) {
      const asService = await relationState(name, serviceKey);
      if (!asService.ok) continue;
      const asAnon = await relationState(name, anonKey);
      if (asAnon.ok && asAnon.rows > 0) readable.push(name);
      else if (asService.rows > 0) filtered.push(name);
    }
    console.log(`\nWith the anon key that ships in the browser bundle: ${readable.length} relation(s) return rows, `
      + `${filtered.length} hold rows that RLS keeps back.`);
    console.log(`  readable: ${readable.join(', ')}`);
  } else {
    console.log('\nNo VITE_SUPABASE_ANON_KEY found, so the RLS read probe was skipped.');
  }

  if (missing.length) {
    console.error(`\n${missing.length} declared object(s) are NOT in production:\n  ${missing.join('\n  ')}`);
    console.error('\nA migration in supabase/migrations is not applied. Run it in the Supabase SQL editor.');
    process.exit(1);
  }
  console.log('\nEvery table, view, column and callable function the migrations declare is present.');
};

if (import.meta.url === `file://${process.argv[1]}`) {
  await main();
}
