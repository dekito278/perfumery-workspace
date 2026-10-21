import React from 'react';
import { useTranslate } from '@/hooks/useTranslate.js';
import { priceNoticeIsDue } from '@/utils/priceChangeNotice.js';

/**
 * "Harga lama berlaku sampai 11.11", for the eleven days before the domestic prices change.
 *
 * Renders nothing outside that window and nothing at all in the English shop: the dollar prices are not
 * moving, so announcing a change there would promise an overseas buyer something that never arrives.
 *
 * No percentage in it, by instruction. A shop that prints the size of a coming rise invites everyone to
 * wait for the deadline and then feel the number.
 */
const PriceChangeNotice = ({ className = '' }) => {
  const { t, region } = useTranslate();
  if (!priceNoticeIsDue({ region })) return null;

  return (
    <p className={`price-change-notice${className ? ` ${className}` : ''}`} role="status">
      {t('price.oldPricesHold')}
    </p>
  );
};

export default PriceChangeNotice;
