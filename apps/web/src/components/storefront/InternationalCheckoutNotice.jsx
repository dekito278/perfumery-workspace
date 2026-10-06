import React from 'react';
import { Globe } from 'lucide-react';
import { buildWhatsAppCheckoutUrl, getStorefrontWhatsAppNumber } from '@/services/cartService.js';
import { useTranslate } from '@/hooks/useTranslate.js';

/**
 * Told before the address form, not after it fails.
 *
 * Shipping destinations come from RajaOngkir, an Indonesian domestic courier API: a search for a foreign
 * city returns an EMPTY LIST with no error. Without this, a buyer outside Indonesia types their city,
 * sees nothing come back, and never learns why — a dead end that says nothing.
 *
 * ONLY BESPOKE SINCE 2026-10-06. It stood on the two carts and the two checkouts as well, and on all four
 * it had become dead code that reads like a safeguard: the carts are chosen by shop (ByShop in App.jsx)
 * so the domestic ones only ever render for a domestic reader, and the checkouts are DomesticOnly — this
 * component's own `if (!isInternational) return null` could never be false on any of them. The bespoke
 * pages are the two that really are reachable in the English shop with a domestic courier search inside,
 * which is the dead end this exists to close.
 *
 * `quotedOnRequest` is for the bespoke request, where that reconciliation does not apply: there is no
 * product page and no international price, because the bottle does not exist yet. Bespoke prices live in
 * storefront_bespoke_options, one set of numbers with no overseas variant, so the honest answer is that
 * the international price is quoted by hand — which is how the shipping and the bottle are settled
 * anyway.
 *
 * It does NOT block checkout. The region is a language and pricing choice, not proof of location: an
 * Indonesian who reads English, or anyone shipping to an Indonesian address, must still be able to buy.
 * Blocking on a guess would refuse real orders, which is worse than the confusion it would prevent.
 */
const InternationalCheckoutNotice = ({ className = '', quotedOnRequest = false }) => {
  const { t, isInternational } = useTranslate();
  const whatsapp = getStorefrontWhatsAppNumber();

  if (!isInternational) return null;

  return (
    <aside className={`rounded-2xl border border-editorial-charcoal/15 bg-[#fbfaf7] p-4 ${className}`} role="note">
      <p className="flex items-center gap-2 text-xs font-bold uppercase tracking-[0.12em] text-editorial-charcoal">
        <Globe className="h-3.5 w-3.5" aria-hidden="true" /> {t('intl.noticeTitle')}
      </p>
      <p className="mt-2 text-xs font-semibold leading-relaxed text-muted-foreground">{t('intl.noticeDomesticOnly')}</p>
      {/* Where the international number comes FROM, which is not the same answer everywhere.
          In the cart it is printed on each product's page. On the bespoke request there is no product
          page and no international price anywhere — the bottle does not exist yet — so pointing at one
          sent an overseas buyer looking for a number that was never written down. */}
      <p className="mt-2 text-xs font-semibold leading-relaxed text-muted-foreground">
        {t(quotedOnRequest ? 'intl.quotedOnRequest' : 'intl.noticeCatalogPrice')}
      </p>
      <p className="mt-2 text-xs font-semibold leading-relaxed text-muted-foreground">{t('intl.domesticOk')}</p>
      {whatsapp ? (
        <a
          href={buildWhatsAppCheckoutUrl(t('intl.noticeMessage'), whatsapp)}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-3 inline-flex w-full items-center justify-center gap-2 rounded-2xl border border-editorial-charcoal/20 bg-white px-4 py-2 text-center text-sm font-bold leading-snug text-editorial-charcoal transition hover:bg-editorial-paper"
        >
          <Globe className="h-4 w-4" /> {t('intl.noticeCta')}
        </a>
      ) : null}
    </aside>
  );
};

export default InternationalCheckoutNotice;
