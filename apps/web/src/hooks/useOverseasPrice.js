import { useTierPrices } from '@/hooks/useStorefrontProducts.js';
import { useStorefrontRegion } from '@/hooks/useStorefrontRegion.js';
import { tierPricesForLine } from '@/utils/tierPrice.js';
import { internationalPriceFor } from '@/utils/shippingRegion.js';
import { useShippingRegion } from '@/hooks/useShippingRegion.js';

/**
 * The export price for this line, or null — the single answer to "is this visitor being quoted
 * internationally?"
 *
 * One hook rather than two components each detecting for themselves, because two surfaces are what this
 * repo gets wrong most often, and here the two would contradict each other on the same screen: the panel
 * announcing Rp 1.400.000 while the line above it offers Rp 550.000 to anyone who signs in. That is the
 * bait-and-switch this feature exists to prevent, pointing the other way.
 *
 * Detection runs in an effect, never during render: the product pages are prerendered, and an English
 * export panel baked into that HTML is what Google would index.
 */
export const useExportPrice = (product, variant = null) => {
  const { index } = useTierPrices();
  // The chosen shop, not the raw guess. The guess is still what decides the default — it just no longer
  // has the last word, so a visitor it reads wrong can correct it and Dekito can see his own
  // international shop from Indonesia.
  const { isInternational: overseasVisitor } = useStorefrontRegion();

  // Southeast Asia pays a different price from the rest of the world — 2.2x retail instead of 3.5x —
  // because free shipping cannot do the work there: RaySpeed charges about Rp 90.000 to Malaysia, so
  // waiving it is a gift worth 8% that nobody feels. Only the price itself moves that number.
  const shippingRegion = useShippingRegion();

  if (!product?.slug) return { price: null, overseasVisitor, shippingRegion };
  // The RETAIL price, never the one this visitor happens to be entitled to.
  //
  // applyTierPrices rewrites priceNumber to the member price for a signed-in member and keeps the
  // original as retailPriceNumber. Reading priceNumber here multiplied the member discount into the
  // international price: a signed-in buyer in Singapore was quoted US$45 where an anonymous one saw
  // US$50, and the same bottle cost less abroad the moment someone logged in. Dekito's decision,
  // 2026-09-24 — the member discount is a domestic loyalty price and does not travel.
  const linePrice = Number(
    variant?.retailPriceNumber
    ?? variant?.priceNumber
    ?? product?.retailPriceNumber
    ?? product?.priceNumber
    ?? 0,
  );
  const price = internationalPriceFor({
    tierPrices: tierPricesForLine(index, product.slug, variant?.id || ''),
    linePrice,
    region: shippingRegion,
  });
  return { price, overseasVisitor, shippingRegion };
};

/**
 * The export price ONLY for a visitor the detection says is abroad — what decides whether the English
 * panel appears and whether the member nudge goes quiet.
 *
 * Kept separate from useExportPrice on purpose. The price exists for everyone; being quoted in it is a
 * guess. Collapsing the two would either hide the price from Indonesian visitors who have a reason to
 * see it, or silence the member nudge for people who can still use it.
 */
export const useOverseasPrice = (product, variant = null) => {
  const { price, overseasVisitor } = useExportPrice(product, variant);
  return overseasVisitor ? price : null;
};

export default useOverseasPrice;
