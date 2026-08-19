// Runnable check for shop-time helpers. `node src/utils/localDay.selfcheck.mjs`.
// Between 00:00 and 07:00 WIB the UTC calendar day is still yesterday — that is the bug this prevents.
import assert from 'node:assert/strict';
import { shopEndOfDay, shopToday } from './localDay.js';

// 02:30 WIB on 20 Aug is 19:30 UTC on 19 Aug — the shop day must be the 20th
assert.equal(shopToday(new Date('2026-08-19T19:30:00Z')), '2026-08-20');
// 23:00 WIB on 19 Aug is 16:00 UTC the same day
assert.equal(shopToday(new Date('2026-08-19T16:00:00Z')), '2026-08-19');
// Right at midnight WIB
assert.equal(shopToday(new Date('2026-08-19T17:00:00Z')), '2026-08-20');

// A date-only expiry means end of that day in Jakarta, the same instant in every runtime
assert.equal(shopEndOfDay('2026-08-19'), '2026-08-19T23:59:59.999+07:00');
assert.equal(new Date(shopEndOfDay('2026-08-19')).toISOString(), '2026-08-19T16:59:59.999Z');
// Still valid a minute before, expired a minute after
assert.ok(new Date('2026-08-19T16:58:00Z').getTime() < new Date(shopEndOfDay('2026-08-19')).getTime());
assert.ok(new Date('2026-08-19T17:01:00Z').getTime() > new Date(shopEndOfDay('2026-08-19')).getTime());

console.log('localDay selfcheck OK');
