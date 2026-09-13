import React from 'react';
import { formatRupiah } from '@/services/productCatalogService.js';

const TIER_LABELS = { member: 'Harga member', reseller: 'Harga reseller' };

/**
 * Says why this price is not the one everyone else sees. Without it a member has no way to tell a
 * member price from a sale, and no reason to stay signed in.
 *
 * Renders nothing at retail — which, until the tier migration runs, is everyone. The storefront stays
 * exactly as it is today rather than growing an empty label.
 */
const TierPriceNote = ({ product, variant = null, className = '' }) => {
  const label = TIER_LABELS[product?.priceTier];
  const retail = Number(variant?.retailPriceNumber ?? product?.retailPriceNumber ?? 0);
  const price = Number(variant?.priceNumber ?? product?.priceNumber ?? 0);
  if (!label || !retail || !price || retail === price) return null;

  return (
    <p className={`mt-1 flex flex-wrap items-baseline gap-2 text-xs font-bold uppercase tracking-[0.12em] text-amber-700 ${className}`}>
      {label}
      {retail > price ? (
        <span className="font-semibold normal-case tracking-normal text-muted-foreground line-through">{formatRupiah(retail)}</span>
      ) : null}
    </p>
  );
};

export default TierPriceNote;
