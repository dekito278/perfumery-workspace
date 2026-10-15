// `node src/utils/migrationParserReadsSqlInOrder.selfcheck.mjs`
//
// tools/audit-migrations-are-applied.mjs asks the production database whether everything the 121
// migrations declare is actually there — the one question no other check in this repo can ask, and the
// gap that let a storage lockdown sit unapplied through a whole audit round.
//
// Its answer is only worth the parser underneath it, and that parser was wrong FIVE times before it was
// right. Each time the failure was in the same direction: it quietly checked fewer things and still
// printed a clean bill. Nothing about that is visible in the output, which is why the traps are pinned
// here with the smallest SQL that reproduces each.
//
// The tool itself cannot run in this guard — it needs the service-role key and a network — so what is
// tested is the half that decides what gets asked.
import assert from 'node:assert/strict';
import { declaredByMigrations } from '../../tools/audit-migrations-are-applied.mjs';

const declare = (files) => declaredByMigrations(Object.entries(files));

// --- Trap 1: a column belongs to the table of its OWN statement ---------------------------------------
// A 400-character window pinned four columns on the wrong table and reported all four missing. The real
// shape, straight out of 20260915020000_voucher_per_account_limit.sql.
{
  const { columns } = declare({
    'a.sql': `
      alter table public.storefront_vouchers
          add column if not exists usage_limit_per_account integer not null default 0;
      alter table public.storefront_voucher_usage_records
          add column if not exists auth_user_id uuid;
    `,
  });
  assert.ok(columns.has('storefront_voucher_usage_records.auth_user_id'),
    'auth_user_id belongs to the usage records, and a window-based parse pinned it on storefront_vouchers');
  assert.ok(!columns.has('storefront_vouchers.auth_user_id'),
    'storefront_vouchers has no auth_user_id — claiming it does reports a column missing that was never '
    + 'declared, which is how four false alarms were produced');
  assert.ok(columns.has('storefront_vouchers.usage_limit_per_account'));
}

// --- Trap 2: a trigger function is not an RPC ----------------------------------------------------------
// PostgREST does not expose a function that returns trigger, so its absence from the OpenAPI document
// says nothing. Three were reported missing before this was understood.
{
  const { callableFunctions, triggerFunctions } = declare({
    'a.sql': `
      create or replace function public.set_updated_at()
      returns trigger
      language plpgsql
      as $$ begin new.updated_at = now(); return new; end; $$;

      create or replace function public.storefront_deduct_inventory_for_order(p_order_id text)
      returns jsonb
      language plpgsql
      as $$ begin return '[]'::jsonb; end; $$;
    `,
  });
  assert.ok(triggerFunctions.has('set_updated_at'), 'a trigger function must be set aside, not checked as an RPC');
  assert.ok(!callableFunctions.has('set_updated_at'), 'and it must not be expected in the RPC list');
  assert.ok(callableFunctions.has('storefront_deduct_inventory_for_order'), 'a jsonb-returning function IS an RPC');
}

// --- Trap 4: a drop is not final, across files AND within one -----------------------------------------
// accords, accord_items, batches and batch_usage_records each carry an April `drop table` and are all
// live today, because later migrations re-created them. And the lockdown pattern drops a function two
// lines before re-creating it, so scanning all creates then all drops let the drop win and lost two.
{
  const { tables } = declare({
    '1_create.sql': 'create table public.accords (id uuid primary key);',
    '2_drop.sql': 'drop table if exists public.accords;',
    '3_restore.sql': 'create table if not exists public.accords (id uuid primary key);',
  });
  assert.ok(tables.has('accords'), 'a table re-created by a later migration is live, so it must be checked');

  const { tables: gone } = declare({
    '1_create.sql': 'create table public.briefs (id uuid primary key);',
    '2_drop.sql': 'drop table if exists public.briefs;',
  });
  assert.ok(!gone.has('briefs'), 'a table that was dropped and never came back must NOT be expected');

  const { callableFunctions } = declare({
    'a.sql': `
      create or replace function public.storefront_lookup_customer(p_customer_code text)
      returns jsonb language sql as $$ select '{}'::jsonb $$;
    `,
    'b.sql': `
      drop function if exists public.storefront_lookup_customer(text);
      create function public.storefront_lookup_customer(p_customer_code text)
      returns jsonb language sql security definer as $$ select '{}'::jsonb $$;
    `,
  });
  assert.ok(callableFunctions.has('storefront_lookup_customer'),
    'the hardening pattern is drop-then-create in ONE file; reading all drops after all creates loses it');
}

// --- Trap 5: the rollback at the bottom of every file is written as real SQL ---------------------------
// Inside /* ... */, which a --only comment strip walks straight past. It silently removed five columns of
// storefront_products from the check — the English product copy, which production has.
{
  const { columns, tables } = declare({
    'a.sql': `
      alter table public.storefront_products
        add column if not exists description_en text,
        add column if not exists notes_en text;

      /*
      Rollback:
      alter table public.storefront_products
        drop column if exists description_en,
        drop column if exists notes_en;
      drop table if exists public.storefront_products;
      */
    `,
  });
  assert.ok(columns.has('storefront_products.description_en'),
    'a drop inside a /* rollback */ block never ran, so the column is still declared');
  assert.ok(columns.has('storefront_products.notes_en'));
  assert.ok(!tables.has('storefront_products'),
    'and the commented drop must not resurrect a create that is not there either');
}

// --- And the ambiguity it refuses to guess about ------------------------------------------------------
// storefront_release_voucher_usage was created with two signatures; 20260920160000 drops only the
// ambiguous (uuid, text, text) one — the PGRST203 incident, where two functions of the same name meant
// cancelling an order never returned the voucher. Name-only tracking cannot tell a dropped overload from
// a dropped function, so the tool reports the name as unchecked rather than claiming either.
{
  const { callableFunctions, ambiguousFunctions } = declare({
    'a.sql': `
      create or replace function public.storefront_release_voucher_usage(p_order_id uuid, p_code text)
      returns void language sql as $$ select 1 $$;
    `,
    'b.sql': 'drop function if exists public.storefront_release_voucher_usage(uuid, text, text);',
  });
  assert.ok(!callableFunctions.has('storefront_release_voucher_usage'),
    'a name with a drop after it must not be asserted as present');
  assert.ok(ambiguousFunctions.has('storefront_release_voucher_usage'),
    'it must be reported as undecidable instead of silently dropped from the count');
}

// --- The counts the tool prints are the subject, so they must not quietly shrink -----------------------
// Every number here was measured against the real migrations on 2026-10-16 and every one of them is a
// FLOOR: the parser losing things is the failure mode this whole file exists for, and it shows up as a
// smaller count rather than as an error.
import { readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..', '..');
const migrationsDir = join(repoRoot, 'supabase', 'migrations');
const files = readdirSync(migrationsDir).filter((name) => name.endsWith('.sql')).sort()
  .map((name) => [name, readFileSync(join(migrationsDir, name), 'utf8')]);
assert.ok(files.length >= 121, `only ${files.length} migration files found — the path is wrong, not the repo`);

const real = declaredByMigrations(files);
assert.ok(real.tables.size >= 27, `only ${real.tables.size} tables declared, expected at least 27`);
assert.ok(real.views.size >= 1, 'the public product view must be declared');
assert.ok(real.columns.size >= 107, `only ${real.columns.size} columns declared, expected at least 107`);
assert.ok(real.callableFunctions.size >= 28, `only ${real.callableFunctions.size} callable functions declared, expected at least 28`);
assert.ok(real.policies >= 195, `only ${real.policies} policy statements counted — the tool reports this as what it CANNOT check`);
// The brief_* tables really were dropped for good, so a parser that stopped honouring drops would show up
// here as well as in the counts above.
assert.ok(!real.tables.has('briefs'), 'briefs was dropped in August and is 404 in production');

console.log(`migrationParserReadsSqlInOrder selfcheck OK (${real.tables.size} tables, ${real.columns.size} columns, `
  + `${real.callableFunctions.size} callable functions declared by ${files.length} migrations; five parser traps pinned)`);
