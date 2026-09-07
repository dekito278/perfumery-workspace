// `node src/utils/clientContext.selfcheck.mjs`
// The client hint is attacker-controlled — anyone can POST to /api/orders/create with any body — so the
// only thing standing between that and a row in the orders table is this whitelist. Pin its shape.
import assert from 'node:assert/strict';
import { sanitizeClientContext, getClientContext } from './clientContext.js';

assert.deepEqual(sanitizeClientContext({ surface: 'mobile', viewportWidth: 393 }), { surface: 'mobile', viewport_width: 393 });
assert.deepEqual(sanitizeClientContext({ surface: 'desktop', viewportWidth: 1440 }), { surface: 'desktop', viewport_width: 1440 });
assert.deepEqual(sanitizeClientContext({ viewportWidth: '1280' }), { viewport_width: 1280 }, 'numeric strings are fine');

// Anything the caller invents is dropped, not stored.
assert.deepEqual(sanitizeClientContext({ surface: '<script>alert(1)</script>' }), {});
assert.deepEqual(sanitizeClientContext({ surface: 'MOBILE' }), {}, 'exact match only');
assert.deepEqual(sanitizeClientContext({ surface: 'mobile', evil: 'DROP TABLE', userAgent: 'x' }), { surface: 'mobile' },
  'extra keys never survive — the column must stay narrow');
assert.deepEqual(sanitizeClientContext({ viewportWidth: -5 }), {});
assert.deepEqual(sanitizeClientContext({ viewportWidth: 999999 }), {}, 'absurd widths are refused');
assert.deepEqual(sanitizeClientContext({ viewportWidth: NaN }), {});
assert.deepEqual(sanitizeClientContext({}), {});
assert.deepEqual(sanitizeClientContext(), {});
assert.deepEqual(sanitizeClientContext(null), {});

// Collecting outside a browser must not throw — the module is imported by the serverless endpoint.
assert.deepEqual(getClientContext(), {}, 'no window, no context, no crash');

console.log('clientContext selfcheck OK');
