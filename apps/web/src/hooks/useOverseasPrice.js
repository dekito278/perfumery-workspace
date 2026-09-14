import { useEffect, useState } from 'react';
import { useTierPrices } from '@/hooks/useStorefrontProducts.js';
import { tierPricesForLine } from '@/utils/tierPrice.js';
import { detectOverseasVisitor, overseasPriceFor } from '@/utils/overseasVisitor.js';

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
  const [overseasVisitor, setOverseasVisitor] = useState(false);
  const { index } = useTierPrices();

  useEffect(() => { setOverseasVisitor(detectOverseasVisitor()); }, []);

  if (!product?.slug) return { price: null, overseasVisitor };
  const linePrice = Number(variant?.priceNumber ?? product?.priceNumber ?? 0);
  const price = overseasPriceFor(tierPricesForLine(index, product.slug, variant?.id || ''), linePrice);
  return { price, overseasVisitor };
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
