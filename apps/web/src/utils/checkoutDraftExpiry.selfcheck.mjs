// `node src/utils/checkoutDraftExpiry.selfcheck.mjs`
//
// Measured in a browser before this existed: typing a name, phone and address into the checkout form
// wrote all three to localStorage under dekito.storefront.checkoutDraft.v1. A completed order clears it;
// an abandoned one left the address on that device with no expiry, so the next person to open checkout
// on a shared phone or a shop computer found it filled in.
//
// Runs the real module against a stand-in localStorage.
import assert from 'node:assert/strict';

const store = new Map();
globalThis.window = {
  localStorage: {
    getItem: (k) => (store.has(k) ? store.get(k) : null),
    setItem: (k, v) => store.set(k, String(v)),
    removeItem: (k) => store.delete(k),
  },
};

const {
  CHECKOUT_DRAFT_MAX_AGE_MS,
  CHECKOUT_DRAFT_STORAGE_KEY,
  clearCheckoutDraft,
  readCheckoutDraft,
  writeCheckoutDraft,
} = await import('./checkoutDraftStorage.js');

const ADDRESS = 'Jl. Melati No. 12, Bandung 40123';
const draftAt = (iso) => ({ customerName: 'Budi', contact: '081234567890', deliveryAddress: ADDRESS, updatedAt: iso });
const now = Date.parse('2026-09-11T10:00:00.000Z');
const minutesAgo = (m) => new Date(now - m * 60 * 1000).toISOString();

// Fresh: an interrupted checkout must come back intact.
writeCheckoutDraft(draftAt(minutesAgo(30)));
assert.equal(readCheckoutDraft(now).deliveryAddress, ADDRESS, 'a draft from half an hour ago is still the buyer resuming');

// Just inside the window.
writeCheckoutDraft(draftAt(new Date(now - CHECKOUT_DRAFT_MAX_AGE_MS + 60 * 1000).toISOString()));
assert.equal(readCheckoutDraft(now).deliveryAddress, ADDRESS, 'a draft one minute short of the cutoff is kept');

// Past the window: gone from the form AND gone from the device.
writeCheckoutDraft(draftAt(new Date(now - CHECKOUT_DRAFT_MAX_AGE_MS - 60 * 1000).toISOString()));
assert.deepEqual(readCheckoutDraft(now), {}, 'a stale draft must not prefill the form');
assert.equal(store.get(CHECKOUT_DRAFT_STORAGE_KEY), undefined,
  'reading a stale draft must also delete it — leaving the address on the device is the whole problem');

// A draft written before this change has no timestamp and cannot be aged.
store.set(CHECKOUT_DRAFT_STORAGE_KEY, JSON.stringify({ customerName: 'Budi', deliveryAddress: ADDRESS }));
assert.deepEqual(readCheckoutDraft(now), {}, 'an untimestamped draft must be dropped, not kept forever');
assert.equal(store.get(CHECKOUT_DRAFT_STORAGE_KEY), undefined, 'and deleted with it');

// Nothing readable is left behind after a completed order.
writeCheckoutDraft(draftAt(minutesAgo(1)));
clearCheckoutDraft();
assert.equal(store.get(CHECKOUT_DRAFT_STORAGE_KEY), undefined, 'a finished checkout leaves nothing behind');

// Garbage must not throw on the way into the form.
store.set(CHECKOUT_DRAFT_STORAGE_KEY, '{not json');
assert.deepEqual(readCheckoutDraft(now), {}, 'a corrupt draft is ignored, not fatal');
store.set(CHECKOUT_DRAFT_STORAGE_KEY, '["array"]');
assert.deepEqual(readCheckoutDraft(now), {}, 'a draft that is not an object is ignored');

console.log(`checkoutDraftExpiry selfcheck OK (an abandoned address survives ${CHECKOUT_DRAFT_MAX_AGE_MS / 3600000}h, then it is gone)`);
