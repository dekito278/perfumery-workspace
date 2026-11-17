// `node src/utils/customerSearch.selfcheck.mjs`
//
// The Studio's customer list had no search on laptop or phone (Studio audit, 15 Nov 2026). Since 17 Nov 2026
// both screens filter by name, WhatsApp number (however it was typed) or old SOLI code.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { searchCustomers } from './customerSearch.js';

const people = [
  { customerName: 'Budi Santoso', contact: '0812-3456-7890', customerCode: 'SOLI01234' },
  { customerName: 'Ayu', contact: '+62 857 1111 2222', customerCode: 'SOLI09999' },
];
const names = (query) => searchCustomers(people, query).map((person) => person.customerName);
assert.deepEqual(names(''), ['Budi Santoso', 'Ayu'], 'an empty search shows everyone');
assert.deepEqual(names('budi'), ['Budi Santoso']);
assert.deepEqual(names('6281234'), ['Budi Santoso'], '62… finds a number saved as 08…');
assert.deepEqual(names('0857 1111'), ['Ayu'], '08… finds a number saved as +62…');
assert.deepEqual(names('soli0999'), ['Ayu'], 'the code matches in any case');
assert.deepEqual(names('zzz'), []);
assert.deepEqual(searchCustomers(null, 'x'), []);

const src = join(dirname(fileURLToPath(import.meta.url)), '..');
for (const page of ['pages/CustomersPage.jsx', 'pages/mobile/MobileCustomersPage.jsx']) {
  const text = readFileSync(join(src, page), 'utf8');
  assert.match(text, /type="search"/, `${page} has a search field`);
  assert.match(text, /searchCustomers\(customers, query\)/, `${page} filters with the shared search`);
  assert.match(text, /Tidak ada pelanggan yang cocok/, `${page} says when nothing matches`);
  assert.match(text, /copyTextToClipboard\(customer\.customerCode\)/, `${page} copies with the guarded clipboard`);
}
console.log('customerSearch selfcheck OK (name, number in any form, code; laptop and phone)');
