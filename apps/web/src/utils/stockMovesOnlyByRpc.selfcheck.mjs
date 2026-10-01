// `node src/utils/stockMovesOnlyByRpc.selfcheck.mjs`
//
// Stock moves one way: through the RPC, atomically, or not at all.
//
// deductInventoryForOrder already said so, with the reason beside it — "the old path re-read and re-saved
// product rows from the browser; UPDATE on storefront_products is admin-only, so for everyone else it did
// nothing and reported success (audit round 9, P-4). The RPC is the only way stock moves."
//
// restoreInventoryForOrder, eight lines below in the same file, still had that client fallback. And the
// restore version was the worse of the two: it re-read every editable product, restored the units in
// memory, and saved the changed ones with Promise.all — which rejects on the FIRST failure. A half-finished
// restore left some products holding their units back and the rest already returned, and then THREW, so the
// caller never reached markOrderInventoryRestored. The order kept inventory_deducted = true with its stock
// partly handed back, and the next cancel, expiry or delete restored the same units again.
//
// markOrderInventoryRestored's own comment states the rule the fallback broke: "a flag left true lets a
// second cancel restore the same units again."
//
// Measured 2026-10-02: storefront_restore_inventory_for_order is one of 31 RPCs registered in production,
// enumerated read-only from PostgREST's OpenAPI document. The condition the fallback was written for does
// not hold, and every way the RPC can fail breaks the fallback too — same connection, same admin rights,
// same table.
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const src = dirname(fileURLToPath(import.meta.url)).replace(/\/utils$/, '');
const strip = (text) => text
  .replace(/\/\*[\s\S]*?\*\//g, ' ')
  .replace(/^\s*\/\/.*$/gm, ' ');

// --- 1. Both movements, derived from the RPCs they call ------------------------------------------------
//
// The pair is found by looking for the stock RPCs, not by naming the two functions: a third movement would
// have to be caught by this.
const catalog = strip(readFileSync(join(src, 'services', 'productCatalogService.js'), 'utf8'));
const slice = (name) => {
  const at = catalog.indexOf(`export const ${name} = async`);
  if (at === -1) return '';
  const end = catalog.indexOf('\n};', at);
  return catalog.slice(at, end === -1 ? catalog.length : end);
};

const movements = [...catalog.matchAll(/supabase\.rpc\('(storefront_(?:deduct|restore)_inventory_for_order)'/g)]
  .map((match) => match[1]);
assert.equal(movements.length, 2,
  `expected exactly the deduct and restore RPCs in productCatalogService; found ${movements.length}: ${movements.join(', ')}`);
console.log(`  stock movements: ${movements.join(', ')}`);

for (const name of ['deductInventoryForOrder', 'restoreInventoryForOrder']) {
  const body = slice(name);
  assert.ok(body.length > 200, `${name} is gone or renamed — update this chain, not the rule`);
  const rescue = body.slice(body.indexOf('} catch ('));
  assert.ok(rescue.length > 40, `${name} must still handle an RPC failure`);

  // The catch may do exactly one thing: throw. Writing product rows from the browser is the fallback that
  // did nothing for a non-admin and half the job for an admin.
  assert.match(rescue, /throw new Error\(/,
    `${name} must surface an RPC failure. Anything else lets the caller believe stock moved when it did not`);
  for (const forbidden of ['saveCustomProduct', 'getEditableProducts', 'Promise.all']) {
    assert.ok(!rescue.includes(forbidden),
      `${name} falls back to ${forbidden} when the RPC fails. Stock moves through the RPC or not at all — a `
      + 'client fallback cannot be atomic, and a half-finished movement that throws leaves the order '
      + 'claiming to hold units it has already returned');
  }
}

// --- 1b. And nothing ELSE fans a product save out over a list ------------------------------------------
//
// The two checks above are about the two known movements. A sabotage added a THIRD exported function that
// wrote every editable product in a loop and called no RPC at all — invisible to a rule that counts RPCs.
// What makes the fallback wrong is the shape, not which function it sits in: a bulk product write from the
// browser is never atomic, and UPDATE on storefront_products is admin-only, so for anyone else it writes
// nothing and says nothing.
const bulkSaves = [...catalog.matchAll(/(?:Promise\.all|Promise\.allSettled|settleBulk)\(\s*[\w.$]*\s*\.map\(\s*\(?\w*\)?\s*=>\s*saveCustomProduct/g)];
assert.deepEqual(bulkSaves.map((match) => match[0].replace(/\s+/g, ' ')), [],
  'productCatalogService writes product rows in bulk from the browser again. Stock moves through the RPC '
  + 'alone — a loop of saves cannot be atomic, and a half-finished one leaves the order claiming units it '
  + 'has already returned');

// --- 2. Nothing else in the browser writes a stock number ---------------------------------------------
//
// Swept: a new screen that "just fixes the count" would be the same defect with a different name. The two
// helpers the fallback used are gone, so their names must not come back either.
const files = [];
const walk = (dir) => {
  for (const entry of readdirSync(join(src, dir), { withFileTypes: true })) {
    const rel = dir ? `${dir}/${entry.name}` : entry.name;
    if (entry.isDirectory()) { walk(rel); continue; }
    if (/\.jsx?$/.test(entry.name) && !/selfcheck/.test(entry.name)) files.push(rel);
  }
};
walk('');
const resurrected = files.filter((rel) => /restoreProductItemStock|createInventoryRestoreEvent/
  .test(strip(readFileSync(join(src, rel), 'utf8'))));
assert.deepEqual(resurrected, [],
  'the client-side stock restore helpers are back. They existed only to serve the fallback this chain '
  + 'removed:\n  ' + resurrected.join('\n  '));

// --- 3. And the caller still pairs a restore with lowering the flag -------------------------------------
// Without that pairing the RPC being atomic buys nothing: a second cancel restores the same units again.
// Counted per caller, because this file has three.
const orders = strip(readFileSync(join(src, 'services', 'orderService.js'), 'utf8'));
const restores = [...orders.matchAll(/await restoreInventoryForOrder\(/g)];
assert.ok(restores.length >= 3,
  `expected the cancel, payment-expiry and delete paths to restore stock; found ${restores.length}`);
const unpaired = [];
for (const match of restores) {
  const after = orders.slice(match.index, match.index + 400);
  if (!/markOrderInventoryRestored\(/.test(after)) unpaired.push(after.slice(0, 80).replace(/\s+/g, ' '));
}
assert.deepEqual(unpaired, [],
  'these hand stock back without lowering inventory_deducted, so the next cancel hands the same units '
  + 'back again:\n  ' + unpaired.join('\n  '));
console.log(`  ${restores.length} restore paths, each paired with markOrderInventoryRestored`);

console.log('stockMovesOnlyByRpc selfcheck OK (both movements go through the RPC alone)');
