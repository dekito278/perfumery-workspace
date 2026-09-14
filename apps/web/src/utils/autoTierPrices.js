// Member and export prices that follow the retail price on their own.
//
// Dekito's rule, 2026-09-15: "kalau saya kasih harga dari website, harga membernya otomatis 10%, untuk
// luar negeri 3,5x." Until now both were typed by hand, which is why 17 of 18 products had no member
// price for weeks and 17 of 18 had no export price — and why the storefront had nothing to show the
// people it was built to show it to.
//
// The hard part is not the arithmetic. It is knowing when NOT to write. A price Dekito set deliberately
// must survive a retail edit, or the automation quietly undoes his own decisions; a price this rule
// produced must follow the retail price, or it goes stale and a 10% member discount silently becomes 25%.
//
// So a saved tier price is treated as "still automatic" only while it equals what this rule would have
// produced from the PREVIOUS retail price. The moment it differs, it is a decision, and decisions win.
//
// Import-free apart from the two pricing formulas, so the guard runs the rules instead of reading them.
import {
  DEFAULT_MEMBER_DISCOUNT_PERCENT,
  DEFAULT_OVERSEAS_MULTIPLIER,
  memberPriceFromRetail,
  overseasPriceFromRetail,
} from './memberPriceFill.js';

export const AUTO_TIER_RULES = [
  { tier: 'member', compute: (retail) => memberPriceFromRetail(retail, DEFAULT_MEMBER_DISCOUNT_PERCENT) },
  { tier: 'overseas', compute: (retail) => overseasPriceFromRetail(retail, DEFAULT_OVERSEAS_MULTIPLIER) },
];

const priceOf = (variant = {}) => Number(variant?.priceNumber ?? variant?.price_number ?? 0) || 0;

/** Variants as {variantId: retailPrice}. A product with none is one line keyed on the empty variant, as
 *  the tier table is. */
export const retailByVariant = (product) => {
  const variants = Array.isArray(product?.variants) ? product.variants : [];
  if (!variants.length) {
    const price = priceOf(product);
    return price ? { '': price } : {};
  }
  const out = {};
  for (const variant of variants) {
    const price = priceOf(variant);
    if (price) out[String(variant?.id || '')] = price;
  }
  return out;
};

/** Saved tier prices as {`variantId|tier`: price}, from listTierPricesForProduct's rows. */
export const savedTierIndex = (rows = []) => {
  const index = {};
  for (const row of rows || []) {
    index[`${row?.variant_id || ''}|${row?.tier}`] = Number(row?.price_number) || 0;
  }
  return index;
};

/**
 * What to write, and nothing more.
 *
 * @returns { writes: [{variantId, tier, priceNumber}], kept: [{variantId, tier, priceNumber}] }
 *   `kept` is every hand-set price left untouched — returned rather than discarded so the screen can say
 *   which prices it did NOT change. An automation that is silent about what it skipped is one the owner
 *   stops trusting.
 */
export const planAutoTierPrices = ({ product, previousProduct = null, savedRows = [] } = {}) => {
  const nextRetail = retailByVariant(product);
  const previousRetail = previousProduct ? retailByVariant(previousProduct) : {};
  const saved = savedTierIndex(savedRows);

  const writes = [];
  const kept = [];

  for (const [variantId, retail] of Object.entries(nextRetail)) {
    for (const rule of AUTO_TIER_RULES) {
      const want = rule.compute(retail);
      // No sensible suggestion — a price too small to discount, say. Never write 0: saveTierPrice reads
      // that as "delete this row".
      if (want === null) continue;

      const current = saved[`${variantId}|${rule.tier}`] ?? null;
      if (current === null) {
        writes.push({ variantId, tier: rule.tier, priceNumber: want });
        continue;
      }

      // A variant with no previous retail price — a size added in this very save — computes to null,
      // and null never equals a saved number, so it falls through to "hand-set" and is left alone. That
      // is the safe reading, and it is why there is no separate check for it: a sabotage showed the
      // explicit guard changed nothing, and a safeguard that cannot fire is one the next reader trusts
      // for no reason.
      const wasAutomatic = current === rule.compute(previousRetail[variantId]);
      if (!wasAutomatic) {
        kept.push({ variantId, tier: rule.tier, priceNumber: current });
        continue;
      }
      if (current !== want) writes.push({ variantId, tier: rule.tier, priceNumber: want });
    }
  }

  return { writes, kept };
};

const TIER_LABELS = { member: 'member', overseas: 'luar negeri' };

/**
 * One message for both product forms, so desktop and mobile cannot describe the same save differently.
 *
 * @returns { level: 'error' | 'success', text } or null when there is nothing worth saying. Silence is
 *   for the ordinary case: nothing changed, so no toast. A FAILURE is never silent — the product saved
 *   and its prices did not, and only the person looking at this screen can fix that.
 */
export const autoTierPriceMessage = (result) => {
  if (!result) return null;

  if (result.schemaReady === false) {
    return { level: 'error', text: 'Produk tersimpan, tapi tabel harga bertingkat belum ada — harga member dan luar negeri TIDAK terisi.' };
  }
  if (result.failures?.length) {
    return {
      level: 'error',
      text: `Produk tersimpan, tapi harga otomatis gagal: ${result.failures.slice(0, 2).join(' | ')}`,
    };
  }
  if (!result.written) return null;

  const kept = result.kept ? `, ${result.kept} harga yang kamu set sendiri dibiarkan` : '';
  return { level: 'success', text: `${result.written} harga otomatis diperbarui (${Object.values(TIER_LABELS).join(' & ')})${kept}.` };
};
