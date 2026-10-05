import React from 'react';
import { Globe } from 'lucide-react';
import { formatRupiah } from '@/services/productCatalogService.js';
import { useTranslate } from '@/hooks/useTranslate.js';
import { usdPriceFor } from '@/utils/usdPrice.js';

/**
 * The price an international buyer actually pays, as the headline.
 *
 * Dekito's decision, 2026-09-16: in the English shop this is the ONLY price shown, and the cart is not
 * offered. A page that carried the Indonesian price, a struck-through retail price and an international
 * price at once left the reader to guess which of the three was theirs — he saw all three on one screen
 * and said so.
 *
 * Dollars lead because that is the number a foreign buyer can judge, and since 2026-09-24 it is also the
 * number they actually send: payment goes to a USD account, so the dollar figure is the price and not an
 * estimate of it. It carried the word "approx." until that day and must not any more — a headline marked
 * approximate above a payment page asking for an exact transfer is the worst of both.
 *
 * Rupiah stays underneath as the reference the shop keeps its books in.
 */
// WHY THE RUPIAH IS NOT HERE.
//
// It used to sit beside the dollar, unlabelled, and the two are not the same amount on purpose: the
// rupiah is Dekito's own export price and the dollar is that price converted at a rate held BELOW the
// market (16.500 against ~17.900) and rounded UP to the next $5. Both cushions point the same way, so
// what lands in the account is never less than the rupiah price.
//
// Printed side by side with no label, that cushion reads as the opposite. Dekito did the division
// himself on 1 Oct 2026 — "kok ini 1.260.000 sih padahal saya cek 1.4 an" — and a buyer abroad would
// reach the same place and a worse conclusion: US$80 is ~Rp 1.43 juta at the real rate, so the shop
// looks like it is quoting 1,26 and charging 1,43.
//
// Labelling it "approx." would not fix it: Rp 1.260.000 genuinely is NOT the equivalent of US$80. It is
// a different number for a different purpose. The dollar is what this buyer is asked to send, so the
// dollar is what this buyer is shown — the rupiah stays in the books, where it belongs.
const InternationalPrice = ({ price, className = '' }) => {
  const { t } = useTranslate();
  // ONE international price since 2026-10-06, so one sentence under it. There were two — "Southeast Asia
  // price" and "priced for outside Indonesia" — while the neighbours paid 2.2x; that split is retired (see
  // shippingRegion.js) and a line that still chose between them would be choosing between two true
  // sentences and one that is no longer.
  //
  // THE FREIGHT IS NOT IN THE PRICE. The sentence here says so, and the quote block beneath the headline
  // puts the actual shipping figure next to it, which is the only honest way to say "not included".
  const usd = usdPriceFor(price);

  return (
    <div className={className}>
      <p className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
        {/* Rupiah only when there is no dollar to show — see the note at the top of this file. */}
        <span className="text-2xl font-bold text-editorial-charcoal">{usd ? `US$${usd}` : formatRupiah(price)}</span>
      </p>
      <p className="mt-1 flex items-start gap-1.5 text-xs font-semibold leading-relaxed text-muted-foreground">
        <Globe className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
        <span>{t('intl.priceNote')}</span>
      </p>
    </div>
  );
};

export default InternationalPrice;
