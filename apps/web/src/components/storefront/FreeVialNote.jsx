import React from 'react';
import { Gift } from 'lucide-react';
import { useTranslate } from '@/hooks/useTranslate.js';
import { freeVialChoices, isFreeVialProduct } from '@/utils/freeVial.js';

/**
 * One line telling a buyer the gift exists, BEFORE they decide.
 *
 * Dekito built the free vial in September: one 2 ml aroma of the buyer's choosing, shipped with every
 * order. The cart says so, the checkout says so, the order page says so — and the product page, the
 * screen where someone actually decides whether to buy, said nothing at all. The one surface where it
 * could change a mind was the one surface that withheld it.
 *
 * Both houses Dekito pointed at put what comes with the bottle on the product page rather than saving
 * it for the cart. This is the same move with something he had already built.
 *
 * It uses the cart's OWN strings, not new ones. The wording was written once and translated once; a
 * second copy here would be a second thing to keep in step, and the first time they drifted the shop
 * would be promising two slightly different gifts.
 *
 * NEVER shown when there is nothing to give. freeVialChoices filters on stock, so when every aroma has
 * run out this renders nothing rather than a promise the checkout will quietly fail to keep — which is
 * the same rule shouldPromptFreeVial applies in the cart, read from the same function.
 */
const FreeVialNote = ({ products = [], className = '' }) => {
  const { t } = useTranslate();
  const vialProduct = (Array.isArray(products) ? products : []).find(isFreeVialProduct) || null;
  if (freeVialChoices(vialProduct).length === 0) return null;

  return (
    <p className={`pdp-vial-note ${className}`.trim()}>
      <Gift className="pdp-vial-note__icon" aria-hidden="true" />
      <span>
        <strong>{t('cart.giftTitle')}</strong>{' '}
        {t('cart.giftBody')}
      </span>
    </p>
  );
};

export default FreeVialNote;
