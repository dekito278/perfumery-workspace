import React from 'react';
import { formatRupiah } from '@/utils/voucherValidation.js';
import { useTranslate } from '@/hooks/useTranslate.js';

/**
 * What the price used to be, on the line that changed.
 *
 * The cart reprices every line against the live catalogue on read, and it has always said so — with one
 * sentence, at the top, about "some items". The buyer was left with a total that disagreed with the one
 * they remembered and no way to see which bottle moved, in which direction, or by how much. When a price
 * has gone UP, that sentence is the only warning they get before paying more than the page quoted them.
 *
 * reconcileCartLines already writes previousPriceNumber on every line. Nothing read it until now.
 */
const CartPriceChange = ({ item, className = '' }) => {
  const { t } = useTranslate();
  const previous = Number(item?.previousPriceNumber || 0);
  const current = Number(item?.priceNumber || 0);
  if (!item?.priceChanged || previous <= 0 || current <= 0 || previous === current) return null;

  return (
    <p className={`text-[0.72rem] font-semibold leading-snug text-muted-foreground ${className}`}>
      {t(current > previous ? 'cart.priceUpFrom' : 'cart.priceDownFrom', { price: formatRupiah(previous) })}
    </p>
  );
};

export default CartPriceChange;
