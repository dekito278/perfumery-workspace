// `node src/utils/tierPricingSchema.selfcheck.mjs`
//
// The tier pricing migration carries one security property that everything else rests on: a buyer must
// never be able to read a price they are not entitled to. storefront_products_public is readable by
// anyone holding the anon key, and reseller prices are commercially sensitive, so the tier prices live in
// their own table behind RLS and are only ever handed out by a function that resolves the caller's tier
// from the session.
//
// A migration cannot be run from here, so this guards the text of it: the protections must still be in
// the file Dekito applies.
import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const migrations = join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..', '..', 'supabase', 'migrations');
const file = readdirSync(migrations).find((name) => name.includes('customer_tiers_and_tier_prices'));
assert.ok(file, 'the tier pricing migration is missing');
const sql = readFileSync(join(migrations, file), 'utf8');

// The table is not readable without being an admin.
assert.match(sql, /alter table public\.storefront_product_prices enable row level security/,
  'storefront_product_prices must have RLS on, or the anon key reads every reseller price');
assert.match(sql, /for select\s*\n\s*using \(public\.is_admin\(\)\)/,
  'direct selects on the price table must be admin-only');
assert.doesNotMatch(sql, /grant\s+select\s+on\s+public\.storefront_product_prices/i,
  'the price table must never be granted to anon or authenticated — the function is the only way in');

// The function hands back the caller's tier and nothing above it.
assert.match(sql, /pr\.tier in \(public\.storefront_my_price_tier\(\), 'overseas'\)/,
  'storefront_prices_for_me must filter to the caller\'s own tier plus the public overseas price');
assert.match(sql, /when auth\.uid\(\) is null then 'retail'/,
  'a caller with no session is retail');
assert.match(sql, /where c\.auth_user_id = auth\.uid\(\)/,
  'the tier must be looked up from the session, never from an argument the browser controls');
assert.doesNotMatch(sql, /storefront_my_price_tier\s*\(\s*p_/,
  'storefront_my_price_tier must take no arguments — one that did could be told what tier to return');

// Retail is deliberately not storable here: it already exists on the product, and two copies drift.
assert.match(sql, /check \(tier in \('member', 'reseller', 'overseas'\)\)/,
  'the price table must not accept a retail row — retail stays on storefront_products');

// Draft products must not leak through the new function either.
assert.match(sql, /not public\.storefront_product_is_draft\(p\.tags\)/,
  'the price function must hide drafts, the same as the public product view does');

// Both functions are security definer, or RLS would block the very rows they exist to read.
assert.equal((sql.match(/security definer/g) || []).length, 2,
  'both storefront_my_price_tier and storefront_prices_for_me must be security definer');

console.log('tierPricingSchema selfcheck OK (tier prices stay behind RLS; the session decides the tier)');
