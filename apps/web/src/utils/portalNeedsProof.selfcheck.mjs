// A customer code alone does not open that customer's orders (2026-11-07).
//
// SOLI + five digits is 100,000 codes, printed on every invoice. storefront_customer_portal answered any
// of them with the whole order list until 20261107100000. This holds the newest definition of that
// function to the rule, and the two pages that call it to asking for the number when the server says so.
import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const src = join(dirname(fileURLToPath(import.meta.url)), '..');
const migrations = join(src, '..', '..', '..', 'supabase', 'migrations');
const stripSql = (sql) => sql.replace(/--.*$/gm, '');
const stripJs = (code) => code.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');

// The newest file that DEFINES the function — the one production runs once every migration is applied.
const defining = readdirSync(migrations).filter((name) => name.endsWith('.sql')).sort()
  .filter((name) => /create or replace function public\.storefront_customer_portal\s*\(/.test(readFileSync(join(migrations, name), 'utf8')));
const newestName = defining.at(-1);
const newest = stripSql(readFileSync(join(migrations, newestName), 'utf8'));

const proof = newest.match(/\(([\s\S]*?)\)\s*as proven/);
assert.ok(proof, `${newestName}: storefront_customer_portal no longer computes a proof — a code alone opens the orders again`);
for (const [door, pattern] of [
  ['a linked login', /auth_user_id\s*=\s*auth\.uid\(\)/],
  ['Studio', /public\.is_admin\(\)/],
  ['the checkout phone, normalised', /normalize_phone\(p_contact\)[\s\S]*=\s*public\.normalize_phone\(c\.contact\)/],
]) assert.match(proof[1], pattern, `${newestName}: the proof lost ${door}`);

const orders = newest.match(/matched_orders as \(([\s\S]*?)\n    \)/);
assert.ok(orders, `${newestName}: matched_orders could not be read`);
assert.match(orders[1], /where[\s\S]*security_answer_hash is null[\s\S]*and c\.proven/,
  `${newestName}: the order list must need both an unprotected code and a proven caller`);

const unproven = newest.match(/else jsonb_build_object\(([\s\S]*?)\)\s*end/);
assert.ok(unproven, `${newestName}: the unproven answer could not be read`);
assert.match(unproven[1], /'requires_identity',\s*true/, 'an unproven caller must be told to prove the code is theirs');
assert.doesNotMatch(unproven[1], /customer_name|order_count|contact/, 'an unproven caller must learn nothing about the customer');
assert.doesNotMatch(newest, /'customer_name',\s*c\.customer_name/, 'every code-only answer masks the name');
assert.doesNotMatch(newest, /storefront_customer_portal\(text\)\s+to/, 'the one-argument function must not be granted back');

// The client: the number goes out only after the server asked (the old function refuses the extra name),
// and both pages that open orders by code ask for it.
const service = stripJs(readFileSync(join(src, 'services', 'customerService.js'), 'utf8'));
assert.match(service, /if \(contact\?\.trim\(\)\) params\.p_contact = contact\.trim\(\);/, 'the contact must be sent only when one was typed');
assert.match(service, /result\.customer\.requires_identity[\s\S]{0,200}requiresIdentity: true/, 'the service must pass requires_identity on');
for (const page of ['CustomerPortalPage.jsx', 'CustomerInvoicePage.jsx']) {
  const source = stripJs(readFileSync(join(src, 'pages', page), 'utf8'));
  assert.match(source, /requiresIdentity \? \(/, `${page} must ask for the number when the server does`);
  assert.match(source, /getCustomerPortalByCode\(portal\.customer\.customerCode, identityContact\)/, `${page} must send the number it asked for`);
  assert.match(source, /result\.requiresIdentity\)\s*\{\s*toast\.error\(t\('cust\.contactMismatch'\)\)/, `${page} must say when the number does not match`);
}

console.log(`portalNeedsProof selfcheck OK (${newestName}: login, Studio or the checkout number; both pages ask)`);
