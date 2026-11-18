// Discovery sets (Dekito, 18 Nov 2026 — "Set vial Solivagant": Set I Floral, II Hangat & Manis, III Jalan
// Pulang, IV Limited, and the 19-vial Set Lengkap; 2 ml spray vials in a box and pouch, with a Rp50.000
// card — Rp100.000 in Set Lengkap — off a full bottle on the website).
//
// They are ordinary products in the catalogue, told apart by their CATEGORY, which every cart and order
// line already carries (a tag would not: the cart copies category, not tags). Three rules follow:
//   1. Indonesian shop only. Abroad a parcel goes by DHL, whose smallest bracket costs more than the set
//      itself to Europe, so the English shop does not show them.
//   2. A set is not a bottle: it earns no free vial (one per BOTTLE, up to three).
//   3. Their price is exactly the one Dekito set — no automatic member or export price is written for them.
//
// Import-free: the browser, the order endpoint, the build and the guards all read it.

export const DISCOVERY_SET_CATEGORY = 'Discovery Set';

const norm = (value) => String(value ?? '').trim().toLowerCase();

/** A catalogue product, or a cart/order line, that is a discovery set. */
export const isDiscoverySet = (productOrLine = {}) => (
  norm(productOrLine?.category ?? productOrLine?.product?.category) === norm(DISCOVERY_SET_CATEGORY)
);

/** Is the page being shown the English (abroad) shop? Path-based, so it holds before React has a region. */
export const onEnglishShop = () => (
  typeof window !== 'undefined' && /^\/en(\/|$)/.test(String(window.location?.pathname || ''))
);

/** Shown in this shop? Discovery sets are for the Indonesian shop only (rule 1). */
export const shownInThisShop = (product = {}, { english = onEnglishShop() } = {}) => !(english && isDiscoverySet(product));
