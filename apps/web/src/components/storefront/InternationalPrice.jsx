import React from 'react';
import { Globe } from 'lucide-react';
import { formatRupiah } from '@/services/productCatalogService.js';
import { useTranslate } from '@/hooks/useTranslate.js';
import { usdPriceFor } from '@/utils/usdPrice.js';
import { useShippingRegion } from '@/hooks/useShippingRegion.js';

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
  // Which of the two international prices this headline is. A reader in Kuala Lumpur is looking at the
  // Southeast Asia price with the shipping already inside it; telling them "anywhere else we work the
  // shipping out on WhatsApp" invites a question they do not need to ask.
  const shippingRegion = useShippingRegion();
  const usd = usdPriceFor(price);

  return (
    <div className={className}>
      <p className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
        {/* Rupiah only when there is no dollar to show — see the note at the top of this file. */}
        <span className="text-2xl font-bold text-editorial-charcoal">{usd ? `US$${usd}` : formatRupiah(price)}</span>
      </p>
      <p className="mt-1 flex items-start gap-1.5 text-xs font-semibold leading-relaxed text-muted-foreground">
        <Globe className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
        <span>{t(shippingRegion === 'asia' ? 'intl.priceNoteAsia' : 'intl.priceNote')}</span>
      </p>
    </div>
  );
};

export default InternationalPrice;
