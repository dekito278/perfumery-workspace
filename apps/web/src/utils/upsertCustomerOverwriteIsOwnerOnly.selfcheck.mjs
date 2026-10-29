// Overwriting a saved customer profile must require owning it, not just knowing the code.
//
// storefront_upsert_customer matched an existing customer by code (printed on every invoice) and then
// rewrote their name, contact and delivery address to whatever the caller passed. Anon-callable. A
// guesser could redirect a stranger's saved address. The 20261030 migration overwrites the identity
// fields only `when owns` — a linked login or the matching contact — while still linking the order and
// incrementing the count for a real order placed under one's own code. New-customer INSERT is untouched.
//
// Order fulfilment is not affected: the order carries its own address in checkout_draft. This guard
// protects the saved RECORD, which is what was exposed.

import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { noteSkip } from '../../tools/selfcheckSubject.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const MIGRATIONS = path.resolve(HERE, '../../../../supabase/migrations');

if (!fs.existsSync(MIGRATIONS) || !fs.readdirSync(MIGRATIONS).some((f) => f.endsWith('.sql'))) {
  noteSkip('supabase/migrations is outside the build checkout (Vercel takes apps/web only), so this '
    + 'SQL-only guard runs on a developer machine and nowhere else');
} else {
  const file = fs.readdirSync(MIGRATIONS).find((f) => /upsert_customer_overwrite_requires_owner/.test(f));
  assert.ok(file, 'the upsert owner-gate migration is missing');
  const sql = fs.readFileSync(path.join(MIGRATIONS, file), 'utf8');

  // The UPDATE body: every identity field is written only `when owns`, never unconditionally.
  const update = sql.slice(sql.indexOf('update public.storefront_customers\n        set'), sql.indexOf('where storefront_customers.id = target_id;\n    end if;'));
  assert.ok(update, 'could not find the UPDATE body — fix this guard, not the app');
  for (const field of ['customer_name', 'contact', 'delivery_address', 'delivery_area', 'notes']) {
    assert.match(update, new RegExp(`${field} = case when owns`),
      `${field} is overwritten without the owns gate — a code-guesser could rewrite it`);
  }

  // owns is proof of ownership: a linked login OR the matching contact. NEVER the code alone.
  const ownsExpr = sql.slice(sql.indexOf('owns := ('), sql.indexOf(');', sql.indexOf('owns := (')));
  assert.match(ownsExpr, /existing_auth = caller/, 'a linked login must count as ownership');
  assert.match(ownsExpr, /normalize_phone\(existing_contact\)/, 'the matching phone must count as ownership');
  assert.match(ownsExpr, /existing_contact/, 'ownership is checked against the STORED contact, not the supplied one');
  assert.ok(!/customer_code|normalized_code/.test(ownsExpr),
    'ownership must NOT be satisfied by the code — the code is printed on every invoice, it is not proof');

  // Placing a real order under your own code still counts and links — only the identity overwrite is gated.
  assert.match(update, /order_count = order_count \+ case when p_increment_order then 1 else 0 end/,
    'the order count must still increment — a real paid order is not the thing being blocked');

  // New customers are unaffected: the INSERT still sets their own details.
  const insert = sql.slice(sql.indexOf('insert into public.storefront_customers'), sql.indexOf('returning storefront_customers.id into target_id;'));
  assert.match(insert, /trim\(p_customer_name\), trim\(p_contact\)/,
    'a brand-new customer must still set their own name and contact');
  assert.ok(!/case when owns/.test(insert), 'the owns gate belongs on UPDATE only — a new row has no prior owner');
}
