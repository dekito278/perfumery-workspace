import React from 'react';
import { formatRupiah } from '@/services/productCatalogService.js';

const TIER_LABELS = { member: 'Harga member', reseller: 'Harga reseller' };

/**
 * The one line under a price that explains why it is what it is. Two reasons exist and only one may
 * show at a time, or a discounted product bought by a member renders two struck-through numbers and the
 * buyer cannot tell which is the real comparison.
 *
 * Tier wins. "Harga member" is the reason that changes what THIS buyer pays; a compare-at price is
 * marketing that applies to everyone.
 *
 * Renders nothing when neither applies — which, until the tier migration runs and a compare-at price is
 * set above the selling price, is every product. The storefront stays exactly as it is.
 */
const PriceNote = ({ product, variant = null, className = '' }) => {
  const price = Number(variant?.priceNumber ?? product?.priceNumber ?? 0);

  const tierLabel = TIER_LABELS[product?.priceTier];
  const retail = Number(variant?.retailPriceNumber ?? product?.retailPriceNumber ?? 0);
  if (tierLabel && retail && price && retail !== price) {
    return (
      <p className={`mt-1 flex flex-wrap items-baseline gap-2 text-xs font-bold uppercase tracking-[0.12em] text-amber-700 ${className}`}>
        {tierLabel}
        {retail > price ? (
          <span className="font-semibold normal-case tracking-normal text-muted-foreground line-through">{formatRupiah(retail)}</span>
        ) : null}
      </p>
    );
  }

  // A compare-at price is only a comparison when it is ABOVE what is being charged. Two live products
  // carry stray values (Rp10 and Rp5 against prices in the hundreds of thousands) precisely because
  // nothing ever displayed this field, so a lower number has to read as "not set" rather than as a
  // price rise.
  const compareAt = Number(variant?.compareAtPriceNumber ?? product?.compareAtPriceNumber ?? 0);
  if (!price || !(compareAt > price)) return null;

  return (
    <p className={`mt-1 flex flex-wrap items-baseline gap-2 text-xs font-bold uppercase tracking-[0.12em] text-amber-700 ${className}`}>
      <span className="font-semibold normal-case tracking-normal text-muted-foreground line-through">{formatRupiah(compareAt)}</span>
      Hemat {formatRupiah(compareAt - price)}
    </p>
  );
};

export default PriceNote;
