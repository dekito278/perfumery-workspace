// Discovery sets (Dekito, 18 Nov 2026 — "Set vial Solivagant": Set I Floral, II Hangat & Manis, III Jalan
// Pulang, IV Limited, and the 19-vial Set Lengkap; 2 ml spray vials in a box and pouch, with a Rp50.000
// card — Rp100.000 in Set Lengkap — off a full bottle on the website).
//
// They are ordinary products in the catalogue, told apart by their CATEGORY, which every cart and order
// line already carries (a tag would not: the cart copies category, not tags). Three rules follow:
//   1. Abroad (Dekito, 18 Nov 2026: US$35 for Set I–III, US$45 Set IV, US$115 Set Lengkap) a set rides
//      WITH a bottle. A set alone would go in DHL's smallest bracket, which to Europe costs more than the
//      set; beside a bottle it fits the same 1 kg box. So: one set per bottle adds no parcel weight, a set
//      beyond that counts as a bottle, and an English order with sets and no bottle cannot be sent.
//   2. A set is not a bottle: it earns no free vial (one per BOTTLE, up to three).
//   3. Their price is exactly the one Dekito set — no automatic member or export price is written for them;
//      the export price is his number, stored by hand.
//
// Import-free: the browser, the order endpoint, the build and the guards all read it.

export const DISCOVERY_SET_CATEGORY = 'Discovery Set';

const norm = (value) => String(value ?? '').trim().toLowerCase();

/** A catalogue product, or a cart/order line, that is a discovery set. */
export const isDiscoverySet = (productOrLine = {}) => (
  norm(productOrLine?.category ?? productOrLine?.product?.category) === norm(DISCOVERY_SET_CATEGORY)
);

/** How many bottles a parcel holding `bottles` bottles and `sets` sets ships as (rule 1). */
export const parcelBottlesFor = (bottles = 0, sets = 0) => {
  const b = Math.max(0, Math.round(Number(bottles) || 0));
  const s = Math.max(0, Math.round(Number(sets) || 0));
  return b + Math.max(0, s - b);
};
