// Runnable check for the Java/non-Java split that decides free shipping.
// `node src/utils/shippingPromotion.selfcheck.mjs`
//
// The bug this pins down: the keyword fallback used a plain substring match, so "Solok, Sumatera Barat"
// contained "solo" and shipped free under a Pulau-Jawa promo (audit round 9).
import assert from 'node:assert/strict';
import {
  SHIPPING_PROMOTION_PRESETS,
  applyShippingPromotionToRates,
  getShippingDestinationArea,
} from './shippingPromotion.js';

const area = (destination) => getShippingDestinationArea(destination, {}).area;

// --- province wins, always ------------------------------------------------------------------------
assert.equal(area({ provinceName: 'Jawa Timur', cityName: 'Kediri' }), 'java');
assert.equal(area({ provinceName: 'DKI Jakarta' }), 'java');
assert.equal(area({ provinceName: 'D.I. Yogyakarta' }), 'java');
assert.equal(area({ provinceName: 'Nusa Tenggara Barat', cityName: 'Kediri' }), 'other');
assert.equal(area({ provinceName: 'Sumatera Barat', cityName: 'Solok' }), 'other');

// --- keyword fallback, when the destination arrives without province data -------------------------
assert.equal(area({ label: 'Solok, Kota Solok' }), 'other', 'Solok must not read as Solo');
assert.equal(area({ label: 'Solo, Surakarta' }), 'java');
assert.equal(area({ label: 'Kediri, Lombok Barat' }), 'other', 'Kediri NTB must not read as Java');
assert.equal(area({ label: 'Bekasi Selatan' }), 'java');
assert.equal(area({ label: 'Denpasar, Bali' }), 'other');
assert.equal(area({ label: 'Bogor Tengah, Kota Bogor' }), 'java');

// --- the money consequence ------------------------------------------------------------------------
const promo = {
  enabled: true,
  preset: SHIPPING_PROMOTION_PRESETS.FREE_JAVA_DISCOUNT_OTHER,
  javaAmount: 10000,
  otherAmount: 10000,
  minimumSubtotal: 0,
};
const rate = { courierCode: 'jne', service: 'REG', cost: 45000 };

const [toSolok] = applyShippingPromotionToRates([rate], { label: 'Solok, Kota Solok' }, promo, { subtotal: 500000 });
assert.equal(toSolok.cost, 35000, 'Solok gets the non-Java discount, not free shipping');

const [toSolo] = applyShippingPromotionToRates([rate], { label: 'Solo, Surakarta' }, promo, { subtotal: 500000 });
assert.equal(toSolo.cost, 0, 'Solo is Java and ships free');

// Promo off / below minimum leaves the courier price alone.
const [untouched] = applyShippingPromotionToRates([rate], { provinceName: 'DKI Jakarta' }, { ...promo, minimumSubtotal: 1000000 }, { subtotal: 500000 });
assert.equal(untouched.cost, 45000);

console.log('shippingPromotion selfcheck OK');
