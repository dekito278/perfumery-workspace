import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Gift, X } from 'lucide-react';
import { Link } from 'react-router-dom';
import FreeVialChoices from '@/components/storefront/FreeVialChoices.jsx';
import { useCart } from '@/hooks/useCart.js';
import { useStorefrontProducts } from '@/hooks/useStorefrontProducts.js';
import { useTranslate } from '@/hooks/useTranslate.js';
import { CART_ITEM_ADDED_EVENT } from '@/services/cartService.js';
import { boughtNames, isFreeVialProduct, shouldOfferFreeVial, splitFreeVialLines } from '@/utils/freeVial.js';

// Once "Nanti saja" (or the X, or the backdrop) has been said, later adds in the same visit stay silent:
// asking on every bottle turned a thank-you into a toll (visitor audit, 13 Nov 2026). The cart page still
// offers the same aromas. sessionStorage, so a new visit asks again; a blocked store just asks as before.
const DISMISSED_KEY = 'solivagant.freeVialPrompt.dismissed';
const wasDismissed = () => { try { return window.sessionStorage.getItem(DISMISSED_KEY) === '1'; } catch { return false; } };
const rememberDismissed = () => { try { window.sessionStorage.setItem(DISMISSED_KEY, '1'); } catch { /* asks again next add */ } };

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
 * It also never opens when there is nothing to offer: no vial product, or no aroma left in stock.
 *
 * It opened only in the Indonesian shop until 2026-10-06, because the English shop had no cart to put a
 * gift into. Dekito opened both that day. The gift is weightless against the carrier's bracket — a 2 ml
 * vial is 10 g against a one-kilo minimum — so it changes neither the shipping nor the total; what it
 * must do is reach the WhatsApp order, or Dekito packs a parcel without knowing a vial was chosen.
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
  const { t } = useTranslate();
  const catalog = useStorefrontProducts();
  const { items, setGift } = useCart();
  const [open, setOpen] = useState(false);

  const vialProduct = catalog.find(isFreeVialProduct);
  const { gift } = splitFreeVialLines(items);
  const bought = boughtNames(items);
  const dismiss = useCallback(() => { rememberDismissed(); setOpen(false); }, []);

  useEffect(() => {
    // A screen that opens its own sheet for this add says so, and this prompt stands down: two modals for
    // one event put a full-screen panel over the sheet's way forward, and the sheet's own modal machinery
    // marked this one aria-hidden, so a screen reader was never told about the thing covering the screen.
    // The cart page still offers the same aromas, which is where a dismissed prompt sends everyone anyway.
    const onAdded = (event) => { if (event.detail?.announcedByScreen || wasDismissed()) return; setOpen(true); };
    window.addEventListener(CART_ITEM_ADDED_EVENT, onAdded);
    return () => window.removeEventListener(CART_ITEM_ADDED_EVENT, onAdded);
  }, []);

  // Closed by picking, not only by the X: the buyer has answered, and leaving the sheet up afterwards
  // makes them dismiss a question they have already dealt with.
  const pick = useCallback((item) => {
    setGift(item);
    if (item) setOpen(false);
  }, [setGift]);

  const visible = shouldOfferFreeVial({ opened: open, vialProduct, gift, bought });
  const sheetRef = useRef(null);
  // A real modal for a keyboard (visitor audit, 13 Nov 2026: focus stayed on the page behind, Tab walked the
  // hidden page, Escape did nothing). Focus moves in, Tab stays in, Escape declines like the X, and focus
  // returns to where it was — the add-to-cart button.
  useEffect(() => {
    if (!visible) return undefined;
    const before = document.activeElement;
    const sheet = sheetRef.current;
    const focusables = () => [...(sheet?.querySelectorAll('button:not([disabled]), a[href]') || [])];
    (focusables()[1] || focusables()[0])?.focus();
    const onKey = (event) => {
      if (event.key === 'Escape') { event.preventDefault(); dismiss(); return; }
      if (event.key !== 'Tab') return;
      const list = focusables();
      if (!list.length) return;
      const first = list[0];
      const last = list[list.length - 1];
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
      else if (!sheet.contains(document.activeElement)) { event.preventDefault(); first.focus(); }
    };
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('keydown', onKey);
      if (before && typeof before.focus === 'function') before.focus();
    };
  }, [visible, dismiss]);

  if (!visible) return null;

  return (
    <div className="free-vial-prompt" role="dialog" aria-modal="true" aria-label={t('cart.giftTitle')}>
      {/* The backdrop closes it. A gift nobody asked for must never be able to trap anyone. */}
      <button type="button" className="free-vial-prompt__scrim" aria-label={t('cart.giftLater')} onClick={dismiss} />
      <div className="free-vial-prompt__sheet" ref={sheetRef}>
        <button type="button" className="free-vial-prompt__close" aria-label={t('cart.giftLater')} onClick={dismiss}>
          <X className="h-4 w-4" aria-hidden="true" />
        </button>
        <p className="free-vial__head">
          <Gift className="h-4 w-4" aria-hidden="true" />
          <strong>{t('cart.giftTitle')}</strong>
        </p>
        <p className="free-vial__body">{t('cart.giftBody')}</p>
        <FreeVialChoices vialProduct={vialProduct} gift={gift} onPick={pick} bought={bought} />
        <button type="button" className="free-vial__clear" onClick={dismiss}>
          {t('cart.giftLater')}
        </button>
        {/* The add-to-cart toast's "Lihat keranjang" sits behind this dialog while it holds the focus, and
            is gone by the time the dialog closes (seventh visitor audit, 13 Nov 2026): the way to the cart is
            offered here too. */}
        <Link to="/cart" className="free-vial__clear" onClick={() => setOpen(false)}>
          {t('pdp.viewCart')}
        </Link>
      </div>
    </div>
  );
};

export default FreeVialPrompt;
