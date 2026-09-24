import React from 'react';
import { formatRupiah, getPrimaryVariant } from '@/services/productCatalogService.js';
import { useOverseasPrice } from '@/hooks/useOverseasPrice.js';
import { useTranslate } from '@/hooks/useTranslate.js';
import { usdPriceFor } from '@/utils/usdPrice.js';

/**
 * The price on a catalogue or home card, for the shop being read.
 *
 * One component in four places — two catalogues and two homes — because a card showing the Indonesian
 * price in the English shop is the same confusion as the product page had, four times over and harder to
 * notice.
 *
 * The lookup goes through the PRIMARY VARIANT, not the product: every export price is keyed by variant,
 * so a product-level lookup finds nothing and the card would quietly fall back to the Indonesian price.
 */
const CardPrice = ({ product, className = '', memberClassName = '' }) => {
  const { t } = useTranslate();
  const variant = getPrimaryVariant(Array.isArray(product?.variants) ? product.variants : []);
  // useOverseasPrice, NOT useExportPrice: the second returns the export price to EVERYONE, and using
  // it here put the international price on the Indonesian shop's cards. Caught on the phone, not by a
  // guard — which is why there is now a guard.
  const exportPrice = useOverseasPrice(product, variant);

  if (exportPrice) {
    const usd = usdPriceFor(exportPrice);
    return (
      <>
        <span className={className}>{usd ? `US$${usd}` : formatRupiah(exportPrice)}</span>
        {usd ? <span className={memberClassName}>{formatRupiah(exportPrice)}</span> : null}
      </>
    );
  }

  return (
    <>
      <span className={className}>{product?.price || formatRupiah(product?.priceNumber || 0)}</span>
      {product?.memberPriceNumber ? (
        <span className={memberClassName}>{t('price.memberIs', { price: formatRupiah(product.memberPriceNumber) })}</span>
      ) : null}
    </>
  );
};

export default CardPrice;
