// `node src/utils/portalOrderShape.selfcheck.mjs`
//
// The buyer's portal reads its orders from storefront_customer_portal, which does NOT return the order
// row. It selects a narrowed column list on purpose — the customer's name and contact are sent once, on
// the customer object, and never repeated per order — so normalizePortalOrder is a promise about a shape
// somebody else decides.
//
// Both directions of that promise had already broken, quietly, in the way this class always breaks:
//
//   - the mapper produced `paymentResponse`, and no portal function has ever selected doku_response or
//     payment_response. It was {} on every order, so the portal's manual-transfer block read the bank
//     details through three `order.paymentResponse?.…` terms that could never resolve.
//   - the portal page read `order.customerName` and `order.contact` as the fallback when the customer
//     record holds only the placeholders, which is exactly when the fallback was needed. Both were
//     undefined every time.
//
// Neither showed: the bank details fell through to the right constant, and the prefill just came up
// empty. That is what makes this worth a gate rather than a reading.
process.env.TZ = 'Asia/Jakarta';

import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const webRoot = join(root, '..');
const repoRoot = join(webRoot, '..', '..');
const stripComments = (source) => source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');

// --- The columns the newest definition of the portal function actually selects -------------------------
// Read from the migration, never listed here: the shape is the database's to decide, and this guard's job
// is only to keep the JavaScript honest about it.
const migrationsDir = join(repoRoot, 'supabase', 'migrations');
const defining = readdirSync(migrationsDir)
  .filter((name) => name.endsWith('.sql'))
  .filter((name) => /create or replace function public\.storefront_customer_portal\s*\(/
    .test(readFileSync(join(migrationsDir, name), 'utf8')))
  .sort();
assert.ok(defining.length, 'no migration defines storefront_customer_portal — the derivation broke');

const newest = readFileSync(join(migrationsDir, defining[defining.length - 1]), 'utf8');
const ordersCte = newest.match(/matched_orders as \(([\s\S]*?)from public\.storefront_orders/);
assert.ok(ordersCte, `${defining[defining.length - 1]} no longer shapes matched_orders — the derivation broke`);
const columns = new Set([...ordersCte[1].matchAll(/\bo\.([a-z_]+)\b/g)].map((match) => match[1]));
assert.ok(columns.size >= 20, `only ${columns.size} portal columns parsed — the derivation broke`);

// --- 1. The mapper may not promise a field the server never sends --------------------------------------
const service = stripComments(readFileSync(join(root, 'services', 'customerService.js'), 'utf8'));
const mapper = service.match(/const normalizePortalOrder = \(order = \{\}\) => \(\{([\s\S]*?)\n\}\);/);
assert.ok(mapper, 'normalizePortalOrder could not be found — the derivation broke');

const produced = [];
const unsourced = [];
for (const line of mapper[1].split('\n')) {
  const named = line.match(/^  ([A-Za-z_$][\w$]*):/);
  if (!named) continue;
  produced.push(named[1]);
}
// A field's value may read several spellings; at least ONE of them has to be a column that arrives.
const entries = mapper[1].split(/\n  (?=[A-Za-z_$][\w$]*:)/);
for (const entry of entries) {
  const named = entry.match(/^\s*([A-Za-z_$][\w$]*):/);
  if (!named) continue;
  const reads = [...entry.matchAll(/order\.([A-Za-z_$][\w$]*)/g)].map((match) => match[1]);
  if (!reads.some((read) => columns.has(read))) unsourced.push(`${named[1]} (reads ${reads.join(', ') || 'nothing'})`);
}
assert.ok(produced.length >= 25, `only ${produced.length} mapped fields parsed — the derivation broke`);
assert.deepEqual(unsourced, [],
  `storefront_customer_portal selects ${columns.size} columns and none of them feeds these, so they are `
  + `empty on every order the buyer sees:\n  ${unsourced.join('\n  ')}`);

// --- 2. And the portal page may not read a field the mapper does not produce ---------------------------
// Same rule as orderWrites' currentOrder check, one layer out. Reading a field that never arrives is
// silently undefined, which in a fallback means the fallback never happens.
const producedSet = new Set(produced);
const page = stripComments(readFileSync(join(root, 'pages', 'CustomerPortalPage.jsx'), 'utf8'));
const ghosts = [...new Set([...page.matchAll(/\border\??\.([A-Za-z_$][\w$]*)/g)].map((match) => match[1]))]
  .filter((field) => !producedSet.has(field));
assert.deepEqual(ghosts, [],
  'the portal reads these off an order, and normalizePortalOrder does not produce them — they are '
  + `undefined every time:\n  ${ghosts.join('\n  ')}`);

console.log(`portalOrderShape selfcheck OK (${produced.length} fields, every one fed by one of the ${columns.size} columns the portal function selects)`);
