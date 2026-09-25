import React from 'react';
import { Globe } from 'lucide-react';
import { formatRupiah } from '@/services/productCatalogService.js';
import { useExportPrice, useOverseasPrice } from '@/hooks/useOverseasPrice.js';
import { usdPriceFor } from '@/utils/usdPrice.js';
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
  // Which of the two international prices this is. The neighbours pay 2.2x and the rest of the world
  // 3.5x, and the sentence below has to name the one being shown — a panel that says "outside
  // Indonesia" over the Southeast Asia price is quoting the right number under the wrong promise.
  const { shippingRegion } = useExportPrice(product, variant);
  if (!price) return null;

  const usd = usdPriceFor(price);

  return (
    <div className={`mt-3 rounded-2xl border border-editorial-charcoal/15 bg-[#fbfaf7] p-4 ${className}`}>
      <p className="flex items-center gap-2 text-xs font-bold uppercase tracking-[0.12em] text-editorial-charcoal">
        <Globe className="h-3.5 w-3.5" /> Shipping outside Indonesia
      </p>
      <p className="mt-2 flex flex-wrap items-baseline gap-x-2 gap-y-1">
        <span className="text-lg font-bold text-editorial-charcoal">US${usd}</span>
        <span className="text-sm font-semibold text-muted-foreground">{formatRupiah(price)}</span>
      </p>
      {/* Written in English on purpose, in both shops: this panel exists for a reader who is abroad.
          It said "Shipping is included" from 19 Sep until 25 Sep 2026, on the strength of RaySpeed's
          Rp 90.000 kilo to Malaysia. The carrier bills a one-kilo MINIMUM, so a single 30 ml bottle to
          Los Angeles costs Rp 670.500 to send out of a US$80 price — the promise only ever held on a
          full parcel. Shipping is quoted from the published card now, on every destination. */}
      <p className="mt-1 text-xs font-semibold leading-relaxed text-muted-foreground">
        {shippingRegion === 'asia'
          ? 'Priced for Southeast Asia and separate from the Indonesian price above. Shipping is quoted separately, once we know where the parcel is going.'
          : 'International orders are priced separately from the Indonesian price above. Shipping is quoted separately, from our rate card, once we know where the parcel is going.'}
      </p>
      <OverseasInquiryButton
        product={product}
        variant={variant}
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
