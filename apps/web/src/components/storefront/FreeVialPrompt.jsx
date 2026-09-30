import React, { useCallback, useEffect, useState } from 'react';
import { Gift, X } from 'lucide-react';
import FreeVialChoices from '@/components/storefront/FreeVialChoices.jsx';
import { useCart } from '@/hooks/useCart.js';
import { useStorefrontProducts } from '@/hooks/useStorefrontProducts.js';
import { useTranslate } from '@/hooks/useTranslate.js';
import { CART_ITEM_ADDED_EVENT } from '@/services/cartService.js';
import { isFreeVialProduct, shouldOfferFreeVial, splitFreeVialLines } from '@/utils/freeVial.js';

/**
 * The gift, offered at the moment a bottle goes in the basket.
 *
 * Dekito's decision, 30 Sep 2026, reversing the 29 Sep one. The version that was dropped then is this
 * one, and the reason it was dropped is worth keeping written down: add-to-cart is the highest-friction
 * moment in the shop. So this is built to cost as little of that moment as possible.
 *
 * It opens ONLY while no aroma has been chosen. The rule is one vial per ORDER, not per bottle — asking
 * again on the second bottle would be asking about a gift the buyer already has, and would turn a
 * thank-you into a toll on every tap. Once an aroma is picked, every later add is silent.
 *
 * It also never opens when there is nothing to offer: no vial product, no aroma left in stock, or the
 * English shop, which has no cart at all.
 *
 * Mounted ONCE for the whole app. The alternative was a copy on each of the four screens that add to the
 * cart, which is four places to forget — the shape of defect this repository keeps paying for. It
 * listens for the event the cart's single writer fires, so a screen added later is covered by being
 * written rather than by being remembered.
 *
 * Dismissing is not refusing: the panel on the cart page still offers the same aromas, and is still the
 * only place to swap or return one. This prompt is a shortcut, never the only door.
 */
const FreeVialPrompt = () => {
  const { t, isInternational } = useTranslate();
  const catalog = useStorefrontProducts();
  const { items, setGift } = useCart();
  const [open, setOpen] = useState(false);

  const vialProduct = catalog.find(isFreeVialProduct);
  const { gift } = splitFreeVialLines(items);

  useEffect(() => {
    if (isInternational) return undefined;
    const onAdded = () => setOpen(true);
    window.addEventListener(CART_ITEM_ADDED_EVENT, onAdded);
    return () => window.removeEventListener(CART_ITEM_ADDED_EVENT, onAdded);
  }, [isInternational]);

  // Closed by picking, not only by the X: the buyer has answered, and leaving the sheet up afterwards
  // makes them dismiss a question they have already dealt with.
  const pick = useCallback((item) => {
    setGift(item);
    if (item) setOpen(false);
  }, [setGift]);

  if (!shouldOfferFreeVial({ opened: open, isInternational, vialProduct, gift })) return null;

  return (
    <div className="free-vial-prompt" role="dialog" aria-modal="true" aria-label={t('cart.giftTitle')}>
      {/* The backdrop closes it. A gift nobody asked for must never be able to trap anyone. */}
      <button type="button" className="free-vial-prompt__scrim" aria-label={t('cart.giftLater')} onClick={() => setOpen(false)} />
      <div className="free-vial-prompt__sheet">
        <button type="button" className="free-vial-prompt__close" aria-label={t('cart.giftLater')} onClick={() => setOpen(false)}>
          <X className="h-4 w-4" aria-hidden="true" />
        </button>
        <p className="free-vial__head">
          <Gift className="h-4 w-4" aria-hidden="true" />
          <strong>{t('cart.giftTitle')}</strong>
        </p>
        <p className="free-vial__body">{t('cart.giftBody')}</p>
        <FreeVialChoices vialProduct={vialProduct} gift={gift} onPick={pick} />
        <button type="button" className="free-vial__clear" onClick={() => setOpen(false)}>
          {t('cart.giftLater')}
        </button>
      </div>
    </div>
  );
};

export default FreeVialPrompt;
