// A guessed customer code must not unlock a stranger's PII or let someone seize their account.
//
// Codes are SOLI + five digits — a 100,000 keyspace with a fixed prefix, printed on every invoice. Two
// anon RPCs treated knowing one as proof of ownership:
//
//   checkout_lookup  returned real name + contact + delivery address whenever security_answer_hash was
//                    null (all 44 customers). No grant statement, so PUBLIC by default.
//   set_security     let an anon caller set the security answer on any still-unprotected account, the
//                    first-time branch checking nothing but the code.
//
// The 20261026 migration fences both: PII and first-time protection now require a correct answer, or a
// login linked to the account, or (for set_security) the matching contact — which, once checkout_lookup
// stops disclosing it, no anon RPC hands out. This guard holds that shape so a later edit cannot quietly
// reopen either hole, and checks the client degrades instead of dead-ending.

import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { noteSkip } from '../../tools/selfcheckSubject.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const read = (rel) => fs.readFileSync(path.resolve(HERE, rel), 'utf8');

// --- The client: an unprotected, unproven code must not pre-fill PII, and must not dead-end ----------
const service = read('../services/customerService.js');
assert.match(service, /requiresIdentity: Boolean\(customer\.requires_identity/,
  'customerService must surface requires_identity, or the checkout cannot tell "recognised" from "proved"');
assert.match(service, /storefront_customer_set_security',\s*\{[^}]*p_contact:/,
  'set_security must send the contact IN ITS OWN call, or first-time protection has no ownership proof to check');

const checkout = read('../hooks/useCheckoutFlow.js');
const idBranch = checkout.slice(checkout.indexOf('if (customer.requiresIdentity)'), checkout.indexOf('applyCheckoutCustomer(customer);', checkout.indexOf('if (customer.requiresIdentity)')));
assert.ok(idBranch.includes('if (customer.requiresIdentity)'), 'the checkout must handle requires_identity');
assert.ok(idBranch.includes('return;'), 'the requires_identity branch must return before pre-filling anything');
// It must NOT pre-fill the saved address/contact in this branch — that is the leak it exists to avoid.
assert.ok(!/setDeliveryAddress\(customer\.|setContact\(customer\.|applyCheckoutCustomer/.test(idBranch),
  'requires_identity must NOT pre-fill saved contact/address — that is exactly the PII the fix stopped disclosing');

// --- The migration: fail-safe structure, so a regression cannot silently reopen it -------------------
const MIGRATIONS = path.resolve(HERE, '../../../../supabase/migrations');
if (!fs.existsSync(MIGRATIONS) || !fs.readdirSync(MIGRATIONS).some((f) => f.endsWith('.sql'))) {
  noteSkip('supabase/migrations is outside the build checkout (Vercel takes apps/web only), so the SQL '
    + 'half of this chain runs on a developer machine and nowhere else');
} else {
  const file = fs.readdirSync(MIGRATIONS).find((f) => /checkout_lookup_and_set_security_owner_only/.test(f));
  assert.ok(file, 'the owner-only hardening migration is missing — the client now sends p_contact to a function that would not expect it');
  const sql = fs.readFileSync(path.join(MIGRATIONS, file), 'utf8');

  // checkout_lookup: the `authorized` test must require proof and must NOT grant on "hash is null".
  const authorized = sql.slice(sql.indexOf('as authorized') - 600, sql.indexOf('as authorized'));
  assert.match(authorized, /auth\.uid\(\)/, 'authorization must accept a linked login');
  assert.match(authorized, /crypt\(/, 'authorization must accept a correct security answer');
  assert.ok(!/security_answer_hash\s+is\s+null/.test(authorized),
    'the "hash is null" escape is back in the authorized test — that is the exact disclosure this closed');
  assert.match(authorized, /security_answer_hash\s+is\s+not\s+null\s+and/,
    'an answer only authorizes when it EXISTS and matches, never when it is absent');

  // The unproven case returns requires_identity and NO personal columns.
  const idFlagAt = sql.indexOf("'requires_identity', true");
  const idStart = sql.lastIndexOf('else jsonb_build_object(', idFlagAt);
  const identityBranch = sql.slice(idStart, sql.indexOf(')', idFlagAt) + 1);
  assert.ok(idStart > 0 && !/'contact'|'delivery_address'|'delivery_area'/.test(identityBranch),
    'the requires_identity branch leaks a personal column — it must carry only the code and name');

  // checkout_lookup is explicitly re-granted (not left on the PUBLIC default that caused this).
  assert.match(sql, /revoke execute on function public\.storefront_customer_checkout_lookup\(text, text\) from public;/,
    'checkout_lookup must be revoked from PUBLIC — the missing grant is how it was reachable in the first place');

  // set_security: the OLD unfenced 4-arg signature is dropped, and the first-time branch demands proof.
  assert.match(sql, /drop function if exists public\.storefront_customer_set_security\(text, text, text, text\);/,
    'the old 4-arg set_security must be dropped, or its unfenced first-time path stays callable');
  const firstTime = sql.slice(sql.indexOf('if target_customer.security_answer_hash is null then'), sql.indexOf('elsif target_customer.security_answer_hash'));
  assert.ok(firstTime, 'set_security must still special-case the first-time set');
  assert.match(firstTime, /if not \(\s*\n\s*\(target_customer\.auth_user_id is not null and target_customer\.auth_user_id = auth\.uid\(\)\)/,
    'first-time set must open with `if not ( <linked login> ...` — a disabled or widened condition is not a fence');
  assert.match(firstTime, /normalize_phone/, 'first-time set must accept the matching contact as proof');
  assert.match(firstTime, /\)\s*then\s*\n\s*raise exception/, 'the unmet fence must raise, not fall through');
}
