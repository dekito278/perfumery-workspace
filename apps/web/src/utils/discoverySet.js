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

// A name as letters and digits only, accents folded: "La Rose" and "La rose", "L'iris" and "L’iris",
// "HUG N°1" and "Hug No 1" are one perfume (the same folding the free-vial rules use).
const nameKey = (value) => String(value ?? '')
  .normalize('NFKD').replace(/[\u0300-\u036f]/g, '')
  .replace(/°/g, 'o').toLowerCase().replace(/[^a-z0-9]/g, '');

/**
 * The perfumes inside a set, as catalogue products, in the order the set's description names them
 * (audit, 19 Nov 2026: the set page had a "from the first spray to the last trace" heading over an empty
 * pyramid, and no way to read about the scents in the box). Nothing is invented: a perfume is listed only
 * when Dekito's own description of the set names it. Sets themselves are never listed.
 */
export const setContents = (set = {}, catalog = []) => {
  if (!isDiscoverySet(set)) return [];
  const text = nameKey(set.description);
  if (!text) return [];
  return (Array.isArray(catalog) ? catalog : [])
    .filter((item) => item?.slug && item.name && !isDiscoverySet(item))
    // The Latin name only: "Ayang-ayang (ꦲꦪꦤ꧀ꦒ꧀)" is written "Ayang-ayang" in a description.
    .map((item) => ({ item, at: text.indexOf(nameKey(String(item.name).split(/\s+[^\x00-\x7F]/)[0].replace(/\s*\([^)]*\)\s*$/, ''))) }))
    .filter((entry) => entry.at >= 0)
    .sort((a, b) => a.at - b.at)
    .map((entry) => entry.item);
};

/** "5 vial" reads "5 vials" in the English shop; any other size label is left as it is. */
export const setSizeLabel = (size, english = false) => {
  const match = String(size ?? '').trim().match(/^(\d+)\s*vial$/i);
  if (!english || !match) return String(size ?? '');
  return Number(match[1]) === 1 ? '1 vial' : `${match[1]} vials`;
};

// The sets' names in the English shop (Dekito, 19 Nov 2026: "atur kamu aja, jadi pakai bahasa Inggris").
// Perfume names stay as he wrote them in both shops; a set's name is a description ("Hangat & Manis",
// "Semua varian"), and a buyer abroad cannot read it. Keyed by slug; a set not listed keeps its own name.
// The Indonesian shop, the Studio and the order records are untouched.
export const SET_NAMES_EN = {
  'set-i-floral': 'Set I · Floral',
  'set-ii-hangat-manis': 'Set II · Warm & Sweet',
  'set-iii-jalan-pulang': 'Set III · The Way Home',
  'set-iv-limited': 'Set IV · Limited',
  'set-lengkap': 'The Complete Set · All scents',
};

/** The name to show for `product`: the English one for a set in the English shop, else its own. */
export const shopNameFor = (product = {}, english = false) => (
  (english && isDiscoverySet(product) && SET_NAMES_EN[String(product.slug || '')]) || product?.name || ''
);

/** The catalogue as the English shop names it: sets renamed, everything else the same objects. */
// Returns the SAME array when nothing is renamed, so a caller that hangs flags off it loses nothing.
export const withShopNames = (products = [], english = false) => {
  if (!english || !Array.isArray(products)) return products;
  let changed = false;
  const next = products.map((product) => {
    const name = shopNameFor(product, true);
    if (!name || name === product.name) return product;
    changed = true;
    return { ...product, name };
  });
  return changed ? next : products;
};

/** What one set adds to a parcel — box, pouch and vials. Dekito's scale, 19 Nov 2026 ("berat satu set 250g"). */
export const DISCOVERY_SET_WEIGHT_GRAM = 250;

/**
 * The lines to weigh, with each set at its weighed 250 g. Its size label ("5 vial") names no millilitres,
 * so the weight table fell back to 300 g. Used by BOTH sides — the browser that quotes the courier fee
 * and the endpoint that charges it — so the two cannot disagree.
 */
export const weighSetLines = (lines = []) => (
  (Array.isArray(lines) ? lines : []).map((line) => (
    isDiscoverySet(line) ? { ...line, weightGram: DISCOVERY_SET_WEIGHT_GRAM } : line
  ))
);
