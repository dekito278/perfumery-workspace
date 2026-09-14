import React from 'react';
import { Globe } from 'lucide-react';
import { formatRupiah } from '@/services/productCatalogService.js';
import { useOverseasPrice } from '@/hooks/useOverseasPrice.js';
import { approximateUsd } from '@/utils/overseasVisitor.js';
import OverseasInquiryButton from './OverseasInquiryButton.jsx';

/**
 * What an international buyer will actually be quoted, shown before they ask instead of after.
 *
 * The price comes from useOverseasPrice — the same hook PriceNote uses to stay quiet — so the panel and
 * the line above it can never disagree about whether this visitor is buying internationally.
 */
const OverseasPriceNote = ({ product, variant = null, className = '' }) => {
  // Null covers both "not abroad" and "no export price set for this bottle". Inventing one from the
  // domestic price is the guess this whole component exists to stop.
  const price = useOverseasPrice(product, variant);
  if (!price) return null;

  const usd = approximateUsd(price);

  return (
    <div className={`mt-3 rounded-2xl border border-editorial-charcoal/15 bg-[#fbfaf7] p-4 ${className}`}>
      <p className="flex items-center gap-2 text-xs font-bold uppercase tracking-[0.12em] text-editorial-charcoal">
        <Globe className="h-3.5 w-3.5" /> Shipping outside Indonesia
      </p>
      <p className="mt-2 flex flex-wrap items-baseline gap-x-2 gap-y-1">
        <span className="text-lg font-bold text-editorial-charcoal">{formatRupiah(price)}</span>
        {usd ? <span className="text-sm font-semibold text-muted-foreground">approx. US${usd}</span> : null}
      </p>
      <p className="mt-1 text-xs font-semibold leading-relaxed text-muted-foreground">
        International orders are priced separately from the Indonesian price above. Shipping is not
        included — we quote it by hand for your country, because it is the only honest way to do it.
      </p>
      <OverseasInquiryButton
        product={product}
        size={variant?.size || product.size || ''}
        price={formatRupiah(price)}
        english
        compact
        className="mt-3"
      />
    </div>
  );
};

export default OverseasPriceNote;
