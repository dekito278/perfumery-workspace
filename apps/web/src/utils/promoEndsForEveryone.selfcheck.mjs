// `node src/utils/promoEndsForEveryone.selfcheck.mjs`
//
// Switching the shipping promo off has to reach the buyers, not just the admin.
//
// resetShippingPromotionSettings deletes the row and clears only the ADMIN's own localStorage. Every
// buyer who ever loaded a quote during the promo has their own copy — shippingService hydrates it on
// purpose, because reading the empty cache meant "configured promos never applied for anyone but the
// admin".
//
// So the question is what the hydrate does when the row is GONE. It returned that browser's cache, which
// kept a finished promo alive on every device that had seen it: the buyer went on being QUOTED a
// discount while api/orders/create.js, which prices from the row, charged the full fare. Shown one
// courier fee and charged another.
//
// Measured on the live shop the day this was written: the promo table holds ZERO rows, so every device
// still carrying a cached promo is in exactly that state.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import {
  defaultShippingPromotionSettings,
  normalizeShippingPromotionSettings,
} from './shippingPromotion.js';

const here = dirname(fileURLToPath(import.meta.url));
const service = readFileSync(join(here, '..', 'services', 'shippingPromotionService.js'), 'utf8')
  .replace(/\/\*[\s\S]*?\*\//g, ' ')
  .replace(/^\s*\/\/.*$/gm, ' ');

// The hydrate and the three pieces it stands on, LIFTED and RUN: what matters is which settings come
// back, and no amount of reading the source says that.
const lift = (pattern, what) => {
  const found = service.match(pattern);
  assert.ok(found, `could not lift ${what} out of shippingPromotionService — update this guard, not the service`);
  return found[0];
};
const build = (supabase, store) => new Function(
  'supabase', 'window', 'normalizeShippingPromotionSettings', 'defaultShippingPromotionSettings', 'CustomEvent',
  [
    lift(/const SHIPPING_PROMOTION_TABLE = [^\n]*/, 'the table name'),
    lift(/const SHIPPING_PROMOTION_ROW_ID = [^\n]*/, 'the row id'),
    "const SHIPPING_PROMOTION_STORAGE_KEY = 'solivagant.shipping-promotion.v1';",
    'let shippingPromotionCache = null;',
    lift(/export const getShippingPromotionSettings = \(\) => \{[\s\S]*?\n\};/, 'the sync read').replace('export ', ''),
    lift(/const cacheSettings = [\s\S]*?\n\};/, 'cacheSettings'),
    lift(/const fromDatabaseRow = [\s\S]*?\n\}\);/, 'fromDatabaseRow'),
    lift(/export const getShippingPromotionSettingsAsync = [\s\S]*?\n\};/, 'the hydrate').replace('export ', ''),
    'return getShippingPromotionSettingsAsync;',
  ].join('\n'),
)(supabase, { localStorage: store, dispatchEvent: () => {} }, normalizeShippingPromotionSettings, defaultShippingPromotionSettings, function CustomEvent() {});

const fakeStore = (initial) => {
  const map = new Map(Object.entries(initial || {}));
  return {
    getItem: (k) => (map.has(k) ? map.get(k) : null),
    setItem: (k, v) => map.set(k, v),
    removeItem: (k) => map.delete(k),
    _raw: () => map,
  };
};
const fakeSupabase = (answer) => ({
  from: () => ({ select: () => ({ eq: () => ({ maybeSingle: async () => answer }) }) }),
});

const KEY = 'solivagant.shipping-promotion.v1';
const livePromo = JSON.stringify({ enabled: true, preset: 'free_java_discount_other', javaAmount: 0, otherAmount: 10000, minimumSubtotal: 0 });

// 1. A row exists: that row wins.
{
  const store = fakeStore({});
  const settings = await build(fakeSupabase({ data: { id: 'default', enabled: true, preset: 'free_java_discount_other', java_amount: 0, other_amount: 5000, minimum_subtotal: 0 }, error: null }), store)();
  assert.equal(settings.enabled, true, 'a live promo row must reach the buyer');
  assert.equal(settings.otherAmount, 5000);
}

// 2. The row is GONE and this browser still remembers one. The shop knows there is no promo.
{
  const store = fakeStore({ [KEY]: livePromo });
  const settings = await build(fakeSupabase({ data: null, error: null }), store)();
  assert.equal(settings.enabled, false,
    'the server answered and has no promo row, so the buyer must not go on being quoted one — this is '
    + 'the state the live shop is in right now');
  assert.equal(JSON.parse(store.getItem(KEY)).enabled, false,
    'and the stale copy must be overwritten, or the next synchronous reader serves it straight back');
}

// 3. The lookup FAILED. Not knowing is not the same as knowing there is nothing — the cache stands.
{
  const store = fakeStore({ [KEY]: livePromo });
  const settings = await build(fakeSupabase({ data: null, error: { message: 'Failed to fetch' } }), store)();
  assert.equal(settings.enabled, true,
    'an offline buyer must keep the promo they were last told about, exactly as publicTrackingService '
    + 'keeps a tracked order it could not re-check');
}

// 4. No row and no cache: the default, which is no promo.
{
  const settings = await build(fakeSupabase({ data: null, error: null }), fakeStore({}))();
  assert.equal(settings.enabled, false);
}

// And the default really is "off" — the whole fix rests on it.
assert.equal(defaultShippingPromotionSettings.enabled, false,
  'the default promo is switched ON, so every fallback above now gives shipping away');

console.log('promoEndsForEveryone selfcheck OK (a deleted promo reaches the buyer; an outage does not)');
