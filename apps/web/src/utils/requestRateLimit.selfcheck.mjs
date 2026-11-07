// The shipping endpoints refuse a caller who asks too often, and only that caller.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRateLimit, clientAddress } from './requestRateLimit.js';

const allow = createRateLimit({ limit: 3, windowMs: 1000 });
assert.deepEqual([0, 1, 2, 3].map((t) => allow('a', t)), [true, true, true, false], 'the fourth ask inside the window is refused');
assert.equal(allow('b', 3), true, 'another address is not punished for the first one');
assert.equal(allow('a', 1000), true, 'the window slides: the first ask has expired, one place is free again');
assert.equal(allow('a', 1000), false, '...and only one');

const small = createRateLimit({ limit: 1, windowMs: 1000, maxKeys: 2 });
small('x', 0); small('y', 0); small('z', 0);
assert.equal(small('z', 1), false, 'the map is cleared when full, and the newest caller is still counted');

assert.equal(clientAddress({ headers: { 'x-real-ip': '1.2.3.4', 'x-forwarded-for': '9.9.9.9' } }), '1.2.3.4');
assert.equal(clientAddress({ headers: { 'x-forwarded-for': '5.6.7.8, 10.0.0.1' } }), '5.6.7.8');
assert.equal(clientAddress({ headers: {} }), 'unknown');

// Both jobs of the endpoint ask before they spend: a check bolted onto POST alone leaves the search open.
const endpoint = readFileSync(new URL('../../api/shipping/rates.js', import.meta.url), 'utf8');
const getAt = endpoint.indexOf("request.method === 'GET'");
const firstFetch = endpoint.indexOf('await fetch(');
const postAt = endpoint.indexOf("request.method !== 'POST'");
const secondFetch = endpoint.indexOf('await fetch(', postAt);
const guardAt = (from, to) => endpoint.slice(from, to).search(/if \(!allow\w+\(clientAddress\(request\)\)\)[\s\S]{0,200}?429/);
assert.ok(getAt > -1 && firstFetch > getAt && guardAt(getAt, firstFetch) > -1, 'the destination search must refuse a flood before it calls RajaOngkir');
assert.ok(postAt > -1 && secondFetch > postAt && guardAt(postAt, secondFetch) > -1, 'the rate quote must refuse a flood before it calls RajaOngkir');

console.log('requestRateLimit selfcheck OK (a flood is refused before the paid call, per address, in a sliding window)');
