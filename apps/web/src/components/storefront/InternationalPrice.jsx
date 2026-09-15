import React from 'react';
import { Globe } from 'lucide-react';
import { formatRupiah } from '@/services/productCatalogService.js';
import { useTranslate } from '@/hooks/useTranslate.js';
import { approximateUsd } from '@/utils/overseasVisitor.js';

/**
 * The price an international buyer actually pays, as the headline.
 *
 * Dekito's decision, 2026-09-16: in the English shop this is the ONLY price shown, and the cart is not
 * offered. A page that carried the Indonesian price, a struck-through retail price and an international
 * price at once left the reader to guess which of the three was theirs — he saw all three on one screen
 * and said so.
 *
 * Dollars lead because that is the number a foreign buyer can judge; rupiah sits under it because that is
 * what would actually be charged. The dollar figure is an approximation from one constant rate and is
 * always labelled as one — a stale big number is worse than a stale small one, which is exactly why the
 * rupiah stays visible underneath rather than being replaced.
 */
const InternationalPrice = ({ price, className = '' }) => {
  const { t } = useTranslate();
  const usd = approximateUsd(price);

  return (
    <div className={className}>
      <p className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
        {usd ? <span className="text-2xl font-bold text-editorial-charcoal">approx. US${usd}</span> : null}
        <span className="text-sm font-semibold text-muted-foreground">{formatRupiah(price)}</span>
      </p>
      <p className="mt-1 flex items-start gap-1.5 text-xs font-semibold leading-relaxed text-muted-foreground">
        <Globe className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
        <span>{t('intl.priceNote')}</span>
      </p>
    </div>
  );
};

export default InternationalPrice;
