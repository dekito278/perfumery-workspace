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

console.log('voucherPaths selfcheck OK');
