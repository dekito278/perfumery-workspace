// `node src/utils/voucherPaths.selfcheck.mjs` — pins where voucher quota is recorded and looked up.
// Recording happens in api/orders/create.js only (service role); the browser never records, and the
// public never lists the vouchers table. Source-level, like orderWrites.selfcheck.mjs.
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const src = join(here, '..');
const walk = (dir) => readdirSync(dir).flatMap((name) => {
  const full = join(dir, name);
  return statSync(full).isDirectory() ? walk(full) : (/\.(js|jsx)$/.test(name) && !/selfcheck/.test(name) ? [full] : []);
});

for (const file of walk(src)) {
  assert.ok(!readFileSync(file, 'utf8').includes('recordVoucherUsageForOrder'), `${file} still records voucher usage from the browser`);
  if (!file.endsWith('services/voucherService.js')) {
    assert.ok(!readFileSync(file, 'utf8').includes("from('storefront_vouchers')"), `${file} reads the vouchers table directly`);
  }
}

const service = readFileSync(join(src, 'services', 'voucherService.js'), 'utf8');
assert.match(service, /rpc\('storefront_voucher_lookup'/, 'findVoucherByCodeAsync must use the lookup RPC');
assert.ok(!/findVoucherByCodeAsync[\s\S]{0,400}from\(VOUCHER_TABLE\)/.test(service), 'findVoucherByCodeAsync must not select from the table');

const create = readFileSync(join(src, '..', 'api', 'orders', 'create.js'), 'utf8');
assert.match(create, /sbRpc\('storefront_record_voucher_usage'/, 'create.js must record voucher usage');
assert.match(create, /sbRpc\('storefront_release_voucher_usage'/, 'create.js must release the quota when stock reservation fails after it');
assert.ok(create.indexOf("sbRpc('storefront_record_voucher_usage'") < create.indexOf('await deductInventory('), 'record voucher before reserving stock');

// --- Whatever ends an order must give the quota back too ------------------------------------------------
// Reserved stock and reserved voucher quota are the two halves of the same sentence. orderService already
// pairs them on cancel and on a failed/expired payment. deleteOrder paired only the first half — and it is
// the path where the loss cannot be undone: the release RPC is addressed BY ORDER, so once the row is
// hard-deleted there is nothing left to name. A one-time code stayed burned on that buyer's account for
// good, with no screen anywhere able to give it back, while the same function was careful enough to
// return the stock first.
//
// Counted, not listed: any exported function in orderService that gives reserved stock back, or deletes
// the row outright, must also release the voucher quota. A new way to end an order is covered by being
// written, not by being added here.
const orderService = readFileSync(join(src, 'services', 'orderService.js'), 'utf8')
  .replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
const exported = [...orderService.matchAll(/export const (\w+) = /g)];
assert.ok(exported.length >= 10, `only ${exported.length} exports parsed from orderService — the derivation broke`);

const endsAnOrder = [];
const forgetful = [];
for (let index = 0; index < exported.length; index += 1) {
  const from = exported[index].index;
  const to = index + 1 < exported.length ? exported[index + 1].index : orderService.length;
  const body = orderService.slice(from, to);
  if (!/restoreInventoryForOrder\(/.test(body) && !/\.delete\(\)/.test(body)) continue;
  endsAnOrder.push(exported[index][1]);
  if (!/releaseVoucherUsageForOrder\(/.test(body)) forgetful.push(exported[index][1]);
}
assert.ok(endsAnOrder.length >= 3,
  `only ${endsAnOrder.length} order-ending paths found (${endsAnOrder.join(', ')}) — the derivation broke`);
assert.deepEqual(forgetful, [],
  'these paths hand reserved stock back but leave the voucher quota reserved on a buyer who no longer has '
  + `the order it was reserved for:\n  ${forgetful.join('\n  ')}`);

// And in deleteOrder the order has to matter: the release is addressed by order id or number, so doing it
// after the row is gone releases nothing at all.
const deleteBody = orderService.slice(orderService.indexOf('export const deleteOrder'));
assert.ok(
  deleteBody.indexOf('releaseVoucherUsageForOrder(') < deleteBody.indexOf('.delete()'),
  'deleteOrder releases the voucher quota AFTER deleting the row it is addressed by, which releases nothing',
);

console.log('voucherPaths selfcheck OK');
