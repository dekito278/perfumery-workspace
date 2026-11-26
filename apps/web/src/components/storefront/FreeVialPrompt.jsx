import React, { useCallback, useEffect, useRef, useState } from 'react';
import { CheckCircle2, Gift, X } from 'lucide-react';
import { Link } from 'react-router-dom';
import { toast } from 'sonner';
import FreeVialChoices from '@/components/storefront/FreeVialChoices.jsx';
import { useCart } from '@/hooks/useCart.js';
import { useStorefrontProducts } from '@/hooks/useStorefrontProducts.js';
import { useTranslate } from '@/hooks/useTranslate.js';
import { CART_ITEM_ADDED_EVENT } from '@/services/cartService.js';
import { boughtNames, giftVariantIds, isFreeVialProduct, shouldOfferFreeVial, splitFreeVialLines } from '@/utils/freeVial.js';
import { plainName } from '@/utils/scriptName.js';

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
 * One vial PER BOTTLE since 18 Nov 2026, up to three, each a different scent (Dekito: "masukin keranjang
 * … langsung muncul pop up … kalau skip, di keranjangnya ada pilihan"). So it opens on an add while the
 * bottles have earned a vial not yet chosen, and offers only scents not already chosen. Once three are
 * chosen — or every earned one is — later adds are silent. "Nanti saja" still silences it for the visit;
 * the cart then offers the rest. (Until that day: one vial per order, and silent after the first pick.)
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
  const { items, setGifts } = useCart();
  const [open, setOpen] = useState(false);
  const [addedName, setAddedName] = useState('');

  const vialProduct = catalog.find(isFreeVialProduct);
  const { gifts, bottles } = splitFreeVialLines(items);
  const bought = boughtNames(items);
  const dismiss = useCallback(() => { rememberDismissed(); setOpen(false); }, []);

  useEffect(() => {
    // A screen that opens its own sheet for this add says so, and this prompt stands down: two modals for
    // one event put a full-screen panel over the sheet's way forward, and the sheet's own modal machinery
    // marked this one aria-hidden, so a screen reader was never told about the thing covering the screen.
    // The cart page still offers the same aromas, which is where a dismissed prompt sends everyone anyway.
    const onAdded = (event) => {
      if (event.detail?.announcedByScreen || wasDismissed()) return;
      setAddedName(plainName(event.detail?.name || ''));
      setOpen(true);
    };
    window.addEventListener(CART_ITEM_ADDED_EVENT, onAdded);
    return () => window.removeEventListener(CART_ITEM_ADDED_EVENT, onAdded);
  }, []);

  // Closed by picking, not only by the X: the buyer has answered, and leaving the sheet up afterwards
  // makes them dismiss a question they have already dealt with.
  // …and it says what it did: the sheet vanished with no word about the vial (eleventh visitor audit).
  // One bottle, one vial (18 Nov 2026): a pick ADDS this bottle's vial to the ones already chosen.
  const pick = useCallback((item) => {
    if (!item) return;
    setGifts([...gifts, item]);
    setOpen(false);
    toast.success(t('cart.giftAdded', { name: item.size }));
  }, [gifts, setGifts, t]);

  const visible = shouldOfferFreeVial({ opened: open, vialProduct, gifts, bought, bottles });
  // One event, one announcement (26 Nov 2026, from the buyer walk): the add-to-cart toast at the top AND this
  // sheet at the bottom were two boxes for one tap. When the sheet opens it takes over the announcement —
  // it says what went in (below) and already offers "Lihat keranjang" — and the toast goes.
  // A tick later, not at once: the screen raises its toast in the same click, after the add that opened this.
  useEffect(() => {
    if (!visible) return undefined;
    const timer = window.setTimeout(() => toast.dismiss(), 0);
    return () => window.clearTimeout(timer);
  }, [visible]);
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
        {addedName ? (
          <p className="free-vial__added" role="status">
            <CheckCircle2 className="h-4 w-4" aria-hidden="true" />
            {t('pdp.addedToast', { name: addedName })}
          </p>
        ) : null}
        <p className="free-vial__head">
          <Gift className="h-4 w-4" aria-hidden="true" />
          <strong>{t('cart.giftTitle')}</strong>
        </p>
        <p className="free-vial__body">{t('cart.giftBody')}</p>
        <FreeVialChoices vialProduct={vialProduct} gift={null} onPick={pick} bought={bought} taken={giftVariantIds(gifts)} />
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
